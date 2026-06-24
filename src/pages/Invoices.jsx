import React, { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import { createId, sortByName } from '../lib/localStore'

const blankInvoice = {
  vendor_id: '', vendor_name: '', invoice_number: '', invoice_date: '', category: 'Food', total: 0,
  status: 'Draft', source: 'Manual', notes: '', file_name: ''
}

function money(n) { return Number(n || 0).toFixed(2) }
function clean(v) { return String(v ?? '').trim() }
function norm(v) { return clean(v).toLowerCase().replace(/[^a-z0-9]+/g, '') }
function parseAmount(v) {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/[$,()]/g, '').trim())
  return Number.isFinite(n) ? n : 0
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
function inferInvoiceRows(rows) {
  const lineItems = rows.map((row, idx) => {
    const description = clean(getFirst(row, ['description', 'item', 'product', 'name', 'line item'])) || `Line ${idx + 1}`
    const qty = parseAmount(getFirst(row, ['qty', 'quantity', 'case qty', 'units'])) || 1
    const unit = parseAmount(getFirst(row, ['unit price', 'price', 'cost', 'rate']))
    const total = parseAmount(getFirst(row, ['total', 'amount', 'line total', 'extended price'])) || qty * unit
    return { id: createId('item'), description, qty, unit_price: Number(unit.toFixed(2)), total: Number(total.toFixed(2)), category: '' }
  }).filter(x => x.description && (x.total || x.unit_price || x.qty))

  const first = rows[0] || {}
  const invoice_number = clean(getFirst(first, ['invoice number', 'invoice #', 'invoice no', 'number']))
  const invoice_date = clean(getFirst(first, ['invoice date', 'date']))
  const vendor_name = clean(getFirst(first, ['vendor', 'supplier', 'company']))
  const total = lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0)
  return { invoice_number, invoice_date, vendor_name, total: Number(total.toFixed(2)), lineItems }
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
const DEFAULT_GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash']
function getGeminiKey(localKey = '') {
  return clean(localKey) || clean(import.meta?.env?.VITE_GEMINI_API_KEY)
}
function getGeminiModels() {
  const envModel = clean(import.meta?.env?.VITE_GEMINI_MODEL)
  return envModel ? [envModel, ...DEFAULT_GEMINI_MODELS.filter(m => m !== envModel)] : DEFAULT_GEMINI_MODELS
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
  if (!key) throw new Error('Gemini API key missing. Add it in Settings or set VITE_GEMINI_API_KEY in Render, then redeploy.')
  const base64 = await fileToBase64(file)
  const prompt = `You are an invoice extraction engine for a restaurant accounting app. Extract invoice data from this file/image/PDF. Return only valid JSON, no markdown. Shape: {"vendor_name":"","invoice_number":"","invoice_date":"YYYY-MM-DD or raw date","category":"Food|Beverage|Beer|Liquor|Utilities|Insurance|Supplies|Maintenance|Other","total":0,"lineItems":[{"description":"","qty":0,"unit_price":0,"total":0,"category":""}]}. Use numbers only for amounts. If a field is unclear, use empty string or 0.`
  let lastError = ''
  for (const model of getGeminiModels()) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type || 'application/octet-stream', data: base64 } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      })
    })
    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      lastError = `Gemini ${model} failed: ${res.status}${errorText ? ' - ' + errorText.slice(0, 120) : ''}`
      if (res.status === 404) continue
      throw new Error(lastError)
    }
    const json = await res.json()
    const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || ''
    const parsed = JSON.parse(extractJsonText(text))
    return {
      ...parsed,
      total: Number(parseAmount(parsed.total).toFixed(2)),
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
  const [status, setStatus] = useState('Upload CSV/XLSX for local extraction. PDF/image/phone capture uses Gemini from .env when local extraction cannot read it.')
  const localUploadRef = useRef(null)
  const aiUploadRef = useRef(null)
  const phoneRef = useRef(null)

  const filtered = useMemo(() => invoices.filter(inv => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return [inv.vendor_name, inv.invoice_number, inv.category, inv.status, inv.file_name].join(' ').toLowerCase().includes(q)
  }), [invoices, search])

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (field === 'vendor_id') {
      const vendor = vendors.find(v => v.id === value)
      if (vendor) setForm(prev => ({ ...prev, vendor_id: vendor.id, vendor_name: vendor.name, category: vendor.category || prev.category }))
    }
  }
  function clearForm() { setForm(blankInvoice); setEditingId(null); setLineItems([]) }
  function addLineItem() {
    setLineItems(prev => [...prev, { id: createId('item'), description: '', qty: 1, unit_price: 0, total: 0, category: form.category }])
  }
  function updateLine(id, field, value) {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const next = { ...item, [field]: ['qty', 'unit_price', 'total'].includes(field) ? parseAmount(value) : value }
      if (field === 'qty' || field === 'unit_price') next.total = Number((Number(next.qty || 0) * Number(next.unit_price || 0)).toFixed(2))
      return next
    }))
  }
  function removeLine(id) { setLineItems(prev => prev.filter(item => item.id !== id)) }
  function saveInvoice() {
    const vendorName = clean(form.vendor_name) || clean(vendors.find(v => v.id === form.vendor_id)?.name)
    if (!vendorName) return setStatus('Choose or enter vendor first')
    const total = Number((parseAmount(form.total) || lineItems.reduce((s, i) => s + Number(i.total || 0), 0)).toFixed(2))
    const payload = { ...form, vendor_name: vendorName, total, updated_at: new Date().toISOString() }
    setData(prev => {
      const current = prev.invoices || []
      const currentItems = prev.invoiceItems || []
      if (editingId) {
        const invoices = current.map(inv => inv.id === editingId ? { ...inv, ...payload, id: editingId } : inv)
        const items = [...currentItems.filter(item => item.invoice_id !== editingId), ...lineItems.map(item => ({ ...item, invoice_id: editingId }))]
        return { ...prev, invoices, invoiceItems: items }
      }
      const id = createId('inv')
      const invoice = { ...payload, id, created_at: new Date().toISOString() }
      return { ...prev, invoices: [...current, invoice], invoiceItems: [...currentItems, ...lineItems.map(item => ({ ...item, invoice_id: id }))] }
    })
    setStatus(editingId ? `Invoice updated: ${vendorName}` : `Invoice saved locally: ${vendorName}`)
    clearForm()
  }
  function editInvoice(inv) {
    setEditingId(inv.id)
    setForm({ ...blankInvoice, ...inv })
    setLineItems((data.invoiceItems || []).filter(item => item.invoice_id === inv.id).map(item => ({ ...item })))
    setStatus(`Editing invoice: ${inv.vendor_name}`)
    requestAnimationFrame(() => document.querySelector('.invoice-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  function deleteInvoice(id) {
    setData(prev => ({ ...prev, invoices: (prev.invoices || []).filter(inv => inv.id !== id), invoiceItems: (prev.invoiceItems || []).filter(item => item.invoice_id !== id) }))
    if (editingId === id) clearForm()
    setStatus('Invoice deleted locally')
  }
  async function handleFile(file, mode = 'smart-ai') {
    if (!file) return
    try {
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
      const vendorMatch = vendors.find(v => norm(v.name) === norm(extracted.vendor_name))
      setForm(prev => ({ ...prev, ...blankInvoice, ...extracted, vendor_id: vendorMatch?.id || '', vendor_name: extracted.vendor_name || vendorMatch?.name || '', category: extracted.category || vendorMatch?.category || 'Food', total: money(extracted.total), status: 'Review', source: ext || mode, file_name: file.name || 'phone-capture' }))
      setLineItems((extracted.lineItems || []).map(item => ({ id: item.id || createId('item'), description: clean(item.description), qty: Number(item.qty || 1), unit_price: Number(item.unit_price || 0), total: Number(item.total || 0), category: item.category || extracted.category || 'Food' })))
    } catch (err) {
      setStatus(err.message || 'Invoice extraction failed. Enter manually or add Gemini API key.')
    } finally {
      if (localUploadRef.current) localUploadRef.current.value = ''
      if (aiUploadRef.current) aiUploadRef.current.value = ''
      if (phoneRef.current) phoneRef.current.value = ''
    }
  }

  return <>
    <div className="page-head employee-head">
      <div><h1>Invoices</h1><p>Upload invoices, review extracted data, and save clean vendor invoice history locally.</p></div>
      <div className="employee-head-actions">
        <div className="search-box"><Icon name="search" size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." /></div>

      </div>
    </div>
    <div className="status-pill">{status}</div>

    <section className="form-card tight-card invoice-form-card">
      <div className="invoice-toolbar">
        <div>
          <h2>{editingId ? 'Edit Invoice' : 'Invoice Review / Manual Entry'}</h2>
          <span className="ai-env-note">AI OCR uses Gemini from Settings / .env</span>
        </div>
        <div className="invoice-upload-actions">
          <label className="btn secondary file-action"><Icon name="upload" /> Local Upload<input ref={localUploadRef} type="file" accept=".csv,.xlsx,.xls" onChange={e => handleFile(e.target.files?.[0], 'local')} /></label>
          <label className="btn primary file-action"><Icon name="upload" /> Smart AI Upload<input ref={aiUploadRef} type="file" accept=".pdf,image/*" onChange={e => handleFile(e.target.files?.[0], 'smart-ai')} /></label>
          <label className="btn secondary file-action"><Icon name="camera" /> Camera Capture AI<input ref={phoneRef} type="file" accept="image/*" capture="environment" onChange={e => handleFile(e.target.files?.[0], 'phone')} /></label>
        </div>
      </div>
      <div className="employee-form-grid invoice-form-grid">
        <label>Vendor <span>*</span><select value={form.vendor_id} onChange={e => update('vendor_id', e.target.value)}><option value="">Select vendor</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label>Vendor name<input value={form.vendor_name} onChange={e => update('vendor_name', e.target.value)} placeholder="Vendor from invoice" /></label>
        <label>Invoice #<input value={form.invoice_number} onChange={e => update('invoice_number', e.target.value)} placeholder="Invoice number" /></label>
        <label>Date<input type="date" value={form.invoice_date} onChange={e => update('invoice_date', e.target.value)} /></label>
        <label>Category<select value={form.category} onChange={e => update('category', e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Total<input value={form.total} onChange={e => update('total', e.target.value)} placeholder="0.00" /></label>
        <label>Status<select value={form.status} onChange={e => update('status', e.target.value)}><option>Draft</option><option>Review</option><option>Approved</option><option>Paid</option></select></label>
        <label className="wide-2">Notes<input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Optional notes" /></label>
        <div className="form-actions-inline"><button className="btn secondary" onClick={clearForm}>Clear</button><button className="btn primary" onClick={saveInvoice}><Icon name="save" /> {editingId ? 'Save Changes' : 'Save Invoice'}</button></div>
      </div>
    </section>

    <section className="table-card compact-table-card invoice-items-card">
      <header><h2>Line Items</h2><span><button className="btn secondary small-btn" onClick={addLineItem}>Add Line</button></span></header>
      <table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th><th>Category</th><th>Action</th></tr></thead><tbody>{lineItems.map(item => <tr key={item.id}>
        <td><input className="line-input desc" value={item.description} onChange={e => updateLine(item.id, 'description', e.target.value)} /></td>
        <td><input className="line-input qty" value={item.qty} onChange={e => updateLine(item.id, 'qty', e.target.value)} /></td>
        <td><input className="line-input money" value={money(item.unit_price)} onChange={e => updateLine(item.id, 'unit_price', e.target.value)} /></td>
        <td><input className="line-input money" value={money(item.total)} onChange={e => updateLine(item.id, 'total', e.target.value)} /></td>
        <td><select className="line-select" value={item.category || form.category} onChange={e => updateLine(item.id, 'category', e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></td>
        <td className="row-actions"><button className="delete-link" onClick={() => removeLine(item.id)}>Remove</button></td>
      </tr>)}</tbody></table>
    </section>

    <section className="table-card compact-table-card employee-table-card">
      <header><h2>Invoice List</h2><span>{filtered.length} invoices · Local data</span></header>
      <table><thead><tr><th>Vendor</th><th>Invoice #</th><th>Date</th><th>Category</th><th>Total</th><th>Status</th><th>Source</th><th>Action</th></tr></thead><tbody>{filtered.map(inv => <tr key={inv.id}>
        <td><b>{inv.vendor_name}</b><small>{inv.notes || inv.file_name || 'No notes'}</small></td>
        <td>{inv.invoice_number || '-'}</td><td>{inv.invoice_date || '-'}</td><td><span className="tag neutral">{inv.category}</span></td><td>${money(inv.total)}</td><td><span className="tag cash">{inv.status}</span></td><td>{inv.source || 'Manual'}</td>
        <td className="row-actions"><button onClick={() => editInvoice(inv)}>Edit</button><button className="delete-link" onClick={() => deleteInvoice(inv.id)}>Delete</button></td>
      </tr>)}</tbody></table>
    </section>
  </>
}
