import React, { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import { createId } from '../lib/localStore'

function todayISO() { return new Date().toISOString().slice(0, 10) }
function money(value) { return Number(value || 0).toFixed(2) }
function amountNumber(value) { return Math.abs(Number(String(value ?? '').replace(/[$,()]/g, '')) || 0) }
function normalizeText(value) { return String(value || '').replace(/\s+/g, ' ').trim() }
function vendorKey(value) { return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function scrubSensitiveText(value) {
  return normalizeText(value)
    .replace(/\b(?:routing|account|acct|trace|micr|aba|id)\s*#?[-:]?\s*[A-Z0-9-]{4,}\b/ig, '')
    .replace(/#-?[A-Z0-9-]{6,}/ig, '')
    .replace(/\b\d{9,17}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
function safePayee(value) { return scrubSensitiveText(value).replace(/^(VENDOR PAY|PAYMENT|ACH Debit|DIRECT DBT|PURCHASE|TAX DEBIT)\s+/i, '').trim() }
function toISODate(value, fallbackYear = new Date().getFullYear()) {
  const raw = String(value || '').trim()
  const mmddyy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/)
  if (mmddyy) {
    const y = mmddyy[3] ? Number(mmddyy[3].length === 2 ? `20${mmddyy[3]}` : mmddyy[3]) : fallbackYear
    return `${y}-${String(mmddyy[1]).padStart(2, '0')}-${String(mmddyy[2]).padStart(2, '0')}`
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? todayISO() : parsed.toISOString().slice(0, 10)
}

function detectBank(text = '') {
  const t = text.toLowerCase()
  if (t.includes('unionstatebank') || t.includes('union state bank')) return 'Union State Bank'
  if (t.includes('valley bank') || t.includes('valley national bank')) return 'Valley Bank'
  if (t.includes('regions bank')) return 'Regions Bank'
  if (t.includes('bank of america')) return 'Bank of America'
  if (t.includes('wells fargo')) return 'Wells Fargo'
  if (t.includes('chase') || t.includes('jpmorgan')) return 'Chase'
  if (t.includes('truist')) return 'Truist'
  return 'Unknown Bank'
}

function inferCategory(payee, data) {
  const key = vendorKey(payee)
  const rules = data.bankPayeeRules || []
  const rule = rules.find(r => vendorKey(r.payee) === key || key.includes(vendorKey(r.payee)) || vendorKey(r.payee).includes(key))
  if (rule?.category) return rule.category
  const vendors = data.vendors || []
  const vendor = vendors.find(v => vendorKey(v.name) && (key.includes(vendorKey(v.name)) || vendorKey(v.name).includes(key)))
  if (vendor?.category) return vendor.category
  const text = key
  if (/us food|sysco|pfg|produce|restaurant depot|foodservice|food service/.test(text)) return 'Food'
  if (/buffalo rock|pepsi|coca cola|coke|beverage/.test(text)) return 'Beverage'
  if (/beer|wine|liquor|abc/.test(text)) return text.includes('beer') ? 'Beer' : text.includes('liquor') ? 'Liquor' : 'Beverage'
  if (/power|electric|alabama power|water|utility|utilities|gas/.test(text)) return 'Utilities'
  if (/sba|loan|eidl/.test(text)) return 'Loans'
  if (/account|bookkeep|horizon|cpa|payrolltax|dept of rev|tax/.test(text)) return text.includes('tax') ? 'Taxes' : 'Accounting Fees'
  if (/cintas|uniform|linen/.test(text)) return 'Supplies'
  if (/toast|shift4|merchant|processor|pos/.test(text)) return 'Merchant Fees'
  return 'Needs Review'
}

function findVendor(payee, data) {
  const key = vendorKey(payee)
  return (data.vendors || []).find(v => vendorKey(v.name) && (key.includes(vendorKey(v.name)) || vendorKey(v.name).includes(key)))
}

function findEmployee(payee, data) {
  const key = vendorKey(payee)
  return (data.employees || []).find(e => {
    const name = vendorKey(e.name || e.employee_name || `${e.first_name || ''} ${e.last_name || ''}`)
    return name && (key.includes(name) || name.includes(key))
  })
}

function statementYearFromText(text) {
  const m = String(text || '').match(/(?:Statement Dates|Date:)\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-])?(\d{2,4})/i)
  if (m) return Number(String(m[1]).length === 2 ? `20${m[1]}` : m[1])
  const any = String(text || '').match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-](\d{2,4})\b/)
  return any ? Number(String(any[1]).length === 2 ? `20${any[1]}` : any[1]) : new Date().getFullYear()
}

function daysBetween(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 999
  return Math.abs(Math.round((da - db) / 86400000))
}

function getExpensePayee(exp) {
  return exp.vendor || exp.manual_payee || exp.payee || exp.name || exp.description || ''
}

function scoreExistingMatch(row, exp) {
  const rowCheck = String(row.checkNumber || row.check_number || '').trim()
  const expCheck = String(exp.check_number || exp.checkNumber || exp.check || '').trim()
  const amountClose = Math.abs(amountNumber(exp.amount) - amountNumber(row.amount)) < 0.01
  const amountNear = Math.abs(amountNumber(exp.amount) - amountNumber(row.amount)) <= 2
  const diff = daysBetween(row.date, exp.date || exp.expense_date || exp.created_at)
  const rowPayee = vendorKey(row.payee || row.vendor || row.name)
  const expPayee = vendorKey(getExpensePayee(exp))
  const payeeSimilar = rowPayee && expPayee && (rowPayee.includes(expPayee.slice(0, 10)) || expPayee.includes(rowPayee.slice(0, 10)))
  const categorySimilar = row.category && exp.category && vendorKey(row.category) === vendorKey(exp.category)
  let score = 0
  const reasons = []
  if (rowCheck && expCheck && rowCheck === expCheck) { score += 55; reasons.push('same check number') }
  if (amountClose) { score += 25; reasons.push('same amount') }
  else if (amountNear) { score += 12; reasons.push('similar amount') }
  if (diff <= 1) { score += 15; reasons.push('date within 1 day') }
  else if (diff <= 7) { score += 10; reasons.push(`${diff} days apart`) }
  if (payeeSimilar) { score += 15; reasons.push('similar payee') }
  if (categorySimilar) { score += 5; reasons.push('same category') }
  return { score, reasons, dateDiff: diff, amountClose, checkMatch: Boolean(rowCheck && expCheck && rowCheck === expCheck), payeeSimilar }
}

function findExistingMatch(row, existing = []) {
  const ranked = existing
    .map(exp => ({ exp, ...scoreExistingMatch(row, exp) }))
    .filter(match => match.score >= 35)
    .sort((a, b) => b.score - a.score)
  const best = ranked[0]
  if (!best) return null
  const status = best.score >= 75 ? 'Exact Match' : 'Possible Match'
  return {
    id: best.exp.id,
    expense: best.exp,
    score: best.score,
    status,
    dateDiff: best.dateDiff,
    reasons: best.reasons,
    amount: amountNumber(best.exp.amount),
    payee: getExpensePayee(best.exp),
    date: best.exp.date || best.exp.expense_date || '',
    category: best.exp.category || '',
    checkNumber: best.exp.check_number || best.exp.checkNumber || '',
    source: best.exp.source || 'manual_expense'
  }
}

function parseUnionState(text, data) {
  const year = statementYearFromText(text)
  const lines = String(text || '').split(/\n+/).map(normalizeText).filter(Boolean)
  const out = []
  const seen = new Set()

  for (const line of lines) {
    let m = line.match(/^(\d{1,2}\/\d{1,2})\s+CHECK\s+(\d{3,8})\s+(\d{6,})\s+-?\$?([\d,]+\.\d{2})\b/i)
    if (m) {
      const date = toISODate(m[1], year)
      const checkNumber = m[2]
      const amount = amountNumber(m[4])
      const key = `${date}-${checkNumber}-${amount}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ id: createId('bankrow'), selected: true, date, checkNumber, payee: `Check ${checkNumber}`, amount, sourceType: 'paper_check', confidence: 88 })
      }
      continue
    }

    m = line.match(/^(\d{1,2}\/\d{1,2})\s+((?:VENDOR PAY|PAYMENT|ACH Debit|DIRECT DBT|PURCHASE|TAX DEBIT|SERVICE CHARGE|53D7C0719D)[^-]*?)\s+-\$?([\d,]+\.\d{2})\s+(?:AW|SC)?\b/i)
    if (m) {
      const date = toISODate(m[1], year)
      const description = normalizeText(m[2])
      const amount = amountNumber(m[3])
      let payee = safePayee(description)
        .replace(/\b\d{6,}\b.*$/g, '')
        .replace(/\b\d{2}\/\d{2}\/\d{2}\b.*$/g, '')
        .replace(/^(VENDOR PAY|PAYMENT|ACH Debit|DIRECT DBT|PURCHASE|TAX DEBIT)\s+/i, '')
        .replace(/\s+ID\b.*$/i, '')
        .trim()
      if (/US FOODSERVICE/i.test(description)) payee = 'US Foodservice'
      if (/BANK OF AMERICA/i.test(description)) payee = 'Bank of America'
      if (/HORIZON ACCOUNT/i.test(description)) payee = 'Horizon Accounting'
      if (/AL-DEPT OF REV|AL ONESPOT TAX/i.test(description)) payee = 'Alabama Dept of Revenue'
      if (/SBA EIDL/i.test(description)) payee = 'SBA EIDL Loan'
      if (/Toast, Inc/i.test(description)) payee = 'Toast Inc'
      if (/SHIFT4/i.test(description)) payee = 'Shift4'
      if (/CINTAS/i.test(description)) payee = 'Cintas Corporation'
      const key = `${date}-${payee}-${amount}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ id: createId('bankrow'), selected: true, date, checkNumber: '', payee, amount, memo: description, sourceType: 'electronic_debit', confidence: 96 })
      }
    }
  }
  return finalizeRows(out, data)
}

function parseGenericText(text, data) {
  const year = statementYearFromText(text)
  const lines = String(text || '').split(/\n+/).map(normalizeText).filter(Boolean)
  const out = []
  const seen = new Set()
  for (const line of lines) {
    const amountMatch = line.match(/-?\$?([\d,]+\.\d{2})\b/)
    if (!amountMatch) continue
    const dateMatch = line.match(/\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b/)
    if (!dateMatch) continue
    const isDebit = /\b(check|debit|withdrawal|payment|ach|purchase|fee|service charge|vendor pay)\b/i.test(line) || line.includes('-$')
    if (!isDebit) continue
    const check = line.match(/\b(?:check|chk|ck)\s*#?\s*(\d{3,8})\b/i)?.[1] || ''
    const amount = amountNumber(amountMatch[1])
    let payee = line
      .replace(dateMatch[0], '')
      .replace(amountMatch[0], '')
      .replace(/\b(?:check|chk|ck)\s*#?\s*\d{3,8}\b/i, '')
      .replace(/\b\d{6,}\b/g, '')
      .replace(/\b(debit|withdrawal|payment|ach|purchase|vendor pay)\b/ig, '')
      .trim()
    if (!payee) payee = check ? `Check ${check}` : 'Bank Transaction'
    const date = toISODate(dateMatch[0], year)
    const key = `${date}-${check}-${payee}-${amount}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push({ id: createId('bankrow'), selected: true, date, checkNumber: check, payee: safePayee(payee), amount, sourceType: check ? 'paper_check' : 'electronic_debit', confidence: check ? 82 : 76 })
    }
  }
  return finalizeRows(out, data)
}

function parseCsvText(text, data) {
  const rows = String(text || '').split(/\n+/).map(line => line.split(',').map(c => c.replace(/^"|"$/g, '').trim()))
  if (!rows.length) return []
  const header = rows[0].map(h => h.toLowerCase())
  const idx = (names) => header.findIndex(h => names.some(n => h.includes(n)))
  const dateIdx = idx(['date', 'posted'])
  const descIdx = idx(['description', 'payee', 'memo', 'name'])
  const amountIdx = idx(['amount', 'debit', 'withdrawal'])
  const checkIdx = idx(['check', 'number'])
  return finalizeRows(rows.slice(1).map(cols => ({
    id: createId('bankrow'),
    selected: true,
    date: toISODate(cols[dateIdx]),
    checkNumber: checkIdx >= 0 ? cols[checkIdx] : (cols[descIdx]?.match(/check\s*#?\s*(\d+)/i)?.[1] || ''),
    payee: safePayee(cols[descIdx]) || 'Bank Transaction',
    amount: amountNumber(cols[amountIdx]),
    sourceType: 'csv_import',
    confidence: 90
  })).filter(r => r.amount > 0), data)
}

function finalizeRows(rows, data) {
  return rows.map(row => {
    const vendor = findVendor(row.payee, data)
    const employee = findEmployee(row.payee, data)
    const category = employee ? 'Payroll' : inferCategory(row.payee, data)
    const enriched = {
      ...row,
      vendor: vendor?.name || '',
      vendorId: vendor?.id || '',
      employee: employee?.name || employee?.employee_name || '',
      employeeId: employee?.id || '',
      category,
    }
    const match = findExistingMatch(enriched, data.expenses || [])
    const matchStatus = match?.status || (category === 'Needs Review' ? 'Needs Review' : 'New Item')
    const action = match?.status === 'Exact Match' ? 'link_only' : match ? 'review' : 'import_new'
    return {
      ...enriched,
      existingMatch: match,
      matchStatus,
      selected: row.selected !== false,
      reconcileAction: row.reconcileAction || action,
      status: category === 'Needs Review' ? 'Needs Review' : 'Ready'
    }
  }).sort((a, b) => a.date.localeCompare(b.date) || String(a.checkNumber).localeCompare(String(b.checkNumber)))
}

async function readPdfText(file) {
  const pdfjs = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs'
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  let text = ''
  for (let p = 1; p <= pdf.numPages; p += 1) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join('\n')
    text += `\n--- PAGE ${p} ---\n${pageText}`
  }
  return { text, pages: pdf.numPages }
}

function getAiEngineStatus() {
  return { mode: 'Checking backend...', state: 'Unknown', provider: 'RestaPay AI service' }
}

async function getBackendHealth() {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) throw new Error('Backend unavailable')
    const json = await res.json()
    return json.aiConnected
      ? { mode: 'Gemini AI Document Extraction', state: 'Connected', provider: json.provider || 'Gemini' }
      : { mode: 'Backend Local Text Extraction', state: 'AI Offline', provider: json.provider || 'Local backend parser' }
  } catch {
    return { mode: 'Browser Local Text Extraction', state: 'Backend Offline', provider: 'Browser PDF/CSV parser' }
  }
}

async function analyzeWithBackend(file) {
  const form = new FormData()
  form.append('statement', file)
  const res = await fetch('/api/ai/check-processing/analyze', { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Backend analysis failed')
  }
  return res.json()
}


export default function BankStatements({ data, setData }) {
  const [bank, setBank] = useState('')
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [reviewId, setReviewId] = useState('')
  const [engineStatus, setEngineStatus] = useState(getAiEngineStatus())
  const [processing, setProcessing] = useState({ stage: 'Waiting for upload', progress: 0, pages: 0, found: 0, matched: 0, review: 0, duplicates: 0 })
  const [processingLog, setProcessingLog] = useState(['Waiting for statement upload'])
  const categories = Array.from(new Set([...(data.vendorCategories || []), ...(data.expenseCategories || []), 'Payroll', 'Merchant Fees', 'Taxes', 'Loans', 'Needs Review'])).filter(Boolean)

  useEffect(() => {
    let mounted = true
    getBackendHealth().then(status => { if (mounted) setEngineStatus(status) })
    return () => { mounted = false }
  }, [])

  const selectedRows = useMemo(() => rows.filter(r => r.selected && !['skip', 'keep_existing', 'review'].includes(r.reconcileAction) && r.category !== 'Needs Review'), [rows])
  const activeReview = useMemo(() => rows.find(r => r.id === reviewId) || rows[0] || null, [rows, reviewId])
  const totals = useMemo(() => ({
    extracted: rows.length,
    selected: selectedRows.length,
    amount: selectedRows.reduce((s, r) => s + amountNumber(r.amount), 0),
    duplicates: rows.filter(r => r.matchStatus === 'Exact Match' || r.matchStatus === 'Possible Match').length,
    review: rows.filter(r => r.category === 'Needs Review').length
  }), [rows, selectedRows])

  function addLog(entry) {
    setProcessingLog(prev => [entry, ...prev].slice(0, 10))
  }

  function updateProcessing(patch) {
    setProcessing(prev => ({ ...prev, ...patch }))
  }

  async function analyzeFile(file) {
    if (!file) return
    setBusy(true)
    setRows([])
    setReviewId('')
    setProcessingLog([])
    updateProcessing({ stage: 'Uploading to secure backend', progress: 8, pages: 0, found: 0, matched: 0, review: 0, duplicates: 0 })
    addLog(`File selected: ${file.name}`)

    try {
      const backendStatus = await getBackendHealth()
      setEngineStatus(backendStatus)
      addLog(`Backend status: ${backendStatus.state}`)
      updateProcessing({ stage: 'Backend analyzing statement', progress: 24 })
      setMessage(backendStatus.state === 'Connected'
        ? 'Gemini backend connected. Analyzing statement with privacy-safe extraction...'
        : 'Gemini key is not configured. Backend will use local privacy-safe text extraction fallback.')

      const result = await analyzeWithBackend(file)
      const finalized = finalizeRows((result.rows || []).map(row => ({
        ...row,
        id: row.id || createId('bankrow'),
        selected: row.selected !== false,
        checkNumber: row.checkNumber || row.check_number || '',
        sourceType: row.sourceType || 'paper_check',
      })), data)
      const matched = finalized.filter(r => r.vendor || r.employee).length
      const review = finalized.filter(r => r.category === 'Needs Review').length
      const duplicates = finalized.filter(r => r.matchStatus === 'Exact Match' || r.matchStatus === 'Possible Match').length
      setBank(result.bank || '')
      setRows(finalized)
      setReviewId(finalized[0]?.id || '')
      setRawText(result.safePreview || '')
      setEngineStatus(result.aiConnected
        ? { mode: result.engine || 'AI Document Extraction', state: 'Connected', provider: result.provider || 'Gemini backend' }
        : { mode: result.engine || 'Backend Local Text Extraction', state: 'AI Offline', provider: 'Backend parser' })
      updateProcessing({
        stage: finalized.length ? 'Ready for review' : 'No check rows found',
        progress: finalized.length ? 100 : 0,
        pages: result.stats?.pages || 0,
        found: finalized.length,
        matched,
        review,
        duplicates
      })
      addLog(`${result.bank || 'Bank'} detected`)
      addLog(`${result.stats?.pages || 0} pages processed by backend`)
      addLog(`${finalized.length} check/payment rows returned for review`)
      addLog(result.aiConnected ? 'Gemini completed extraction' : 'Gemini offline; backend fallback used')
      addLog('Privacy cleanup complete: account/routing/MICR/balances/signatures are not saved')
      setMessage(result.message || `${finalized.length} rows are ready for review.`)
      setBusy(false)
      return
    } catch (backendError) {
      console.warn('Backend analysis failed, falling back to browser parser:', backendError)
      addLog('Backend unavailable. Falling back to browser-only parser')
      setMessage('Backend AI service is unavailable. Falling back to browser local extraction only; check images cannot be read in this mode.')
    }

    const engine = { mode: 'Browser Local Text Extraction', state: 'Backend Offline', provider: 'Browser PDF/CSV parser' }
    setEngineStatus(engine)
    try {
      const name = file.name.toLowerCase()
      let text = ''
      let pages = 0
      if (name.endsWith('.pdf')) {
        addLog('Reading PDF text locally with PDF.js')
        updateProcessing({ stage: 'Reading PDF pages in browser', progress: 22 })
        const result = await readPdfText(file)
        text = result.text
        pages = result.pages
        addLog(`${pages} PDF pages read in browser`)
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        addLog('Reading Excel workbook')
        updateProcessing({ stage: 'Reading spreadsheet', progress: 28 })
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
        addLog('Spreadsheet converted to review text')
      } else {
        addLog('Reading text/CSV file')
        updateProcessing({ stage: 'Reading text file', progress: 28 })
        text = await file.text()
      }
      setRawText(text)
      updateProcessing({ pages, stage: 'Detecting bank', progress: 45 })
      addLog('Detecting bank and statement layout')
      analyzeText(text, { pages, engine })
    } catch (error) {
      console.error(error)
      updateProcessing({ stage: 'Extraction failed', progress: 0 })
      addLog('Extraction failed before review')
      setMessage('Could not read this file automatically. Paste statement text below, or use CSV/Excel export.')
    } finally {
      setBusy(false)
    }
  }

  function analyzeText(text = rawText, meta = {}) {
    const engine = meta.engine || engineStatus || getAiEngineStatus()
    setEngineStatus(engine)
    const detectedBank = detectBank(text)
    setBank(detectedBank)
    addLog(`${detectedBank} detected`)
    updateProcessing({ stage: 'Extracting check/debit rows', progress: 62, pages: meta.pages || processing.pages })
    const parsed = detectedBank === 'Union State Bank' ? parseUnionState(text, data) : parseGenericText(text, data)
    const matched = parsed.filter(r => r.vendor || r.employee).length
    const review = parsed.filter(r => r.category === 'Needs Review').length
    const duplicates = parsed.filter(r => r.matchStatus === 'Exact Match' || r.matchStatus === 'Possible Match').length
    setRows(parsed)
    setReviewId(parsed[0]?.id || '')
    updateProcessing({ stage: parsed.length ? 'Ready for review' : 'No check rows found', progress: parsed.length ? 100 : 0, found: parsed.length, matched, review, duplicates })
    if (parsed.length) {
      addLog(`${parsed.length} rows extracted for review`)
      addLog(`${matched} vendor/employee matches, ${review} need review, ${duplicates} possible matches`)
      addLog('Privacy cleanup complete: balances, account/routing/MICR/signatures are not saved')
    } else {
      addLog('No check/debit rows found')
    }
    setMessage(parsed.length ? `${detectedBank} detected. ${parsed.length} rows are ready for review. Engine: ${engine.mode}.` : 'No check/debit rows found. Try pasting Activity in Date Order text or uploading a CSV/Excel export.')
  }

  function updateRow(id, key, value) {
    setRows(prev => prev.map(row => row.id === id ? { ...row, [key]: value, status: key === 'category' && value !== 'Needs Review' ? 'Ready' : row.status } : row))
  }

  function toggleAll() { setRows(prev => prev.map(row => ({ ...row, selected: !prev.every(r => r.selected) }))) }

  function rememberRules(importedRows) {
    const existing = data.bankPayeeRules || []
    const next = [...existing]
    importedRows.forEach(row => {
      const payee = normalizeText(row.payee)
      if (!payee || row.category === 'Needs Review') return
      const idx = next.findIndex(rule => vendorKey(rule.payee) === vendorKey(payee))
      const rule = { id: idx >= 0 ? next[idx].id : createId('rule'), payee, category: row.category, vendor: row.vendor || '', employee: row.employee || '', updated_at: new Date().toISOString() }
      if (idx >= 0) next[idx] = rule
      else next.push(rule)
    })
    return next
  }

  function buildExpenseFromRow(row, extra = {}) {
    return {
      id: extra.id || createId('expense'),
      date: row.date,
      name: row.payee || `Check ${row.checkNumber}`,
      category: row.category,
      amount: amountNumber(row.amount),
      payment_method: row.checkNumber ? 'Check' : 'ACH',
      check_number: row.checkNumber || '',
      vendor: row.vendor || row.payee || '',
      vendor_id: row.vendorId || '',
      manual_payee: row.vendorId ? '' : (row.payee || ''),
      notes: row.checkNumber ? `Reconciled approved check ${row.checkNumber}` : 'Reconciled approved bank transaction',
      source: 'ai_check_reconciliation',
      bank_cleared_date: row.date,
      reconciliation_status: row.reconcileAction || 'import_new',
      matched_expense_id: row.existingMatch?.id || '',
      imported_at: new Date().toISOString(),
      ...extra
    }
  }

  function importSelected() {
    const toProcess = selectedRows
    if (!toProcess.length) {
      setMessage('Select at least one row with a category and choose Replace, Link, or Import New before saving.')
      return
    }

    let replaced = 0
    let linked = 0
    let imported = 0
    const newExpenses = []
    const replacedIds = new Set()
    const linkedIds = new Set()

    toProcess.forEach(row => {
      const action = row.reconcileAction || (row.existingMatch ? 'review' : 'import_new')
      if (action === 'skip' || action === 'keep_existing' || action === 'review') return
      const matchId = row.existingMatch?.id
      if ((action === 'replace_existing' || action === 'link_only') && matchId) {
        if (action === 'replace_existing') replacedIds.add(matchId)
        if (action === 'link_only') linkedIds.add(matchId)
      } else if (action === 'import_new') {
        newExpenses.push(buildExpenseFromRow(row))
      }
    })

    setData(prev => {
      const updatedExpenses = (prev.expenses || []).map(exp => {
        const replaceRow = toProcess.find(row => row.reconcileAction === 'replace_existing' && row.existingMatch?.id === exp.id)
        if (replaceRow) {
          replaced += 1
          return buildExpenseFromRow(replaceRow, {
            id: exp.id,
            created_at: exp.created_at,
            original_manual_date: exp.date || exp.expense_date || '',
            original_manual_amount: exp.amount,
            original_manual_payee: getExpensePayee(exp),
            notes: `${exp.notes ? `${exp.notes} | ` : ''}Replaced with approved bank/check extraction on ${todayISO()}`
          })
        }
        const linkRow = toProcess.find(row => row.reconcileAction === 'link_only' && row.existingMatch?.id === exp.id)
        if (linkRow) {
          linked += 1
          return {
            ...exp,
            bank_cleared_date: linkRow.date,
            check_number: exp.check_number || linkRow.checkNumber || '',
            reconciliation_status: 'linked_to_statement',
            matched_bank_payee: linkRow.payee,
            matched_bank_amount: amountNumber(linkRow.amount),
            reconciled_at: new Date().toISOString()
          }
        }
        return exp
      })
      imported = newExpenses.length
      return {
        ...prev,
        expenses: [...newExpenses, ...updatedExpenses],
        bankPayeeRules: rememberRules(toProcess.filter(row => row.reconcileAction !== 'skip' && row.reconcileAction !== 'keep_existing')),
        bankImports: [{
          id: createId('bankimport'),
          module: 'Bank Import Reconciliation',
          date: todayISO(),
          rows: toProcess.length,
          imported,
          replaced: replacedIds.size,
          linked: linkedIds.size,
          total: toProcess.reduce((s, r) => s + amountNumber(r.amount), 0),
          created_at: new Date().toISOString()
        }, ...(prev.bankImports || [])]
      }
    })

    setRows(prev => prev.map(row => toProcess.some(x => x.id === row.id)
      ? { ...row, selected: false, status: row.reconcileAction === 'replace_existing' ? 'Replaced' : row.reconcileAction === 'link_only' ? 'Linked' : row.reconcileAction === 'import_new' ? 'Imported' : row.status }
      : row))
    setMessage(`Reconciliation saved. ${newExpenses.length} imported as new. ${replacedIds.size} marked to replace existing. ${linkedIds.size} linked only. Nothing was changed without your approval.`)
  }

  return <>
    <section className="bank-hero card">
      <div>
        <h2>AI Check Processing</h2>
        <p>Upload bank statements or check files, review extracted check rows, and import selected payments only. Account numbers, routing numbers, MICR lines, balances, signatures, and original images are not saved.</p>
      </div>
      <div className="bank-badges"><span>Union State Bank</span><span>Valley Bank</span><span>Generic CSV / Excel</span></div>
    </section>

    <section className="card bank-upload-card">
      <header><h2>Upload Statement / Checks</h2><span className="inline-count">PDF / CSV / Excel / TXT</span></header>
      <div className="bank-upload-row">
        <label className="file-drop"><Icon name="upload" /><span>Choose statement or export</span><input type="file" accept=".pdf,.csv,.txt,.xlsx,.xls" onChange={e => analyzeFile(e.target.files?.[0])} /></label>
        <button className="btn primary" disabled={busy} onClick={() => analyzeText(rawText)}><Icon name="refresh" /> Analyze Text</button>
        <button className="btn ghost" onClick={() => { setRows([]); setRawText(''); setBank(''); setMessage(''); setProcessing({ stage: 'Waiting for upload', progress: 0, pages: 0, found: 0, matched: 0, review: 0, duplicates: 0 }); setProcessingLog(['Waiting for statement upload']) }}>Clear</button>
        {bank && <span className="tag green">{bank}</span>}
      </div>
      <textarea className="bank-textarea" value={rawText} onChange={e => setRawText(e.target.value)} placeholder="Optional: paste statement text here if PDF extraction is blocked..." />
      {message && <div className="bank-message">{message}</div>}
    </section>

    <section className="card ai-processing-center">
      <header>
        <div><span className="eyebrow">Processing Transparency</span><h2>AI Check Processing Center</h2></div>
        <span className={`engine-pill ${engineStatus.state === 'Connected' ? 'connected' : 'offline'}`}>{engineStatus.state}</span>
      </header>
      <div className="ai-processing-grid">
        <div className="engine-status-card">
          <span>Engine</span>
          <b>{engineStatus.mode}</b>
          <small>{engineStatus.provider}</small>
          <div className="progress-track"><i style={{ width: `${processing.progress}%` }} /></div>
          <em>{processing.stage}</em>
        </div>
        <div className="ai-stat-card"><span>Pages Read</span><b>{processing.pages}</b></div>
        <div className="ai-stat-card"><span>Rows Found</span><b>{processing.found}</b></div>
        <div className="ai-stat-card"><span>Matched</span><b>{processing.matched}</b></div>
        <div className="ai-stat-card warning"><span>Needs Review</span><b>{processing.review}</b></div>
        <div className="ai-stat-card danger"><span>Matches Found</span><b>{processing.duplicates}</b></div>
      </div>
      <div className="privacy-processing-grid">
        <div className="privacy-safe-card">
          <Icon name="shield" />
          <div><b>Privacy Protection Active</b><small>RestaPay saves only approved bookkeeping fields. Account/routing/MICR/signature/check images are discarded and not saved.</small></div>
        </div>
        <div className="processing-log-card">
          {processingLog.map((item, index) => <span key={`${item}-${index}`}>✓ {item}</span>)}
        </div>
      </div>
    </section>

    <div className="payroll-summary-row sales-summary-row stat-row-clean bank-summary-row">
      <div><span>Extracted Rows</span><b>{totals.extracted}</b></div>
      <div><span>Selected To Import</span><b>{totals.selected}</b></div>
      <div><span>Selected Total</span><b>${money(totals.amount)}</b></div>
      <div><span>Matches Found</span><b>{totals.duplicates}</b></div>
      <div><span>Needs Review</span><b>{totals.review}</b></div>
    </div>


    {activeReview && <section className="card check-review-workspace">
      <header><div><span className="eyebrow">AI Review Workspace</span><h2>Check Review</h2></div><span className="tag green">Privacy Safe</span></header>
      <div className="check-workspace-grid">
        <div className="check-preview-panel">
          <div className="check-preview-box">
            <Icon name="shield" size={34} />
            <b>Check image not stored</b>
            <small>The original PDF/check image is used only during processing. Account, routing, MICR, signatures, and balances are discarded before saving.</small>
          </div>
          <div className="privacy-list">
            <span>Not saved: account #</span><span>Not saved: routing #</span><span>Not saved: MICR</span><span>Not saved: signature</span>
          </div>
        </div>
        <div className="check-fields-panel">
          <div className="field-pair"><span>Check #</span><b>{activeReview.checkNumber || 'ACH / Debit'}</b></div>
          <label><span>Date</span><input type="date" value={activeReview.date} onChange={e => updateRow(activeReview.id, 'date', e.target.value)} /></label>
          <label><span>Payee</span><input value={activeReview.payee} onChange={e => updateRow(activeReview.id, 'payee', e.target.value)} /></label>
          <label><span>Amount</span><input value={activeReview.amount} onChange={e => updateRow(activeReview.id, 'amount', e.target.value)} /></label>
          <label><span>Category</span><select value={activeReview.category} onChange={e => updateRow(activeReview.id, 'category', e.target.value)}>{categories.map(cat => <option key={cat}>{cat}</option>)}</select></label>
          <div className="field-pair"><span>Match</span><b>{activeReview.existingMatch ? `${activeReview.matchStatus}: ${activeReview.existingMatch.payee}` : activeReview.employee ? `Employee: ${activeReview.employee}` : activeReview.vendor ? `Vendor: ${activeReview.vendor}` : 'New / Manual review'}</b></div><label><span>Approved Action</span><select value={activeReview.reconcileAction || 'review'} onChange={e => updateRow(activeReview.id, 'reconcileAction', e.target.value)}>{activeReview.existingMatch && <option value="review">Review First</option>}{activeReview.existingMatch && <option value="replace_existing">Replace Existing</option>}{activeReview.existingMatch && <option value="keep_existing">Keep Existing</option>}{activeReview.existingMatch && <option value="link_only">Link Only</option>}<option value="import_new">Import as New</option><option value="skip">Skip</option></select></label>
          <div className="check-actions"><button className="btn ghost" onClick={() => updateRow(activeReview.id, 'selected', false)}>Skip</button><button className="btn primary" onClick={() => updateRow(activeReview.id, 'selected', true)}>Approve Row</button></div>
        </div>
      </div>
    </section>}

    <section className="table-card compact-table-card bank-review-card reconciliation-card">
      <header className="table-header-actions">
        <div>
          <h2>Review Bank Import Reconciliation <span className="inline-count">{rows.length} rows</span></h2>
          <small>Possible matches are never disabled automatically. Choose what to do with each bank/check row.</small>
        </div>
        <div className="header-actions"><button className="btn ghost" onClick={toggleAll}>Select All</button><button className="btn primary" onClick={importSelected}><Icon name="save" /> Save Approved Actions</button></div>
      </header>
      <div className="table-scroll"><table className="sales-table bank-table reconciliation-table"><thead><tr><th><input type="checkbox" checked={rows.length > 0 && rows.every(r => r.selected)} onChange={toggleAll} /></th><th>Statement Row</th><th>Possible Existing Entry</th><th>Amount</th><th>Match Status</th><th>Approved Action</th><th>Category</th><th>Confidence</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.id} onClick={() => setReviewId(row.id)} className={`${row.matchStatus === 'Possible Match' ? 'possible-match-row' : ''} ${row.matchStatus === 'Exact Match' ? 'exact-match-row' : ''} ${activeReview?.id === row.id ? 'active-review-row' : ''}`}>
          <td><input type="checkbox" checked={row.selected} onChange={() => updateRow(row.id, 'selected', !row.selected)} /></td>
          <td>
            <div className="reconcile-main"><b>{row.payee || 'Unknown Payee'}</b>{row.checkNumber && <span className="mini-chip">Check #{row.checkNumber}</span>}</div>
            <small>{row.date} · Statement / Bank</small>
          </td>
          <td>
            {row.existingMatch ? <div className="existing-match-box"><b>{row.existingMatch.payee}</b><small>{row.existingMatch.date || 'No date'} · {row.existingMatch.category || 'No category'} · {row.existingMatch.source}</small><small>{row.existingMatch.reasons?.join(', ')}</small></div> : <small>No matching existing manual or invoice expense found</small>}
          </td>
          <td><b>${money(row.amount)}</b></td>
          <td>{row.matchStatus === 'Exact Match' ? <span className="tag green">Exact Match</span> : row.matchStatus === 'Possible Match' ? <span className="tag orange">Possible Match</span> : row.matchStatus === 'Needs Review' ? <span className="tag orange">Needs Review</span> : <span className="tag blue">New Item</span>}<small className="block-note">{row.existingMatch?.dateDiff <= 30 ? `${row.existingMatch.dateDiff} days apart` : row.matchStatus === 'New Item' ? 'Ready to import' : ''}</small></td>
          <td>
            <select className="inline-input action-select" value={row.reconcileAction || 'review'} onChange={e => updateRow(row.id, 'reconcileAction', e.target.value)}>
              {row.existingMatch && <option value="review">Review First</option>}
              {row.existingMatch && <option value="replace_existing">Replace Existing</option>}
              {row.existingMatch && <option value="keep_existing">Keep Existing</option>}
              {row.existingMatch && <option value="link_only">Link Only</option>}
              <option value="import_new">Import as New</option>
              <option value="skip">Skip</option>
            </select>
          </td>
          <td><select className="inline-input" value={row.category} onChange={e => updateRow(row.id, 'category', e.target.value)}>{categories.map(cat => <option key={cat}>{cat}</option>)}</select></td>
          <td><span className="confidence-pill">{row.confidence}%</span></td>
        </tr>)}
        {rows.length === 0 && <tr><td colSpan="8"><small>Upload a statement or paste statement text to begin. Nothing is saved until you approve an action.</small></td></tr>}
      </tbody></table></div>
      <div className="reconciliation-note"><Icon name="shield" size={17} /> We never automatically delete, disable, or replace entries. You approve each match because recurring payments can have the same amount.</div>
    </section>

    <section className="card bank-rules-card">
      <header><h2>Payee Category Memory <span className="inline-count">{(data.bankPayeeRules || []).length} rules</span></h2></header>
      <div className="rules-grid">
        {(data.bankPayeeRules || []).slice(0, 24).map(rule => <span key={rule.id} className="rule-chip"><b>{rule.payee}</b><small>{rule.category}</small></span>)}
        {(data.bankPayeeRules || []).length === 0 && <small>No saved rules yet. Import reviewed rows and RestaPay will remember payee categories next time.</small>}
      </div>
    </section>
  </>
}
