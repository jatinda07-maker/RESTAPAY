import React, { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { DrilldownPanel } from '../components/SummaryDrilldown'
import { createId, saveCloudData, sortByName } from '../lib/localStore'
import { applyPresetToSetters, isDateInRange, makeRangeLabel, readPageDateRange, savePageDateRange } from '../engine/DateEngine'

const blankInvoice = {
  vendor_id: '',
  vendor_name: '',
  invoice_number: '',
  invoice_date: '',
  category: 'Food',
  total: 0,
  status: 'Draft',
  check_number: '',
  source: 'Manual',
  invoice_type: 'Regular Invoice',
  notes: '',
  file_name: ''
}

function money(n) {
  return Number(n || 0).toFixed(2)
}

function clean(v) {
  return String(v ?? '').trim()
}

function norm(v) {
  return clean(v).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function parseAmount(v) {
  if (typeof v === 'number') return v
  const raw = String(v ?? '').trim()
  const negativeByParens = /^\s*\(.*\)\s*$/.test(raw)
  const negativeByCredit = /\b(credit|rebate|refund|return)\b/i.test(raw)
  const cleaned = raw.replace(/[$,()]/g, '').trim()
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return 0
  const value = Math.abs(n)
  return negativeByParens || negativeByCredit || n < 0 ? -value : value
}

function formatMoney(n) {
  const amount = Number(n || 0)
  const sign = amount < 0 ? '-' : ''
  return `${sign}$${money(Math.abs(amount))}`
}

function inferInvoiceType(record = {}) {
  const text = [record.invoice_type, record.status, record.notes, record.source_file, record.file_name, record.invoice_number, record.vendor_name, record.category]
    .map(value => String(value || '').toLowerCase())
    .join(' ')
  const total = parseAmount(record.total)
  if (text.includes('rebate')) return 'Rebate'
  if (text.includes('credit memo') || text.includes('credit')) return 'Credit Memo'
  if (text.includes('return')) return 'Return Credit'
  if (text.includes('adjustment')) return 'Vendor Adjustment'
  if (total < 0) return 'Credit Memo'
  return record.invoice_type || 'Regular Invoice'
}

function signedInvoiceTotal(record = {}) {
  const type = inferInvoiceType(record)
  const amount = parseAmount(record.total)
  if (['Rebate', 'Credit Memo', 'Return Credit', 'Vendor Adjustment'].includes(type)) return -Math.abs(amount)
  return amount
}

function getFirst(row, keys) {
  const entries = Object.entries(row || {})
  for (const key of keys) {
    const wanted = norm(key)
    const found = entries.find(([k]) => norm(k) === wanted || norm(k).includes(wanted) || wanted.includes(norm(k)))
    if (found) return found[1]
  }
  return ''
}

function namesMatch(a, b) {
  const left = norm(a)
  const right = norm(b)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

function invoiceDuplicateKey(invoice) {
  return `${norm(invoice.vendor_name)}::${norm(invoice.invoice_number)}`
}

function findDuplicateInvoice(invoices, candidate, editingId = null) {
  const invoiceNumber = norm(candidate.invoice_number)
  const vendorName = norm(candidate.vendor_name)
  if (!invoiceNumber || !vendorName) return null

  return (invoices || []).find(inv => {
    if (editingId && inv.id === editingId) return false
    return invoiceDuplicateKey(inv) === `${vendorName}::${invoiceNumber}`
  }) || null
}

function inferInvoiceRows(rows) {
  const lineItems = rows.map((row, idx) => {
    const description = clean(getFirst(row, ['description', 'item', 'product', 'name', 'line item'])) || `Line ${idx + 1}`
    const qty = parseAmount(getFirst(row, ['qty', 'quantity', 'case qty', 'units'])) || 1
    const unit = parseAmount(getFirst(row, ['unit price', 'price', 'cost', 'rate']))
    const total = parseAmount(getFirst(row, ['total', 'amount', 'line total', 'extended price'])) || qty * unit

    return {
      id: createId('item'),
      description,
      qty,
      unit_price: Number(unit.toFixed(2)),
      total: Number(total.toFixed(2)),
      category: ''
    }
  }).filter(x => x.description && (x.total || x.unit_price || x.qty))

  const first = rows[0] || {}
  const invoice_number = clean(getFirst(first, ['invoice number', 'invoice #', 'invoice no', 'number']))
  const invoice_date = clean(getFirst(first, ['invoice date', 'date']))
  const vendor_name = clean(getFirst(first, ['vendor', 'supplier', 'company']))
  const total = lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0)

  return {
    invoice_number,
    invoice_date,
    vendor_name,
    total: Number(total.toFixed(2)),
    lineItems
  }
}

async function readWorkbook(file) {
  const buf = await file.arrayBuffer()
  const workbook = XLSX.read(buf, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']

function getGeminiKey(localKey = '') {
  return clean(localKey) || clean(import.meta.env.VITE_GEMINI_API_KEY)
}

function getGeminiModels() {
  const envModel = clean(import.meta.env.VITE_GEMINI_MODEL)
  return envModel
    ? [envModel, ...DEFAULT_GEMINI_MODELS.filter(model => model !== envModel)]
    : DEFAULT_GEMINI_MODELS
}

function extractJsonText(text) {
  const cleaned = String(text || '').replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1)
  return cleaned
}

async function extractWithGemini(file, apiKey) {
  const key = getGeminiKey(apiKey)

  if (!key) {
    throw new Error('Gemini API key missing. Set VITE_GEMINI_API_KEY in Render, save, then Clear build cache & deploy.')
  }

  const base64 = await fileToBase64(file)

  const prompt = `You are an invoice extraction engine for a restaurant accounting app. Extract invoice data from this file/image/PDF. Return only valid JSON, no markdown. Shape: {"vendor_name":"","invoice_number":"","invoice_date":"YYYY-MM-DD or raw date","invoice_type":"Regular Invoice|Credit Memo|Rebate|Return Credit|Vendor Adjustment","category":"Food|Beverage|Beer|Liquor|Utilities|Insurance|Supplies|Maintenance|Other","total":0,"tax":0,"freight":0,"discount":0,"lineItems":[{"description":"","qty":0,"unit_price":0,"total":0,"category":""}]}. Use numbers only for amounts. If a field is unclear, use empty string or 0.`

  let lastError = ''

  for (const model of getGeminiModels()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: file.type || 'application/octet-stream',
                data: base64
              }
            }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      })
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      lastError = `Gemini ${model} failed: ${res.status}${errorText ? ' - ' + errorText.slice(0, 200) : ''}`

      if (res.status === 404) continue
      if (res.status === 400) throw new Error(`${lastError}. Check file type and Gemini model.`)
      if (res.status === 401 || res.status === 403) throw new Error(`${lastError}. Check your Gemini API key permissions.`)

      throw new Error(lastError)
    }

    const json = await res.json()
    const text = json?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || ''

    if (!text) {
      lastError = `Gemini ${model} returned no text.`
      continue
    }

    const parsed = JSON.parse(extractJsonText(text))

    return {
      ...parsed,
      total: Number(parseAmount(parsed.total).toFixed(2)),
      tax: Number(parseAmount(parsed.tax).toFixed(2)),
      freight: Number(parseAmount(parsed.freight).toFixed(2)),
      discount: Number(parseAmount(parsed.discount).toFixed(2)),
      lineItems: (parsed.lineItems || []).map(item => ({
        ...item,
        id: createId('item'),
        qty: Number(parseAmount(item.qty || 1).toFixed(2)),
        unit_price: Number(parseAmount(item.unit_price).toFixed(2)),
        total: Number(parseAmount(item.total).toFixed(2))
      }))
    }
  }

  throw new Error(lastError || 'Gemini extraction failed. Check model name or API key.')
}

export default function Invoices({ data, setData }) {
  const vendors = sortByName(data.vendors || [])
  const categories = data.vendorCategories || []
  const invoices = [...(data.invoices || [])].sort((a, b) => String(b.invoice_date || b.created_at || '').localeCompare(String(a.invoice_date || a.created_at || '')))

  const [form, setForm] = useState(blankInvoice)
  const [editingId, setEditingId] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('Upload CSV/XLSX for local extraction. PDF/image/phone capture uses Gemini from Render env.')
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [dateStart, setDateStart] = useState(() => readPageDateRange('invoices').start)
  const [dateEnd, setDateEnd] = useState(() => readPageDateRange('invoices').end)
  const [summaryDetail, setSummaryDetail] = useState('')
  const localUploadRef = useRef(null)
  const aiUploadRef = useRef(null)
  const phoneRef = useRef(null)

  const filtered = useMemo(() => invoices
    .filter(inv => isDateInRange(inv.invoice_date || inv.date || inv.created_at?.slice(0, 10), dateStart, dateEnd))
    .filter(inv => {
      const q = search.toLowerCase().trim()
      if (!q) return true
      return [inv.vendor_name, inv.invoice_number, inv.invoice_type, inv.category, inv.status, inv.file_name, inv.check_number].join(' ').toLowerCase().includes(q)
    }), [invoices, search, dateStart, dateEnd])

  function applyDateRange() {
    savePageDateRange('invoices', dateStart, dateEnd)
  }

  function applyPreset(preset) {
    applyPresetToSetters(preset, setDateStart, setDateEnd, (start, end) => savePageDateRange('invoices', start, end))
  }

  const rangeLabel = makeRangeLabel(dateStart, dateEnd)

  const spendingSummary = useMemo(() => {
    const rows = filtered || []
    const totalSpend = rows.reduce((sum, inv) => sum + signedInvoiceTotal(inv), 0)
    const rebateSpend = rows
      .filter(inv => ['Rebate', 'Credit Memo', 'Return Credit', 'Vendor Adjustment'].includes(inferInvoiceType(inv)))
      .reduce((sum, inv) => sum + Math.abs(signedInvoiceTotal(inv)), 0)
    const grossInvoiceSpend = rows.reduce((sum, inv) => {
      const total = signedInvoiceTotal(inv)
      return total > 0 ? sum + total : sum
    }, 0)
    const paidSpend = rows
      .filter(inv => String(inv.status || '').toLowerCase() === 'paid')
      .reduce((sum, inv) => sum + signedInvoiceTotal(inv), 0)
    const openSpend = rows
      .filter(inv => !['paid', 'approved'].includes(String(inv.status || '').toLowerCase()))
      .reduce((sum, inv) => sum + signedInvoiceTotal(inv), 0)
    const checkSpend = rows
      .filter(inv => clean(inv.check_number))
      .reduce((sum, inv) => sum + signedInvoiceTotal(inv), 0)

    const categoryMap = new Map()
    rows.forEach(inv => {
      const category = clean(inv.category) || 'Other'
      categoryMap.set(category, (categoryMap.get(category) || 0) + signedInvoiceTotal(inv))
    })

    const topCategories = [...categoryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, amount]) => ({ label, amount }))

    const latestInvoice = [...rows].sort((a, b) => String(b.invoice_date || b.created_at || '').localeCompare(String(a.invoice_date || a.created_at || '')))[0]

    return {
      rows,
      totalSpend,
      grossInvoiceSpend,
      rebateSpend,
      paidSpend,
      openSpend,
      checkSpend,
      topCategories,
      latestInvoice
    }
  }, [filtered])

  const topCategoryLabel = spendingSummary.topCategories[0]?.label || 'No category'
  const topCategoryAmount = spendingSummary.topCategories[0]?.amount || 0
  const rebateCount = filtered.filter(inv => ['Rebate', 'Credit Memo', 'Return Credit', 'Vendor Adjustment'].includes(inferInvoiceType(inv))).length

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setDuplicateWarning(null)

    if (field === 'vendor_id') {
      const vendor = vendors.find(v => v.id === value)
      if (vendor) {
        setForm(prev => ({
          ...prev,
          vendor_id: vendor.id,
          vendor_name: vendor.name,
          category: vendor.category || prev.category
        }))
      }
    }
  }

  function clearForm() {
    setForm(blankInvoice)
    setEditingId(null)
    setLineItems([])
    setDuplicateWarning(null)
  }

  function addLineItem() {
    setLineItems(prev => [...prev, {
      id: createId('item'),
      description: '',
      qty: 1,
      unit_price: 0,
      total: 0,
      category: form.category
    }])
  }

  function updateLine(id, field, value) {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item

      const next = {
        ...item,
        [field]: ['qty', 'unit_price', 'total'].includes(field) ? parseAmount(value) : value
      }

      if (field === 'qty' || field === 'unit_price') {
        next.total = Number((Number(next.qty || 0) * Number(next.unit_price || 0)).toFixed(2))
      }

      return next
    }))
  }

  function removeLine(id) {
    setLineItems(prev => prev.filter(item => item.id !== id))
  }

  async function saveInvoice(options = {}) {
    const vendorName = clean(form.vendor_name) || clean(vendors.find(v => v.id === form.vendor_id)?.name)

    if (!vendorName) return setStatus('Choose or enter vendor first')

    const rawTotal = parseAmount(form.total) || lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0)
    const invoice_type = inferInvoiceType({ ...form, total: rawTotal })
    const total = Number(signedInvoiceTotal({ ...form, total: rawTotal, invoice_type }).toFixed(2))
    const category = form.category || 'Food'

    const payload = {
      ...form,
      vendor_name: vendorName,
      category,
      invoice_type,
      total,
      check_number: clean(form.check_number),
      updated_at: new Date().toISOString()
    }

    const duplicate = findDuplicateInvoice(data.invoices || [], payload, editingId)
    if (duplicate && !options.saveAnyway) {
      setDuplicateWarning(duplicate)
      setStatus(`Possible duplicate: invoice #${payload.invoice_number} from ${payload.vendor_name} already exists.`)
      return
    }

    let nextDataForCloud = null

    setData(prev => {
      const currentInvoices = prev.invoices || []
      const currentItems = prev.invoiceItems || []
      const currentVendors = prev.vendors || []

      let vendorId = payload.vendor_id
      let nextVendors = currentVendors

      const existingVendor = currentVendors.find(v => namesMatch(v.name, vendorName))
      if (existingVendor) {
        vendorId = existingVendor.id
      } else {
        const newVendor = {
          id: createId('vendor'),
          name: vendorName,
          category,
          contact: '',
          phone: '',
          email: '',
          notes: 'Auto-created from AI invoice extraction',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        vendorId = newVendor.id
        nextVendors = sortByName([...currentVendors, newVendor])
      }

      const finalPayload = {
        ...payload,
        vendor_id: vendorId,
        vendor_name: vendorName
      }

      if (editingId) {
        const invoices = currentInvoices.map(inv => inv.id === editingId ? { ...inv, ...finalPayload, id: editingId } : inv)
        const items = [
          ...currentItems.filter(item => item.invoice_id !== editingId),
          ...lineItems.map(item => ({
            ...item,
            id: item.id || createId('item'),
            invoice_id: editingId,
            quantity: Number(item.qty || item.quantity || 0),
            line_total: Number(item.total || item.line_total || 0)
          }))
        ]

        nextDataForCloud = {
          ...prev,
          vendors: nextVendors,
          invoices,
          invoiceItems: items
        }
        return nextDataForCloud
      }

      const id = createId('inv')
      const invoice = {
        ...finalPayload,
        id,
        created_at: new Date().toISOString()
      }

      nextDataForCloud = {
        ...prev,
        vendors: nextVendors,
        invoices: [...currentInvoices, invoice],
        invoiceItems: [
          ...currentItems,
          ...lineItems.map(item => ({
            ...item,
            id: item.id || createId('item'),
            invoice_id: id,
            quantity: Number(item.qty || item.quantity || 0),
            line_total: Number(item.total || item.line_total || 0)
          }))
        ]
      }
      return nextDataForCloud
    })

    if (nextDataForCloud) {
      const cloudResult = await saveCloudData(nextDataForCloud)
      if (!cloudResult?.ok) {
        const message = cloudResult?.reason || cloudResult?.error?.message || 'Unknown Supabase error'
        console.error('Invoice saved locally but Supabase did not save:', cloudResult)
        setStatus(`Invoice saved locally, but Supabase failed: ${message}`)
      } else {
        setStatus(editingId ? `Invoice updated and synced: ${vendorName}` : `Invoice saved and synced: ${vendorName}`)
      }
    } else {
      setStatus(editingId ? `Invoice updated locally: ${vendorName}` : `Invoice saved locally: ${vendorName}`)
    }
    setDuplicateWarning(null)
    clearForm()
  }

  function editInvoice(inv) {
    setEditingId(inv.id)
    setForm({ ...blankInvoice, ...inv })
    setLineItems((data.invoiceItems || []).filter(item => item.invoice_id === inv.id).map(item => ({ ...item })))
    setDuplicateWarning(null)
    setStatus(`Editing invoice: ${inv.vendor_name}`)
    requestAnimationFrame(() => document.querySelector('.invoice-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function deleteInvoice(id) {
    setData(prev => ({
      ...prev,
      invoices: (prev.invoices || []).filter(inv => inv.id !== id),
      invoiceItems: (prev.invoiceItems || []).filter(item => item.invoice_id !== id)
    }))

    if (editingId === id) clearForm()
    setStatus('Invoice deleted')
  }

  async function handleFile(file, mode = 'smart-ai') {
    if (!file) return

    try {
      setDuplicateWarning(null)
      setStatus(`Reading ${file.name || 'phone capture'}...`)

      const ext = (file.name || '').toLowerCase().split('.').pop()
      const canLocalExtract = ['csv', 'xlsx', 'xls'].includes(ext)
      let extracted

      if (mode === 'local' && !canLocalExtract) {
        setStatus('Local upload supports CSV/XLSX invoice files. Use Smart AI Upload or Camera Capture AI for PDF/images.')
        return
      }

      if (mode === 'local' || (canLocalExtract && mode !== 'smart-ai')) {
        const rows = await readWorkbook(file)
        extracted = inferInvoiceRows(rows)
        setStatus(`Local invoice extraction completed from ${file.name}. Review and save.`)
      } else {
        extracted = await extractWithGemini(file, data.settings?.geminiApiKey)
        setStatus(`AI invoice extraction completed from ${mode === 'phone' ? 'camera capture' : file.name}. Review and save.`)
      }

      const vendorMatch = vendors.find(v => namesMatch(v.name, extracted.vendor_name))
      const extractedLineItems = extracted.lineItems || []

      setForm(prev => ({
        ...prev,
        ...blankInvoice,
        ...extracted,
        vendor_id: vendorMatch?.id || '',
        vendor_name: extracted.vendor_name || vendorMatch?.name || '',
        category: extracted.category || vendorMatch?.category || 'Food',
        invoice_type: inferInvoiceType({ ...extracted, file_name: file.name || '' }),
        total: money(signedInvoiceTotal({ ...extracted, file_name: file.name || '' })),
        status: inferInvoiceType({ ...extracted, file_name: file.name || '' }) === 'Regular Invoice' ? 'Review' : 'Applied Credit',
        source: ext || mode,
        file_name: file.name || 'phone-capture',
        notes: [
          extracted.tax ? `Tax: $${money(extracted.tax)}` : '',
          extracted.freight ? `Freight: $${money(extracted.freight)}` : '',
          extracted.discount ? `Discount: $${money(extracted.discount)}` : ''
        ].filter(Boolean).join(' | ')
      }))

      setLineItems(extractedLineItems.map(item => ({
        id: item.id || createId('item'),
        description: clean(item.description),
        qty: Number(item.qty || 1),
        unit_price: Number(item.unit_price || 0),
        total: Number(item.total || 0),
        category: item.category || extracted.category || 'Food'
      })))

      const possibleDuplicate = findDuplicateInvoice(data.invoices || [], {
        vendor_name: extracted.vendor_name || vendorMatch?.name || '',
        invoice_number: extracted.invoice_number || ''
      })

      if (possibleDuplicate) {
        setDuplicateWarning(possibleDuplicate)
        setStatus(`Possible duplicate found: ${possibleDuplicate.vendor_name} invoice #${possibleDuplicate.invoice_number}. Review before saving.`)
      } else if (!vendorMatch && extracted.vendor_name) {
        setStatus(`AI extraction complete. New vendor "${extracted.vendor_name}" will be auto-created when you save.`)
      }
    } catch (err) {
      console.error(err)
      setStatus(err.message || 'Invoice extraction failed. Enter manually or check Gemini API key.')
    } finally {
      if (localUploadRef.current) localUploadRef.current.value = ''
      if (aiUploadRef.current) aiUploadRef.current.value = ''
      if (phoneRef.current) phoneRef.current.value = ''
    }
  }

  return <>
    <div className="page-head employee-head">
      <div>
        <h1>Invoices</h1>
        <p>Upload invoices, review extracted data, auto-create vendors, and prevent duplicates.</p>
      </div>
      <div className="employee-head-actions">
        <div className="search-box">
          <Icon name="search" size={17} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." />
        </div>
      </div>
    </div>

    <div className="status-pill">{status}</div>

    {duplicateWarning ? <div className="status-pill warning-pill">
      Duplicate warning: {duplicateWarning.vendor_name} invoice #{duplicateWarning.invoice_number} already exists.
      <button className="btn secondary small-btn" type="button" onClick={() => editInvoice(duplicateWarning)}>Open Existing</button>
      <button className="btn danger small-btn" type="button" onClick={() => saveInvoice({ saveAnyway: true })}>Save Anyway</button>
    </div> : null}

    <section className="invoice-spend-grid compact-invoice-grid" aria-label="Invoice spending totals">
      <button type="button" className={`invoice-spend-card primary flat-summary-card ${summaryDetail === 'net' ? 'active' : ''}`} onClick={() => setSummaryDetail(summaryDetail === 'net' ? '' : 'net')}>
        <span className="invoice-spend-icon"><Icon name="invoices" size={19} /></span>
        <span className="invoice-spend-copy"><small>Net Invoice Spend</small><strong>{formatMoney(spendingSummary.totalSpend)}</strong><em>{spendingSummary.rows.length} invoices in view</em></span>
      </button>
      <button type="button" className={`invoice-spend-card flat-summary-card ${summaryDetail === 'category' ? 'active' : ''}`} onClick={() => setSummaryDetail(summaryDetail === 'category' ? '' : 'category')}>
        <span className="invoice-spend-icon green"><Icon name="vendors" size={19} /></span>
        <span className="invoice-spend-copy"><small>Top Category</small><strong>{formatMoney(topCategoryAmount)}</strong><em>{topCategoryLabel}</em></span>
      </button>
      <button type="button" className={`invoice-spend-card flat-summary-card ${summaryDetail === 'open' ? 'active' : ''}`} onClick={() => setSummaryDetail(summaryDetail === 'open' ? '' : 'open')}>
        <span className="invoice-spend-icon orange"><Icon name="expenses" size={19} /></span>
        <span className="invoice-spend-copy"><small>Open / Unpaid</small><strong>{formatMoney(spendingSummary.openSpend)}</strong><em>Paid {formatMoney(spendingSummary.paidSpend)}</em></span>
      </button>
      <button type="button" className={`invoice-spend-card flat-summary-card ${summaryDetail === 'rebates' ? 'active' : ''}`} onClick={() => setSummaryDetail(summaryDetail === 'rebates' ? '' : 'rebates')}>
        <span className="invoice-spend-icon blue"><Icon name="check" size={19} /></span>
        <span className="invoice-spend-copy"><small>Rebates / Credits</small><strong>{formatMoney(-spendingSummary.rebateSpend)}</strong><em>{rebateCount} rebate or credit entries</em></span>
      </button>
    </section>

    <DrilldownPanel id="invoice-summary-details"
      title={summaryDetail ? ({ net: 'Net Invoice Spend Details', category: `${topCategoryLabel} Invoice Details`, open: 'Open / Unpaid Invoice Details', rebates: 'Rebate and Credit Details' }[summaryDetail]) : ''}
      rows={filtered.filter(inv => {
        if (summaryDetail === 'net') return true
        if (summaryDetail === 'category') return (clean(inv.category) || 'Other') === topCategoryLabel
        if (summaryDetail === 'open') return !['paid', 'approved'].includes(String(inv.status || '').toLowerCase())
        if (summaryDetail === 'rebates') return ['Rebate', 'Credit Memo', 'Return Credit', 'Vendor Adjustment'].includes(inferInvoiceType(inv))
        return false
      })}
      columns={[
        { key: 'invoice_date', label: 'Date' },
        { key: 'vendor_name', label: 'Vendor' },
        { key: 'invoice_number', label: 'Invoice #' },
        { key: 'invoice_type', label: 'Type', render: inv => inferInvoiceType(inv) },
        { key: 'category', label: 'Category' },
        { key: 'status', label: 'Status' },
        { key: 'total', label: 'Amount', render: inv => formatMoney(signedInvoiceTotal(inv)) }
      ]}
      total={summaryDetail ? formatMoney(filtered.filter(inv => {
        if (summaryDetail === 'net') return true
        if (summaryDetail === 'category') return (clean(inv.category) || 'Other') === topCategoryLabel
        if (summaryDetail === 'open') return !['paid', 'approved'].includes(String(inv.status || '').toLowerCase())
        if (summaryDetail === 'rebates') return ['Rebate', 'Credit Memo', 'Return Credit', 'Vendor Adjustment'].includes(inferInvoiceType(inv))
        return false
      }).reduce((sum, inv) => sum + signedInvoiceTotal(inv), 0)) : ''}
      onClose={() => setSummaryDetail('')} />

    <section className="invoice-category-strip">
      <div>
        <strong>Spending by Category</strong>
        <span>Based on current invoice search/filter</span>
      </div>
      <div className="invoice-category-pills">
        {spendingSummary.topCategories.length ? spendingSummary.topCategories.map(row => <span key={row.label} className="invoice-category-pill"><b>{row.label}</b>{formatMoney(row.amount)}</span>) : <span className="invoice-category-pill muted">No invoice spending yet</span>}
      </div>
    </section>

    <section className="page-filter-shell invoice-filter-shell">
      <div className="search-box sales-search"><Icon name="search" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices, vendor, check #..." /></div>
      <DateControls start={dateStart} end={dateEnd} onStartChange={setDateStart} onEndChange={setDateEnd} onApply={applyDateRange} onPreset={applyPreset} />
      <span className="filter-note">Filtering invoices by {rangeLabel}</span>
    </section>

    <section className="form-card tight-card invoice-form-card">
      <div className="invoice-toolbar">
        <div>
          <h2>{editingId ? 'Edit Invoice' : 'Invoice Review / Manual Entry'}</h2>
          <span className="ai-env-note">AI OCR uses Gemini from Render environment variables.</span>
        </div>
        <div className="invoice-upload-actions compact-upload-actions">
          <label className="btn secondary file-action">
            <Icon name="upload" /> Local Upload
            <input ref={localUploadRef} type="file" accept=".csv,.xlsx,.xls" onChange={e => handleFile(e.target.files?.[0], 'local')} />
          </label>
          <label className="btn primary file-action">
            <Icon name="upload" /> Smart AI Upload
            <input ref={aiUploadRef} type="file" accept=".pdf,image/*" onChange={e => handleFile(e.target.files?.[0], 'smart-ai')} />
          </label>
          <label className="btn secondary file-action">
            <Icon name="camera" /> Camera Capture AI
            <input ref={phoneRef} type="file" accept="image/*" capture="environment" onChange={e => handleFile(e.target.files?.[0], 'phone')} />
          </label>
        </div>
      </div>

      <div className="employee-form-grid invoice-form-grid">
        <label>Vendor <span>*</span>
          <select value={form.vendor_id} onChange={e => update('vendor_id', e.target.value)}>
            <option value="">Auto-create / Select vendor</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>

        <label>Vendor name
          <input value={form.vendor_name} onChange={e => update('vendor_name', e.target.value)} placeholder="Vendor from invoice" />
        </label>

        <label>Invoice #
          <input value={form.invoice_number} onChange={e => update('invoice_number', e.target.value)} placeholder="Invoice number" />
        </label>

        <label>Date
          <input type="date" value={form.invoice_date} onChange={e => update('invoice_date', e.target.value)} />
        </label>

        <label>Invoice Type
          <select value={form.invoice_type || 'Regular Invoice'} onChange={e => update('invoice_type', e.target.value)}>
            <option>Regular Invoice</option>
            <option>Credit Memo</option>
            <option>Rebate</option>
            <option>Return Credit</option>
            <option>Vendor Adjustment</option>
          </select>
        </label>

        <label>Category
          <select value={form.category} onChange={e => update('category', e.target.value)}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>

        <label>Total
          <input value={form.total} onChange={e => update('total', e.target.value)} placeholder="0.00" />
        </label>

        <label>Status
          <select value={form.status} onChange={e => update('status', e.target.value)}>
            <option>Draft</option>
            <option>Review</option>
            <option>Approved</option>
            <option>Paid</option>
            <option>Applied Credit</option>
          </select>
        </label>

        <label>Check # / Ref
          <input value={form.check_number || ''} onChange={e => update('check_number', e.target.value)} placeholder="Optional check number" />
        </label>

        <label className="wide-2">Notes
          <input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Optional notes" />
        </label>

        <div className="form-actions-inline">
          <button className="btn secondary" onClick={clearForm} type="button">Clear</button>
          <button className="btn primary" type="button" onClick={() => saveInvoice()}>
            <Icon name="save" /> {editingId ? 'Save Changes' : 'Save Invoice'}
          </button>
        </div>
      </div>
    </section>

    <section className="table-card compact-table-card invoice-items-card">
      <header>
        <h2>Line Items</h2>
        <span><button className="btn secondary small-btn" onClick={addLineItem} type="button">Add Line</button></span>
      </header>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Total</th>
            <th>Category</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map(item => <tr key={item.id}>
            <td><input className="line-input desc" value={item.description} onChange={e => updateLine(item.id, 'description', e.target.value)} /></td>
            <td><input className="line-input qty" value={item.qty} onChange={e => updateLine(item.id, 'qty', e.target.value)} /></td>
            <td><input className="line-input money" value={money(item.unit_price)} onChange={e => updateLine(item.id, 'unit_price', e.target.value)} /></td>
            <td><input className="line-input money" value={money(item.total)} onChange={e => updateLine(item.id, 'total', e.target.value)} /></td>
            <td>
              <select className="line-select" value={item.category || form.category} onChange={e => updateLine(item.id, 'category', e.target.value)}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </td>
            <td className="row-actions">
              <button className="delete-link" type="button" onClick={() => removeLine(item.id)}>Remove</button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </section>

    <style>{`
      .invoice-spend-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(170px, 1fr));
        gap: 12px;
        margin: 14px 0 12px;
      }
      .invoice-spend-card {
        border: 1px solid #dbe6f3;
        border-radius: 16px;
        background: #fff;
        padding: 15px;
        min-height: 116px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        text-align: left;
        cursor: pointer;
        box-shadow: 0 12px 28px rgba(15, 30, 53, .06);
        transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
      }
      .invoice-spend-card:hover {
        transform: translateY(-2px);
        border-color: #b8cdf1;
        box-shadow: 0 16px 32px rgba(15, 30, 53, .1);
      }
      .invoice-spend-card.primary {
        background: linear-gradient(135deg, #f7fbff 0%, #ffffff 70%);
      }
      .invoice-spend-icon {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        color: #fff;
        background: linear-gradient(135deg, #2563eb, #1649c7);
        box-shadow: 0 10px 20px rgba(37, 99, 235, .22);
      }
      .invoice-spend-icon.green { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 10px 20px rgba(16, 185, 129, .2); }
      .invoice-spend-icon.orange { background: linear-gradient(135deg, #fb923c, #ea580c); box-shadow: 0 10px 20px rgba(249, 115, 22, .2); }
      .invoice-spend-icon.blue { background: linear-gradient(135deg, #38bdf8, #2563eb); box-shadow: 0 10px 20px rgba(37, 99, 235, .18); }
      .invoice-spend-copy { display: grid; gap: 4px; min-width: 0; }
      .invoice-spend-copy small {
        color: #52677f;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .06em;
        text-transform: uppercase;
      }
      .invoice-spend-copy strong {
        color: #07172d;
        font-size: 24px;
        font-weight: 900;
        letter-spacing: -.04em;
        line-height: 1.08;
      }
      .invoice-spend-copy em {
        color: #58708d;
        font-size: 12px;
        font-style: normal;
        font-weight: 750;
        line-height: 1.3;
      }
      .invoice-category-strip {
        border: 1px solid #dbe6f3;
        border-radius: 16px;
        background: #fff;
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: center;
        padding: 13px 15px;
        margin-bottom: 14px;
        box-shadow: 0 10px 24px rgba(15, 30, 53, .05);
      }
      .invoice-category-strip strong { display: block; color: #0f1e35; font-size: 14px; font-weight: 900; }
      .invoice-category-strip span { color: #60758e; font-size: 12px; font-weight: 700; }
      .invoice-category-pills { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
      .invoice-category-pill {
        border: 1px solid #dbe6f3;
        border-radius: 999px;
        background: #f8fbff;
        padding: 7px 10px;
        display: inline-flex;
        gap: 8px;
        align-items: center;
        color: #07172d;
        font-size: 12px;
        font-weight: 900;
      }
      .invoice-category-pill b { color: #52677f; }
      .invoice-category-pill.muted { color: #7a8da3; }
      .negative-money { color: #b42318; font-weight: 800; }
      .compact-invoice-grid { gap: 10px; margin: 10px 0; }
      .flat-summary-card { min-height: 82px; padding: 12px 14px; border-radius: 13px; box-shadow: none; align-items: center; }
      .flat-summary-card:hover { transform: none; box-shadow: none; border-color: #b9c9dd; }
      .invoice-spend-icon, .invoice-spend-icon.green, .invoice-spend-icon.orange, .invoice-spend-icon.blue { width: 38px; height: 38px; border-radius: 11px; box-shadow: none; background: #eff6ff; color: #1666d7; }
      .invoice-spend-icon.green { background: #ecfdf3; color: #0b8a44; }
      .invoice-spend-icon.orange { background: #fff7ed; color: #ea580c; }
      .invoice-spend-copy small { font-size: 10.5px; font-weight: 760; }
      .invoice-spend-copy strong { font-size: 21px; font-weight: 760; }
      .invoice-spend-copy em { font-size: 12px; font-weight: 600; }
      .invoice-category-strip { border-radius: 13px; padding: 10px 12px; box-shadow: none; margin-bottom: 12px; }
      .invoice-toolbar { align-items: center; gap: 10px; }
      .compact-upload-actions { gap: 7px; }
      .compact-upload-actions .btn { min-height: 34px; padding: 0 11px; }
      @media (max-width: 1200px) { .invoice-spend-grid { grid-template-columns: repeat(2, minmax(170px, 1fr)); } }
      @media (max-width: 760px) {
        .invoice-spend-grid { grid-template-columns: 1fr; }
        .invoice-category-strip { flex-direction: column; align-items: flex-start; }
        .invoice-category-pills { justify-content: flex-start; }
      }
    `}</style>

    <section className="table-card compact-table-card employee-table-card">
      <header>
        <h2>Invoice List</h2>
        <span>{filtered.length} invoices</span>
      </header>
      <table>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Invoice #</th>
            <th>Date</th>
            <th>Type</th>
            <th>Category</th>
            <th>Total</th>
            <th>Status</th>
            <th>Check #</th>
            <th>Source</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(inv => <tr key={inv.id}>
            <td><b>{inv.vendor_name}</b><small>{inv.notes || inv.file_name || 'No notes'}</small></td>
            <td>{inv.invoice_number || '-'}</td>
            <td>{inv.invoice_date || '-'}</td>
            <td><span className={`tag ${signedInvoiceTotal(inv) < 0 ? 'danger' : 'neutral'}`}>{inferInvoiceType(inv)}</span></td>
            <td><span className="tag neutral">{inv.category}</span></td>
            <td className={signedInvoiceTotal(inv) < 0 ? 'negative-money' : ''}>{formatMoney(signedInvoiceTotal(inv))}</td>
            <td><span className="tag cash">{inv.status}</span></td>
            <td>{inv.check_number || '-'}</td>
            <td>{inv.source || 'Manual'}</td>
            <td className="row-actions">
              <button type="button" onClick={() => editInvoice(inv)}>Edit</button>
              <button className="delete-link" type="button" onClick={() => deleteInvoice(inv.id)}>Delete</button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </section>
  </>
}
