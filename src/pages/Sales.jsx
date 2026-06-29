import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import { createId } from '../lib/localStore'

function today() { return new Date().toISOString().slice(0, 10) }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }
function startOfWeekISO(date = new Date()) { const d = new Date(date); const day = d.getDay(); d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10) }
function startOfMonthISO(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10) }
function endOfMonthISO(date = new Date()) { return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10) }
function money(value) { return Number(value || 0).toFixed(2) }
function num(value) {
  if (typeof value === 'number') return value
  const text = String(value ?? '').replace(/[$,%]/g, '').trim()
  if (!text) return 0
  if (/^\(.+\)$/.test(text)) return -Number(text.replace(/[()]/g, '')) || 0
  return Number(text) || 0
}
function round2(value) { return Number(money(value)) }
function normKey(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function findValue(row, keys) {
  const mapped = Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [normKey(k), v]))
  for (const key of keys) {
    const value = mapped[normKey(key)]
    if (value !== undefined && value !== '') return value
  }
  return ''
}
function formatDate(value) {
  if (!value) return today()
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') {
    if (/^\d{8}$/.test(String(Math.trunc(value)))) {
      const text = String(Math.trunc(value))
      return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
    }
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  const text = String(value).trim()
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  const date = new Date(text)
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  const match = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (match) {
    const [, m, d, y] = match
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return today()
}
function compactRows(rows) {
  return rows.filter(row => Object.values(row || {}).some(value => String(value ?? '').trim() !== ''))
}
function sheetMatrix(workbook, name) {
  const sheet = workbook.Sheets[name]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
}
function sheetObjects(workbook, name) {
  const sheet = workbook.Sheets[name]
  if (!sheet) return []
  return compactRows(XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }))
}
function headerValueRow(workbook, name) {
  const rows = sheetMatrix(workbook, name)
  const header = rows[0] || []
  const values = rows[1] || []
  const obj = {}
  header.forEach((key, index) => { if (key !== '') obj[key] = values[index] })
  return obj
}
function firstRowValue(workbook, sheetName, label, fallback = 0) {
  const obj = headerValueRow(workbook, sheetName)
  const value = findValue(obj, [label])
  return value === '' ? fallback : value
}
function paymentAmount(rows, type, subType = '') {
  const normalizedType = normKey(type)
  const normalizedSub = normKey(subType)
  const found = rows.find(row => normKey(row['Payment type']) === normalizedType && (!subType || normKey(row['Payment sub type']) === normalizedSub))
  return round2(num(found?.Amount))
}
function absMoney(value) { return round2(Math.abs(num(value))) }
function cents(value) { return Math.round(num(value) * 100) }
function distributeMoney(total, weights) {
  const totalCents = cents(total)
  const sumWeights = weights.reduce((acc, value) => acc + Math.max(num(value), 0), 0)
  if (!sumWeights || !weights.length) return weights.map(() => 0)
  let used = 0
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return round2((totalCents - used) / 100)
    const share = Math.round((Math.max(num(weight), 0) / sumWeights) * totalCents)
    used += share
    return round2(share / 100)
  })
}
function extractRangeFromFileName(fileName) {
  const match = String(fileName || '').match(/(\d{4})[-_ ]?(\d{2})[-_ ]?(\d{2}).*?(\d{4})[-_ ]?(\d{2})[-_ ]?(\d{2})/)
  if (!match) return ''
  return `${match[1]}-${match[2]}-${match[3]} to ${match[4]}-${match[5]}-${match[6]}`
}

function shortNote(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text
    .replace('Toast range ', 'Toast ')
    .replace('; daily payments/tips allocated from weekly totals', '')
    .replace('Toast daily row; payments/tips allocated from summary totals', 'Toast daily allocation')
}

function displayMoney(value) {
  return `$${money(value)}`
}
function makeEmptySalesRow(fileName = 'Manual') {
  return { id: createId('sale'), business_date: today(), gross_sales: '0.00', net_sales: '0.00', cash_sales: '0.00', credit_sales: '0.00', gift_card_sales: '0.00', online_orders: '0.00', delivery_orders: '0.00', pickup_orders: '0.00', tips: '0.00', actual_tips: '0.00', tips_withheld: '0.00', tips_after_withholding: '0.00', refunds: '0.00', voids: '0.00', discounts: '0.00', tax: '0.00', guest_count: '0.00', source_file: fileName, import_note: '' }
}
function makeGenericSalesRow(row, fileName = 'Manual') {
  const gross = round2(num(findValue(row, ['Gross Sales', 'Gross', 'Total Sales', 'Sales'])))
  const net = round2(num(findValue(row, ['Net Sales', 'Net', 'Net Sales Total', 'Total Net Sales'])) || gross)
  const cash = round2(num(findValue(row, ['Cash', 'Cash Sales', 'Cash Payments', 'Cash Total'])))
  const credit = round2(num(findValue(row, ['Credit', 'Credit Sales', 'Credit Card Sales', 'Card Sales', 'Credit Cards', 'Credit/debit'])))
  const gift = round2(num(findValue(row, ['Gift Card', 'Gift Cards', 'Gift Card Sales', 'Gift Certificates'])))
  const online = round2(num(findValue(row, ['Online Orders', 'Online Sales', 'Online Ordering', 'Other', 'DoorDash'])))
  const delivery = round2(num(findValue(row, ['Delivery', 'Delivery Orders', 'Delivery Sales'])))
  const pickup = round2(num(findValue(row, ['Pickup', 'Pickup Orders', 'Takeout', 'Take Out'])))
  const actualTips = round2(num(findValue(row, ['Actual Tips', 'Total Tips', 'Tips', 'Tips Collected', 'Non-Cash Tips'])))
  const explicitAfterTips = round2(num(findValue(row, ['Tips after withholding', 'Final Tips', 'Tips Payable'])))
  const tipsWithheld = round2(Math.abs(num(findValue(row, ['Tips withheld', 'Tip Withheld', 'Withholding']))) || (actualTips ? actualTips * 0.035 : 0))
  const tips = explicitAfterTips || round2(Math.max(actualTips - tipsWithheld, 0))
  const refunds = absMoney(findValue(row, ['Refunds', 'Refund Amount', 'Sales Refunds', 'Returns']))
  const voids = absMoney(findValue(row, ['Voids', 'Void Amount']))
  const discounts = absMoney(findValue(row, ['Discounts', 'Discount Amount', 'Sales Discounts']))
  const tax = round2(num(findValue(row, ['Tax', 'Taxes', 'Tax Collected', 'Sales Tax', 'Tax amount'])))
  const guests = round2(num(findValue(row, ['Guest Count', 'Guests', 'Covers', 'Guest', 'Total guests'])))
  const date = formatDate(findValue(row, ['Business Date', 'Date', 'Opened Date', 'Order Date', 'yyyyMMdd']))
  return { ...makeEmptySalesRow(fileName), business_date: date, gross_sales: money(gross), net_sales: money(net), cash_sales: money(cash), credit_sales: money(credit), gift_card_sales: money(gift), online_orders: money(online), delivery_orders: money(delivery), pickup_orders: money(pickup), tips: money(tips), actual_tips: money(actualTips || tips + tipsWithheld), tips_withheld: money(tipsWithheld), tips_after_withholding: money(tips), refunds: money(refunds), voids: money(voids), discounts: money(discounts), tax: money(tax), guest_count: money(guests) }
}
function parseToastSalesWorkbook(workbook, fileName) {
  const hasToastSheets = workbook.SheetNames.includes('Revenue summary') || workbook.SheetNames.includes('Sales by day') || workbook.SheetNames.includes('Payments summary')
  if (!hasToastSheets) return []

  const netSummary = headerValueRow(workbook, 'Net sales summary')
  const tipSummary = headerValueRow(workbook, 'Tip summary')
  const payments = sheetObjects(workbook, 'Payments summary')
  const dayRows = sheetObjects(workbook, 'Sales by day').filter(row => num(findValue(row, ['Net sales'])))

  const gross = round2(num(findValue(netSummary, ['Gross sales'])) || num(firstRowValue(workbook, 'Revenue summary', 'Net sales')))
  const net = round2(num(findValue(netSummary, ['Net sales'])) || num(firstRowValue(workbook, 'Revenue summary', 'Net sales')))
  const discounts = absMoney(findValue(netSummary, ['Sales discounts']))
  const refunds = absMoney(findValue(netSummary, ['Sales refunds']))
  const totalTips = round2(num(findValue(tipSummary, ['Total tips', 'Total Tips', 'Tips'])))
  const tipsWithheld = round2(Math.abs(num(findValue(tipSummary, ['Tips withheld', 'Tip withheld', 'Withholding']))))
  const explicitTipsAfterWithholding = round2(num(findValue(tipSummary, ['Tips after withholding', 'Tips After Withholding'])))
  const calculatedTipsWithheld = tipsWithheld || (totalTips ? round2(totalTips * 0.035) : 0)
  const tipsAfterWithholding = explicitTipsAfterWithholding || round2(Math.max(totalTips - calculatedTipsWithheld, 0))
  const tax = round2(num(firstRowValue(workbook, 'Revenue summary', 'Tax amount')) || num(findValue(headerValueRow(workbook, 'Tax summary'), ['Tax amount'])))
  const cash = paymentAmount(payments, 'Cash')
  const credit = paymentAmount(payments, 'Credit/debit')
  const gift = paymentAmount(payments, 'Gift Card')
  const online = paymentAmount(payments, 'Other') || paymentAmount(payments, 'Other', 'DoorDash')
  const totalGuests = dayRows.reduce((acc, row) => acc + num(findValue(row, ['Total guests', 'Guests', 'Guest Count'])), 0)
  const sourceRange = extractRangeFromFileName(fileName)

  if (!dayRows.length) {
    return [{ ...makeEmptySalesRow(fileName), business_date: formatDate(sourceRange.split(' to ')[0] || today()), gross_sales: money(gross), net_sales: money(net), cash_sales: money(cash), credit_sales: money(credit), gift_card_sales: money(gift), online_orders: money(online), tips: money(tipsAfterWithholding), actual_tips: money(totalTips || tipsAfterWithholding + calculatedTipsWithheld), tips_withheld: money(calculatedTipsWithheld), tips_after_withholding: money(tipsAfterWithholding), refunds: money(refunds), discounts: money(discounts), tax: money(tax), guest_count: money(totalGuests), import_note: sourceRange ? `Toast range ${sourceRange}` : 'Toast summary row' }]
  }

  const weights = dayRows.map(row => num(findValue(row, ['Net sales'])))
  const grossParts = distributeMoney(gross, weights)
  const cashParts = distributeMoney(cash, weights)
  const creditParts = distributeMoney(credit, weights)
  const giftParts = distributeMoney(gift, weights)
  const onlineParts = distributeMoney(online, weights)
  const tipParts = distributeMoney(tipsAfterWithholding, weights)
  const actualTipParts = distributeMoney(totalTips || tipsAfterWithholding + calculatedTipsWithheld, weights)
  const withheldTipParts = distributeMoney(calculatedTipsWithheld, weights)
  const refundParts = distributeMoney(refunds, weights)
  const discountParts = distributeMoney(discounts, weights)
  const taxParts = distributeMoney(tax, weights)

  return dayRows.map((row, index) => ({
    ...makeEmptySalesRow(fileName),
    business_date: formatDate(findValue(row, ['yyyyMMdd', 'Date', 'Business Date'])),
    gross_sales: money(grossParts[index]),
    net_sales: money(findValue(row, ['Net sales'])),
    cash_sales: money(cashParts[index]),
    credit_sales: money(creditParts[index]),
    gift_card_sales: money(giftParts[index]),
    online_orders: money(onlineParts[index]),
    tips: money(tipParts[index]),
    actual_tips: money(actualTipParts[index]),
    tips_withheld: money(withheldTipParts[index]),
    tips_after_withholding: money(tipParts[index]),
    refunds: money(refundParts[index]),
    discounts: money(discountParts[index]),
    tax: money(taxParts[index]),
    guest_count: money(findValue(row, ['Total guests', 'Guests', 'Guest Count'])),
    import_note: sourceRange ? `Toast range ${sourceRange}; daily payments/tips allocated from weekly totals` : 'Toast daily row; payments/tips allocated from summary totals'
  }))
}

export default function Sales({ data, setData }) {
  const salesDays = data.salesDays || []
  const salesImports = data.salesImports || []
  const [previewRows, setPreviewRows] = useState([])
  const [status, setStatus] = useState('Local auto-save is active. Sales history will not disappear.')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editRow, setEditRow] = useState({})
  const [selectedIds, setSelectedIds] = useState([])

  function applyFilterPreset(value) {
    setFilter(value)
    const now = new Date()
    if (value === 'today') { const t = today(); setDateStart(t); setDateEnd(t); return }
    if (value === 'week') { setDateStart(startOfWeekISO(now)); setDateEnd(today()); return }
    if (value === 'month') { setDateStart(startOfMonthISO(now)); setDateEnd(endOfMonthISO(now)); return }
    if (value === 'all') { setDateStart(''); setDateEnd(''); return }
  }

  const filteredSales = useMemo(() => {
    const q = search.toLowerCase().trim()
    return [...salesDays].sort((a, b) => String(b.business_date).localeCompare(String(a.business_date))).filter(row => {
      if (q && !String(row.business_date).includes(q) && !String(row.source_file || '').toLowerCase().includes(q) && !String(row.import_note || '').toLowerCase().includes(q)) return false
      if (dateStart && String(row.business_date) < dateStart) return false
      if (dateEnd && String(row.business_date) > dateEnd) return false
      return true
    })
  }, [salesDays, search, dateStart, dateEnd])

  const totals = useMemo(() => filteredSales.reduce((acc, row) => {
    acc.gross += num(row.gross_sales); acc.net += num(row.net_sales); acc.cash += num(row.cash_sales); acc.credit += num(row.credit_sales)
    acc.gift += num(row.gift_card_sales); acc.online += num(row.online_orders); acc.tips += num(row.tips_after_withholding || row.tips); acc.tipsWithheld += num(row.tips_withheld); acc.actualTips += num(row.actual_tips || (num(row.tips_after_withholding || row.tips) + num(row.tips_withheld))); acc.refunds += num(row.refunds); acc.discounts += num(row.discounts); acc.tax += num(row.tax); acc.guests += num(row.guest_count)
    return acc
  }, { gross: 0, net: 0, cash: 0, credit: 0, gift: 0, online: 0, tips: 0, tipsWithheld: 0, actualTips: 0, refunds: 0, discounts: 0, tax: 0, guests: 0 }), [filteredSales])

  async function handleSalesFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const toastRows = parseToastSalesWorkbook(workbook, file.name)
      const rows = toastRows.length ? toastRows : workbook.SheetNames.flatMap(name => compactRows(XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '', raw: false }))).map(row => makeGenericSalesRow(row, file.name))
      const parsed = rows.filter(row => num(row.gross_sales) || num(row.net_sales) || num(row.cash_sales) || num(row.credit_sales) || num(row.tips))
      setPreviewRows(parsed)
      setStatus(parsed.length ? `Imported ${parsed.length} sales rows from ${toastRows.length ? 'Toast Sales Summary' : 'generic sheet'}. Review and save.` : 'No sales rows found. Check Toast export columns or upload another file.')
    } catch (error) {
      setStatus(`Sales import failed: ${error.message}`)
    }
    event.target.value = ''
  }

  function addManualSale() {
    const row = { ...makeEmptySalesRow('Manual Sales Entry'), import_note: 'Manual sales entry' }
    setPreviewRows(prev => [row, ...prev])
    setStatus('Manual sales row added. Enter values, then click Save Sales.')
  }

  function updatePreview(id, field, value) {
    setPreviewRows(prev => prev.map(row => row.id === id ? { ...row, [field]: field === 'business_date' || field === 'source_file' || field === 'import_note' ? value : value } : row))
  }
  function blurPreview(id, field, value) {
    if (field === 'business_date' || field === 'source_file' || field === 'import_note') return
    updatePreview(id, field, money(value))
  }
  function savePreview() {
    const rows = previewRows.map(row => ({ ...row, id: createId('sale') }))
    setData(prev => ({ ...prev, salesDays: [...rows, ...(prev.salesDays || [])], salesImports: [{ id: createId('salesimport'), file_name: rows[0]?.source_file || 'Toast Sales Import', row_count: rows.length, created_at: new Date().toISOString() }, ...(prev.salesImports || [])] }))
    setPreviewRows([])
    setSelectedIds([])
    setStatus(`Saved ${rows.length} sales rows locally`)
  }
  function startEdit(row) { setEditingId(row.id); setEditRow({ ...row }) }
  function saveEdit() {
    setData(prev => ({ ...prev, salesDays: (prev.salesDays || []).map(row => row.id === editingId ? { ...editRow, gross_sales: money(editRow.gross_sales), net_sales: money(editRow.net_sales), cash_sales: money(editRow.cash_sales), credit_sales: money(editRow.credit_sales), gift_card_sales: money(editRow.gift_card_sales), online_orders: money(editRow.online_orders), tips: money(editRow.tips), refunds: money(editRow.refunds), discounts: money(editRow.discounts), tax: money(editRow.tax), guest_count: money(editRow.guest_count) } : row) }))
    setEditingId(null); setStatus('Sales row updated locally')
  }
  function deleteSale(id) { setData(prev => ({ ...prev, salesDays: (prev.salesDays || []).filter(row => row.id !== id) })); setSelectedIds(prev => prev.filter(item => item !== id)); setStatus('Sales row deleted locally') }
  function toggleSelected(id) { setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]) }
  function toggleAllFiltered(checked) { setSelectedIds(checked ? filteredSales.map(row => row.id) : []) }
  function bulkDelete() {
    if (!selectedIds.length) return setStatus('Select sales rows first')
    setData(prev => ({ ...prev, salesDays: (prev.salesDays || []).filter(row => !selectedIds.includes(row.id)) }))
    setStatus(`Deleted ${selectedIds.length} selected sales rows`)
    setSelectedIds([])
  }

  const numberFields = ['gross_sales','net_sales','cash_sales','credit_sales','gift_card_sales','online_orders','tips','refunds','discounts','tax','guest_count']
  const checkedAll = filteredSales.length > 0 && filteredSales.every(row => selectedIds.includes(row.id))

  return <>
    <style>{`
      .sales-history-card,
      .sales-preview-card {
        overflow-x: auto;
      }
      .sales-table.fit-sales-table {
        min-width: 1320px;
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
        font-size: 13px;
      }
      .sales-table.fit-sales-table th,
      .sales-table.fit-sales-table td {
        padding: 10px 12px;
        vertical-align: middle;
        white-space: nowrap;
      }
      .sales-table.fit-sales-table th {
        font-size: 12px;
        letter-spacing: .04em;
      }
      .sales-table.fit-sales-table .sales-check-col {
        width: 48px;
        text-align: center;
      }
      .sales-table.fit-sales-table .sales-date-col {
        width: 155px;
      }
      .sales-table.fit-sales-table .sales-action-col {
        width: 132px;
      }
      .sales-table.fit-sales-table .sales-date-cell {
        white-space: nowrap;
      }
      .sales-table.fit-sales-table .sales-date-main {
        display: block;
        font-weight: 800;
        white-space: nowrap;
      }
      .sales-table.fit-sales-table .sales-note {
        display: block;
        margin-top: 4px;
        max-width: 132px;
        color: #60708a;
        font-size: 11px;
        line-height: 1.25;
        white-space: normal;
      }
      .sales-table.fit-sales-table .money-cell,
      .sales-table.fit-sales-table .guest-cell {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .sales-table.fit-sales-table .row-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-start;
        flex-wrap: nowrap;
      }
      .sales-table.fit-sales-table .row-actions button {
        padding: 7px 10px;
        min-width: auto;
      }
      .sales-table.fit-sales-table tfoot th {
        text-align: right;
        white-space: nowrap;
      }
    `}</style>
    <div className="sales-action-bar sales-top-actions">
      <label className="btn secondary file-action">
        <Icon name="upload" />
        Upload Sales
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleSalesFile} />
      </label>

      <label className="btn primary file-action">
        <Icon name="upload" />
        Import Toast
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleSalesFile} />
      </label>

      <button className="btn primary" onClick={addManualSale}>
        <Icon name="plus" />
        Add Manual Sale
      </button>
    </div>

    <div className="status-pill">{status}</div>

    <div className="sales-filter-bar">
      <div className="search-box sales-search"><Icon name="search" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search date or file..." /></div>
      <label className="date-range-field"><span>Date Range</span><input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); setFilter('custom') }} /></label>
      <span className="range-arrow">→</span>
      <label className="date-range-field"><input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setFilter('custom') }} /></label>
      <select className="filter-select" value={filter} onChange={e => applyFilterPreset(e.target.value)}><option value="all">All</option><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom Range</option></select>
      <button className="btn primary" onClick={() => setStatus(`Showing ${filteredSales.length} sales rows${dateStart || dateEnd ? ` from ${dateStart || 'start'} to ${dateEnd || 'today'}` : ''}`)}>Apply</button>
    </div>
    {(dateStart || dateEnd) && <p className="filter-note">Showing data from {dateStart || 'first record'} to {dateEnd || 'latest record'}</p>}

    <div className="payroll-summary-row sales-summary-row">
      <div><span>Net Sales</span><b>${money(totals.net)}</b></div><div><span>Cash</span><b>${money(totals.cash)}</b></div><div><span>Credit</span><b>${money(totals.credit)}</b></div><div><span>Tips After Withholding</span><b>${money(totals.tips)}</b><small>Actual ${money(totals.actualTips)} • Withheld ${money(totals.tipsWithheld)}</small></div>
    </div>

    {previewRows.length > 0 && <section className="table-card compact-table-card sales-preview-card">
      <header><h2>Sales Import Preview</h2><span>{previewRows.length} rows <button className="btn primary small-btn" onClick={savePreview}>Save Sales</button></span></header>
      <table className="sales-table fit-sales-table"><thead><tr><th className="sales-date-col">Date</th><th>Gross</th><th>Net</th><th>Cash</th><th>Credit</th><th>Gift</th><th>Online</th><th>Tips</th><th>Refunds</th><th>Discounts</th><th>Tax</th><th>Guests</th><th className="sales-action-col"></th></tr></thead><tbody>{previewRows.map(row => <tr key={row.id}>
        <td className="sales-date-cell"><input className="sales-date-input" type="date" value={row.business_date} onChange={e => updatePreview(row.id, 'business_date', e.target.value)} />{row.import_note && <small className="sales-note" title={row.import_note}>{shortNote(row.import_note)}</small>}</td>
        {numberFields.map(field => <td key={field}><input className="sales-data-input" type="number" step="0.01" value={row[field]} onChange={e => updatePreview(row.id, field, e.target.value)} onBlur={e => blurPreview(row.id, field, e.target.value)} /></td>)}
        <td><button className="delete-link" onClick={() => setPreviewRows(prev => prev.filter(item => item.id !== row.id))}>Remove</button></td>
      </tr>)}</tbody></table>
    </section>}

    <section className="table-card compact-table-card sales-history-card">
      <header><h2>Sales History</h2><span>{filteredSales.length} rows {selectedIds.length ? <button className="delete-link small-btn" onClick={bulkDelete}>Delete {selectedIds.length}</button> : null}</span></header>
      <table className="sales-table fit-sales-table"><thead><tr><th className="sales-check-col"><input type="checkbox" checked={checkedAll} onChange={e => toggleAllFiltered(e.target.checked)} /></th><th className="sales-date-col">Date</th><th>Gross</th><th>Net</th><th>Cash</th><th>Credit</th><th>Gift</th><th>Online</th><th>Tips</th><th>Refunds</th><th>Discounts</th><th>Tax</th><th>Guests</th><th className="sales-action-col">Action</th></tr></thead><tbody>{filteredSales.map(row => {
        const isEditing = editingId === row.id
        const current = isEditing ? editRow : row
        return <tr key={row.id} className={isEditing ? 'editing-row' : ''}>
          <td className="sales-check-col"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} /></td>
          <td className="sales-date-cell">{isEditing ? <input className="sales-date-input" type="date" value={current.business_date} onChange={e => setEditRow(prev => ({ ...prev, business_date: e.target.value }))} /> : <><span className="sales-date-main">{current.business_date}</span>{current.import_note && <small className="sales-note" title={current.import_note}>{shortNote(current.import_note)}</small>}</>}</td>
          {numberFields.map(field => <td key={field} className={field === 'guest_count' ? 'guest-cell' : 'money-cell'}>{isEditing ? <input className="sales-data-input" type="number" step="0.01" value={current[field]} onChange={e => setEditRow(prev => ({ ...prev, [field]: e.target.value }))} /> : (field === 'guest_count' ? money(current[field]) : displayMoney(current[field]))}</td>)}
          <td className="row-actions">{isEditing ? <><button className="save-link" onClick={saveEdit}>Save</button><button onClick={() => setEditingId(null)}>Cancel</button></> : <><button onClick={() => startEdit(row)}>Edit</button><button className="delete-link" onClick={() => deleteSale(row.id)}>Delete</button></>}</td>
        </tr>
      })}{filteredSales.length === 0 && <tr><td colSpan="14"><small>No sales rows yet. Import a Toast Sales Summary CSV/XLSX.</small></td></tr>}</tbody>
      {filteredSales.length > 0 && <tfoot><tr><th></th><th>Totals</th><th>{displayMoney(totals.gross)}</th><th>{displayMoney(totals.net)}</th><th>{displayMoney(totals.cash)}</th><th>{displayMoney(totals.credit)}</th><th>{displayMoney(totals.gift)}</th><th>{displayMoney(totals.online)}</th><th>{displayMoney(totals.tips)}</th><th>{displayMoney(totals.refunds)}</th><th>{displayMoney(totals.discounts)}</th><th>{displayMoney(totals.tax)}</th><th>{money(totals.guests)}</th><th></th></tr></tfoot>}
      </table>
    </section>

    <section className="table-card compact-table-card sales-history-card">
      <header><h2>Import History</h2><span>{salesImports.length} imports</span></header>
      <table><thead><tr><th>File</th><th>Rows</th><th>Imported</th></tr></thead><tbody>{salesImports.map(item => <tr key={item.id}><td>{item.file_name}</td><td>{item.row_count}</td><td>{new Date(item.created_at).toLocaleString()}</td></tr>)}</tbody></table>
    </section>
  </>
}
