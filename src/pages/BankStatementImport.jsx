import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import { createId } from '../lib/localStore'

function todayISO() { return new Date().toISOString().slice(0, 10) }
function money(value) { return Number(value || 0).toFixed(2) }
function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.abs(value) : 0
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const isNegative = /\(|-|debit/i.test(raw)
  const cleaned = raw.replace(/[$,]/g, '').replace(/[()]/g, '').replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return 0
  return Math.abs(parsed) || (isNegative ? Math.abs(parsed) : parsed)
}
function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim() }
function norm(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function headerKey(value) { return norm(value).replace(/ /g, '_') }
function formatExcelDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'number' && value > 20000) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  const text = clean(value)
  if (!text) return todayISO()
  const date = new Date(text)
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  const m = text.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/)
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : new Date().getFullYear()
    return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
  }
  return todayISO()
}
function parseCSV(text) {
  const rows = []
  let current = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue }
    if (ch === '"') { quoted = !quoted; continue }
    if (ch === ',' && !quoted) { current.push(cell); cell = ''; continue }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++
      current.push(cell)
      if (current.some(v => clean(v))) rows.push(current)
      current = []
      cell = ''
      continue
    }
    cell += ch
  }
  current.push(cell)
  if (current.some(v => clean(v))) rows.push(current)
  return rows
}
function valueFrom(row, keys) {
  for (const key of keys) {
    const found = Object.keys(row).find(k => k === key || k.includes(key) || key.includes(k))
    if (found && clean(row[found])) return row[found]
  }
  return ''
}
function rowsFromTable(table) {
  if (!table.length) return []
  const headers = table[0].map(headerKey)
  return table.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h || `col_${i}`, row[i] ?? ''])))
}
function parseTextLines(text) {
  return text.split(/\r?\n/).map(clean).filter(Boolean).map(line => {
    const date = line.match(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/)?.[0] || ''
    const check = line.match(/(?:check|chk|ck|#)\s*#?\s*(\d{3,})/i)?.[1] || line.match(/\b(\d{4,})\b/)?.[1] || ''
    const amountMatches = [...line.matchAll(/\$?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?/g)].map(m => m[0])
    const amount = amountMatches[amountMatches.length - 1] || ''
    let payee = line.replace(date, '').replace(amount, '').replace(new RegExp(`\\b${check}\\b`), '').replace(/check|chk|ck|#/ig, '')
    return { date, check_number: check, payee: clean(payee), amount, raw: line }
  })
}
function rowToCheck(row, index, fileName) {
  const description = clean(valueFrom(row, ['payee', 'description', 'memo', 'name', 'transaction_description', 'details']))
  const checkText = clean(valueFrom(row, ['check_number', 'check_no', 'check', 'check_num', 'serial_number', 'number', 'ref', 'reference']))
  const dateValue = valueFrom(row, ['date', 'posted_date', 'post_date', 'transaction_date', 'check_date'])
  const debit = valueFrom(row, ['debit', 'withdrawal', 'withdrawals', 'payment', 'paid_out'])
  const amountValue = debit || valueFrom(row, ['amount', 'transaction_amount'])
  const looksLikeCheck = /\b(check|chk|ck)\b/i.test(`${description} ${checkText} ${row.raw || ''}`) || Boolean(checkText)
  if (!looksLikeCheck && !description) return null
  const amount = num(amountValue)
  if (!amount) return null
  return {
    id: createId('bankcheck'),
    selected: true,
    date: formatExcelDate(dateValue),
    check_number: checkText.replace(/[^0-9A-Za-z-]/g, ''),
    payee: description.replace(/\b(check|chk|ck)\b\s*#?\s*\d*/ig, '').trim() || 'Unknown Payee',
    amount,
    category: 'Needs Review',
    vendor: '',
    memo: clean(row.raw || ''),
    status: 'New',
    source_file: fileName,
    row_index: index + 1
  }
}
function makeRuleKey(payee) { return norm(payee).slice(0, 80) }
function duplicateKey(row) { return [row.check_number, row.date, money(row.amount), norm(row.payee)].join('|') }

export default function BankStatementImport({ data, setData }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('Upload a bank CSV, Excel export, or pasted statement text. PDF/image OCR can be processed locally once OCR is connected.')
  const [pasteText, setPasteText] = useState('')
  const [search, setSearch] = useState('')
  const categories = (data.vendorCategories?.length ? data.vendorCategories : data.expenseCategories?.length ? data.expenseCategories : ['Food', 'Beverage', 'Beer', 'Liquor', 'Utilities', 'Insurance', 'Supplies', 'Maintenance', 'Other']).slice().sort((a, b) => a.localeCompare(b))
  const vendors = data.vendors || []
  const rules = data.bankCheckRules || []

  const duplicateSet = useMemo(() => new Set((data.expenses || []).map(expense => duplicateKey({
    check_number: expense.check_number || '',
    date: expense.date || expense.expense_date || '',
    amount: expense.amount || 0,
    payee: expense.vendor || expense.name || ''
  }))), [data.expenses])

  function applySuggestions(nextRows) {
    return nextRows.map(row => {
      const payeeNorm = norm(row.payee)
      const rule = rules.find(item => payeeNorm.includes(norm(item.payee)) || norm(item.payee).includes(payeeNorm))
      const vendor = vendors.find(v => payeeNorm.includes(norm(v.name)) || norm(v.name).includes(payeeNorm))
      const suggestedCategory = rule?.category || vendor?.category || row.category || 'Needs Review'
      const suggestedVendor = rule?.vendor || vendor?.name || row.payee
      const duplicate = duplicateSet.has(duplicateKey({ ...row, payee: suggestedVendor })) || duplicateSet.has(duplicateKey(row))
      return { ...row, category: suggestedCategory, vendor: suggestedVendor, status: duplicate ? 'Duplicate' : (suggestedCategory === 'Needs Review' ? 'Needs Review' : 'Ready') }
    })
  }

  async function handleFile(file) {
    if (!file) return
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let parsedRows = []
      if (['xlsx', 'xls'].includes(ext)) {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const table = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        parsedRows = rowsFromTable(table).map((row, i) => rowToCheck(row, i, file.name)).filter(Boolean)
      } else if (['csv', 'txt'].includes(ext)) {
        const text = await file.text()
        const table = ext === 'csv' ? parseCSV(text) : []
        parsedRows = ext === 'csv'
          ? rowsFromTable(table).map((row, i) => rowToCheck(row, i, file.name)).filter(Boolean)
          : parseTextLines(text).map((row, i) => rowToCheck(row, i, file.name)).filter(Boolean)
      } else {
        setStatus('PDF/image OCR is privacy-safe but needs the local OCR package wired next. For now, export statement as CSV/Excel or paste the check text below.')
        return
      }
      const suggested = applySuggestions(parsedRows)
      setRows(suggested)
      setStatus(`Extracted ${suggested.length} possible check payments from ${file.name}. Review before saving.`)
    } catch (error) {
      console.error(error)
      setStatus('Could not read that file. Try a bank CSV/Excel export or paste the statement text.')
    }
  }

  function parsePastedText() {
    const parsed = parseTextLines(pasteText).map((row, i) => rowToCheck(row, i, 'pasted-statement-text')).filter(Boolean)
    const suggested = applySuggestions(parsed)
    setRows(suggested)
    setStatus(`Extracted ${suggested.length} possible check payments from pasted text. Review before saving.`)
  }

  function updateRow(id, field, value) {
    setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: field === 'amount' ? num(value) : value, status: field === 'selected' ? row.status : 'Ready' } : row))
  }
  function toggleAll() {
    const allSelected = rows.length > 0 && rows.every(row => row.selected)
    setRows(prev => prev.map(row => ({ ...row, selected: !allSelected })))
  }
  function clearRows() { setRows([]); setPasteText(''); setStatus('Import workspace cleared. Upload the next bank export when ready.') }

  const filtered = useMemo(() => rows.filter(row => {
    const q = norm(search)
    if (!q) return true
    return [row.date, row.check_number, row.payee, row.vendor, row.category, row.status, row.amount].join(' ').toLowerCase().includes(q)
  }), [rows, search])
  const selectedRows = rows.filter(row => row.selected && row.status !== 'Duplicate')
  const totals = useMemo(() => ({
    selected: selectedRows.reduce((sum, row) => sum + num(row.amount), 0),
    duplicate: rows.filter(row => row.status === 'Duplicate').length,
    needsReview: rows.filter(row => row.category === 'Needs Review' || row.status === 'Needs Review').length
  }), [rows, selectedRows])

  function importSelected() {
    if (!selectedRows.length) return setStatus('Select at least one non-duplicate check to import.')
    const now = new Date().toISOString()
    const newExpenses = selectedRows.map(row => ({
      id: createId('expense'),
      date: row.date || todayISO(),
      name: row.vendor || row.payee || 'Bank check payment',
      vendor: row.vendor || row.payee || '',
      category: row.category === 'Needs Review' ? 'Other' : row.category,
      payment_method: 'Check',
      check_number: row.check_number || '',
      amount: num(row.amount),
      notes: `Imported from bank statement${row.memo ? ` — ${row.memo}` : ''}`,
      source: 'bank-statement-import',
      source_file: row.source_file,
      created_at: now,
      updated_at: now
    }))

    const newRules = selectedRows
      .filter(row => row.payee && row.category && row.category !== 'Needs Review')
      .map(row => ({ id: makeRuleKey(row.payee), payee: row.payee, vendor: row.vendor || row.payee, category: row.category, updated_at: now }))

    setData(prev => {
      const existingRules = prev.bankCheckRules || []
      const mergedRules = [...existingRules]
      newRules.forEach(rule => {
        const idx = mergedRules.findIndex(item => item.id === rule.id || norm(item.payee) === norm(rule.payee))
        if (idx >= 0) mergedRules[idx] = { ...mergedRules[idx], ...rule }
        else mergedRules.push(rule)
      })
      return {
        ...prev,
        expenses: [...newExpenses, ...(prev.expenses || [])],
        bankCheckRules: mergedRules,
        bankImports: [{ id: createId('bankimport'), created_at: now, row_count: newExpenses.length, total: selectedRows.reduce((sum, row) => sum + num(row.amount), 0), source_file: selectedRows[0]?.source_file || 'bank statement' }, ...(prev.bankImports || [])]
      }
    })
    setRows(prev => prev.filter(row => !selectedRows.some(saved => saved.id === row.id)))
    setStatus(`Imported ${newExpenses.length} checks into Expenses and updated payee category memory.`)
  }

  return <>
    <div className="page-head bank-import-head">
      <div>
        <h1>Bank Statement Check Import</h1>
        <p>Extract checks for review without saving account numbers, routing numbers, balances, deposits, or login information.</p>
      </div>
      <div className="employee-head-actions">
        <button className="btn primary" onClick={importSelected}><Icon name="save" /> Import Selected</button>
        <button className="btn ghost" onClick={clearRows}>Clear Workspace</button>
      </div>
    </div>

    <section className="bank-import-grid">
      <div className="card bank-upload-card tight-card">
        <header><h2>1. Upload statement export</h2><span>CSV / Excel now · local OCR ready next</span></header>
        <label className="upload-drop">
          <Icon name="upload" size={28} />
          <strong>Choose bank CSV or Excel file</strong>
          <small>Only check-related fields are kept after review.</small>
          <input type="file" accept=".csv,.txt,.xlsx,.xls,.pdf,.png,.jpg,.jpeg" onChange={e => handleFile(e.target.files?.[0])} />
        </label>
        <div className="privacy-list">
          <span><Icon name="shield" size={15} /> Account/routing ignored</span>
          <span><Icon name="shield" size={15} /> Balances not saved</span>
          <span><Icon name="shield" size={15} /> Review before import</span>
        </div>
      </div>

      <div className="card bank-upload-card tight-card">
        <header><h2>2. Paste statement text</h2><span>Useful for PDF statements</span></header>
        <textarea className="bank-paste-box" value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Paste check lines here, for example: 07/01/2026 Check #1052 Sysco 1,254.32" />
        <div className="form-action-footer compact-footer"><button className="btn secondary" onClick={parsePastedText}>Extract From Text</button></div>
      </div>

      <div className="card bank-summary-card tight-card">
        <header><h2>Review Summary</h2><span>{rows.length} extracted rows</span></header>
        <div className="bank-summary-metrics">
          <div><span>Selected</span><b>${money(totals.selected)}</b></div>
          <div><span>Needs Review</span><b>{totals.needsReview}</b></div>
          <div><span>Duplicates</span><b>{totals.duplicate}</b></div>
        </div>
        <p className="bank-status">{status}</p>
      </div>
    </section>

    <div className="sales-filter-bar bank-review-toolbar">
      <div className="search-box range-search"><Icon name="search" size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search extracted checks, payee, amount, category..." /></div>
      <button className="btn ghost" onClick={toggleAll}>{rows.every(row => row.selected) ? 'Unselect All' : 'Select All'}</button>
      <button className="btn primary" onClick={importSelected}><Icon name="save" /> Import Selected</button>
    </div>

    <section className="table-card compact-table-card bank-review-card">
      <header><h2>Review Checks Before Saving <span className="inline-count">{filtered.length} visible</span></h2><span>Change category once and RestaPay remembers it next time.</span></header>
      <div className="table-scroll"><table className="sales-table bank-review-table"><thead><tr><th><input type="checkbox" checked={rows.length > 0 && rows.every(row => row.selected)} onChange={toggleAll} /></th><th>Date</th><th>Check #</th><th>Payee</th><th>Amount</th><th>Vendor</th><th>Category</th><th>Status</th></tr></thead><tbody>
        {filtered.map(row => <tr key={row.id} className={row.status === 'Duplicate' ? 'duplicate-row' : ''}>
          <td><input type="checkbox" checked={row.selected} disabled={row.status === 'Duplicate'} onChange={e => updateRow(row.id, 'selected', e.target.checked)} /></td>
          <td><input className="table-input" type="date" value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} /></td>
          <td><input className="table-input check-input" value={row.check_number} onChange={e => updateRow(row.id, 'check_number', e.target.value)} placeholder="Check #" /></td>
          <td><input className="table-input payee-input" value={row.payee} onChange={e => updateRow(row.id, 'payee', e.target.value)} /></td>
          <td><input className="table-input amount-input" type="number" step="0.01" value={row.amount} onChange={e => updateRow(row.id, 'amount', e.target.value)} /></td>
          <td><input className="table-input payee-input" value={row.vendor} onChange={e => updateRow(row.id, 'vendor', e.target.value)} placeholder="Vendor / payee" /></td>
          <td><select className="table-input" value={row.category} onChange={e => updateRow(row.id, 'category', e.target.value)}><option>Needs Review</option>{categories.map(cat => <option key={cat}>{cat}</option>)}</select></td>
          <td><span className={`tag ${row.status === 'Duplicate' ? 'red' : row.status === 'Needs Review' ? 'neutral' : 'cash'}`}>{row.status}</span></td>
        </tr>)}
        {filtered.length === 0 && <tr><td colSpan="8"><small>No extracted checks yet. Upload a CSV/Excel bank export or paste statement text above.</small></td></tr>}
      </tbody></table></div>
    </section>

    <section className="table-card compact-table-card bank-memory-card">
      <header><h2>Payee Category Memory</h2><span>{rules.length} saved rules</span></header>
      <div className="chip-row">{rules.length ? rules.map(rule => <span key={rule.id || rule.payee} className="chip memory-chip"><Icon name="shield" size={14} /> {rule.payee} → {rule.category}</span>) : <small>No saved payee rules yet. Import checks with categories to teach RestaPay.</small>}</div>
    </section>
  </>
}
