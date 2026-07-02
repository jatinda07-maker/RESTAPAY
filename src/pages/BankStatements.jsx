import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import { createId } from '../lib/localStore'

function todayISO() { return new Date().toISOString().slice(0, 10) }
function money(value) { return Number(value || 0).toFixed(2) }
function amountNumber(value) { return Math.abs(Number(String(value ?? '').replace(/[$,()]/g, '')) || 0) }
function normalizeText(value) { return String(value || '').replace(/\s+/g, ' ').trim() }
function vendorKey(value) { return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
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

function isDuplicate(row, existing = []) {
  const rowCheck = String(row.checkNumber || row.check_number || '').trim()
  const rowPayee = vendorKey(row.payee || row.vendor || row.name)
  return existing.some(exp => {
    const expCheck = String(exp.check_number || exp.checkNumber || '').trim()
    const amountClose = Math.abs(amountNumber(exp.amount) - amountNumber(row.amount)) < 0.01
    const sameDate = String(exp.date || exp.expense_date || '') === row.date
    const samePayee = rowPayee && vendorKey(exp.vendor || exp.manual_payee || exp.name).includes(rowPayee.slice(0, 12))
    return amountClose && (rowCheck && expCheck ? rowCheck === expCheck : sameDate && samePayee)
  })
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
      let payee = description
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
      out.push({ id: createId('bankrow'), selected: true, date, checkNumber: check, payee, amount, sourceType: check ? 'paper_check' : 'electronic_debit', confidence: check ? 82 : 76 })
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
    payee: cols[descIdx] || 'Bank Transaction',
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
    return {
      ...row,
      vendor: vendor?.name || '',
      vendorId: vendor?.id || '',
      employee: employee?.name || employee?.employee_name || '',
      employeeId: employee?.id || '',
      category,
      duplicate: isDuplicate(row, data.expenses || []),
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
  return text
}

export default function BankStatements({ data, setData }) {
  const [bank, setBank] = useState('')
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const categories = Array.from(new Set([...(data.vendorCategories || []), ...(data.expenseCategories || []), 'Payroll', 'Merchant Fees', 'Taxes', 'Loans', 'Needs Review'])).filter(Boolean)

  const selectedRows = useMemo(() => rows.filter(r => r.selected && !r.duplicate), [rows])
  const totals = useMemo(() => ({
    extracted: rows.length,
    selected: selectedRows.length,
    amount: selectedRows.reduce((s, r) => s + amountNumber(r.amount), 0),
    duplicates: rows.filter(r => r.duplicate).length,
    review: rows.filter(r => r.category === 'Needs Review').length
  }), [rows, selectedRows])

  async function analyzeFile(file) {
    if (!file) return
    setBusy(true)
    setMessage('Reading statement locally in your browser...')
    try {
      const name = file.name.toLowerCase()
      let text = ''
      if (name.endsWith('.pdf')) {
        text = await readPdfText(file)
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
      } else {
        text = await file.text()
      }
      setRawText(text)
      analyzeText(text)
    } catch (error) {
      console.error(error)
      setMessage('Could not read this file automatically. Paste statement text below, or use CSV/Excel export. PDF reading uses local browser PDF.js and may be blocked if offline.')
    } finally {
      setBusy(false)
    }
  }

  function analyzeText(text = rawText) {
    const detectedBank = detectBank(text)
    setBank(detectedBank)
    const parsed = detectedBank === 'Union State Bank' ? parseUnionState(text, data) : parseGenericText(text, data)
    setRows(parsed)
    setMessage(parsed.length ? `${detectedBank} detected. ${parsed.length} debit/check rows found for review.` : 'No check/debit rows found. Try pasting Activity in Date Order text or uploading a CSV/Excel export.')
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

  function importSelected() {
    const toImport = selectedRows.filter(row => row.category !== 'Needs Review')
    if (!toImport.length) {
      setMessage('Select at least one non-duplicate row with a category before importing.')
      return
    }
    const expenses = toImport.map(row => ({
      id: createId('expense'),
      date: row.date,
      name: row.payee || `Check ${row.checkNumber}`,
      category: row.category,
      amount: amountNumber(row.amount),
      payment_method: row.checkNumber ? 'Check' : 'ACH',
      check_number: row.checkNumber || '',
      vendor: row.vendor || row.payee || '',
      vendor_id: row.vendorId || '',
      manual_payee: row.vendorId ? '' : (row.payee || ''),
      notes: `Imported from ${bank || 'bank statement'}${row.memo ? ` — ${row.memo}` : ''}`,
      source: 'bank_statement_import',
      bank_name: bank,
      imported_at: new Date().toISOString()
    }))
    setData(prev => ({
      ...prev,
      expenses: [...expenses, ...(prev.expenses || [])],
      bankPayeeRules: rememberRules(toImport),
      bankImports: [{ id: createId('bankimport'), bank, date: todayISO(), rows: toImport.length, total: toImport.reduce((s, r) => s + amountNumber(r.amount), 0), created_at: new Date().toISOString() }, ...(prev.bankImports || [])]
    }))
    setRows(prev => prev.map(row => toImport.some(x => x.id === row.id) ? { ...row, selected: false, duplicate: true, status: 'Imported' } : row))
    setMessage(`${toImport.length} selected bank transactions imported into Expenses. Payee category memory updated.`)
  }

  return <>
    <section className="bank-hero card">
      <div>
        <h2>AI Bank Statement Import</h2>
        <p>Supports Union State Bank and Valley Bank style statements. PDF text is read locally in the browser; only reviewed payee, check number, date, amount, and category are saved.</p>
      </div>
      <div className="bank-badges"><span>Union State Bank</span><span>Valley Bank</span><span>Generic CSV / Excel</span></div>
    </section>

    <section className="card bank-upload-card">
      <header><h2>Upload Statement</h2><span className="inline-count">PDF / CSV / Excel / TXT</span></header>
      <div className="bank-upload-row">
        <label className="file-drop"><Icon name="upload" /><span>Choose bank statement</span><input type="file" accept=".pdf,.csv,.txt,.xlsx,.xls" onChange={e => analyzeFile(e.target.files?.[0])} /></label>
        <button className="btn primary" disabled={busy} onClick={() => analyzeText(rawText)}><Icon name="refresh" /> Analyze Text</button>
        <button className="btn ghost" onClick={() => { setRows([]); setRawText(''); setBank(''); setMessage('') }}>Clear</button>
        {bank && <span className="tag green">{bank}</span>}
      </div>
      <textarea className="bank-textarea" value={rawText} onChange={e => setRawText(e.target.value)} placeholder="Optional: paste statement text here if PDF extraction is blocked..." />
      {message && <div className="bank-message">{message}</div>}
    </section>

    <div className="payroll-summary-row sales-summary-row stat-row-clean bank-summary-row">
      <div><span>Extracted Rows</span><b>{totals.extracted}</b></div>
      <div><span>Selected To Import</span><b>{totals.selected}</b></div>
      <div><span>Selected Total</span><b>${money(totals.amount)}</b></div>
      <div><span>Duplicates</span><b>{totals.duplicates}</b></div>
      <div><span>Needs Review</span><b>{totals.review}</b></div>
    </div>

    <section className="table-card compact-table-card bank-review-card">
      <header className="table-header-actions">
        <h2>Review Bank Transactions <span className="inline-count">{rows.length} rows</span></h2>
        <div className="header-actions"><button className="btn ghost" onClick={toggleAll}>Select All</button><button className="btn primary" onClick={importSelected}><Icon name="save" /> Import Selected</button></div>
      </header>
      <div className="table-scroll"><table className="sales-table bank-table"><thead><tr><th><input type="checkbox" checked={rows.length > 0 && rows.every(r => r.selected)} onChange={toggleAll} /></th><th>Date</th><th>Check #</th><th>Payee / Memo</th><th>Amount</th><th>Category</th><th>Vendor / Employee</th><th>Status</th><th>Confidence</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.id} className={row.duplicate ? 'duplicate-row' : ''}>
          <td><input type="checkbox" checked={row.selected} disabled={row.duplicate} onChange={() => updateRow(row.id, 'selected', !row.selected)} /></td>
          <td><input className="inline-input small" type="date" value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} /></td>
          <td><input className="inline-input tiny" value={row.checkNumber} onChange={e => updateRow(row.id, 'checkNumber', e.target.value)} placeholder="ACH" /></td>
          <td><input className="inline-input payee" value={row.payee} onChange={e => updateRow(row.id, 'payee', e.target.value)} /></td>
          <td><b>${money(row.amount)}</b></td>
          <td><select className="inline-input" value={row.category} onChange={e => updateRow(row.id, 'category', e.target.value)}>{categories.map(cat => <option key={cat}>{cat}</option>)}</select></td>
          <td><small>{row.employee ? `Employee: ${row.employee}` : row.vendor ? `Vendor: ${row.vendor}` : 'Manual / One-time'}</small></td>
          <td>{row.duplicate ? <span className="tag red">Duplicate</span> : row.status === 'Needs Review' ? <span className="tag orange">Needs Review</span> : row.status === 'Imported' ? <span className="tag green">Imported</span> : <span className="tag green">Ready</span>}</td>
          <td><span className="confidence-pill">{row.confidence}%</span></td>
        </tr>)}
        {rows.length === 0 && <tr><td colSpan="9"><small>Upload a statement or paste statement text to begin. Nothing is saved until you import selected rows.</small></td></tr>}
      </tbody></table></div>
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
