import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { inferCategory, sumRowsByCategory as sumByCategoryEngine, categoryGroup, categoriesForGroup, rollupCategoryRows } from '../engine/CategoryEngine'

function num(value) {
  if (typeof value === 'number') return value
  const text = String(value ?? '').replace(/[$,%]/g, '').trim()
  if (!text) return 0
  if (/^\(.+\)$/.test(text)) return -Number(text.replace(/[()]/g, '')) || 0
  return Number(text) || 0
}
function money(value) { return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function pct(value) { return `${Number(value || 0).toFixed(2)}%` }
function todayStr() { return new Date().toISOString().slice(0, 10) }
function startOfMonthISO(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10) }
function readSavedDateRange() {
  try {
    const saved = JSON.parse(localStorage.getItem('restapay_global_date_range') || '{}')
    return { start: saved.start || startOfMonthISO(), end: saved.end || todayStr() }
  } catch {
    return { start: startOfMonthISO(), end: todayStr() }
  }
}
function saveGlobalDateRange(start, end) {
  try { localStorage.setItem('restapay_global_date_range', JSON.stringify({ start, end })) } catch {}
}
function rowDate(row, keys = []) {
  for (const key of keys) if (row?.[key]) return String(row[key]).slice(0, 10)
  return String(row?.business_date || row?.pay_date || row?.invoice_date || row?.date || row?.expense_date || row?.created_at || '').slice(0, 10)
}
function inRange(dateText, start, end) {
  const d = String(dateText || '').slice(0, 10)
  if (!d) return false
  if (start && d < start) return false
  if (end && d > end) return false
  return true
}
function thisWeek(dateText) {
  if (!dateText) return false
  const d = new Date(dateText)
  if (Number.isNaN(d.getTime())) return false
  const n = new Date()
  const start = new Date(n); start.setDate(n.getDate() - n.getDay()); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(start.getDate() + 7)
  return d >= start && d < end
}
function payrollType(row) { return String(row.payment_method || row.payroll_type || row.type || row.pay_method || '').toLowerCase() }
function isCashPayroll(row) { return payrollType(row).includes('cash') }
function isCheckPayroll(row) { return payrollType(row).includes('check') }
function invoiceTotal(row) { return num(row.total || row.amount || row.invoice_total || row.grand_total) }
function itemUnit(row) { return num(row.unit_price || row.price || row.cost || row.item_price || row.rate) }
function itemAmount(row) { return num(row.line_total || row.total || row.amount || row.extended_price || (num(row.qty || row.quantity) * itemUnit(row))) }
function rowCategory(row) { return String(row.category || row.expense_category || row.invoice_category || row.type || '').trim() }
function rowsTotal(rows = []) { return rows.reduce((sum, row) => sum + num(row.amount), 0) }
function filterRowsByFinancialGroup(rows = [], group = 'business') { return rows.filter(row => categoryGroup(row.category || row.label) === group) }
function compactNote(rows, word) { return rows.length ? `${rows.length} ${word}` : `No ${word}` }
function safeDivide(a, b) { return b ? (a / b) * 100 : 0 }
function tipAfter(row) { return num(row.tips_after_withholding || row.final_tips || row.tips) }
function tipWithheld(row) {
  const explicit = num(row.tips_withheld || row.tip_deduction || row.tips_withholding || row.withholding)
  if (explicit) return Math.abs(explicit)
  const after = tipAfter(row)
  return after > 0 ? after * 0.035 / 0.965 : 0
}
function tipActual(row) { return num(row.actual_tips || row.total_tips || row.tips_before_withholding) || (tipAfter(row) + tipWithheld(row)) }
function Sparkline({ values = [], tone = 'blue' }) {
  const clean = values.map(num).filter(v => Number.isFinite(v))
  const data = clean.length ? clean.slice(-12) : [0, 0, 0, 0]
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data.map((value, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100
    const y = 92 - ((value - min) / range) * 78
    return `${x},${y}`
  }).join(' ')
  return <svg className={`rc2-sparkline ${tone}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>
}
function MiniChart({ sales = [], profit = [] }) {
  const labels = ['W1', 'W2', 'W3', 'W4', 'Now']
  const saleVals = sales.length ? sales.slice(-5) : [0, 0, 0, 0, 0]
  const profitVals = profit.length ? profit.slice(-5) : [0, 0, 0, 0, 0]
  const max = Math.max(...saleVals, ...profitVals.map(v => Math.abs(v)), 1)
  return <div className="rc2-trend-bars">
    {labels.map((label, index) => <div className="rc2-trend-bar" key={label}>
      <span style={{ height: `${Math.max(8, (num(saleVals[index]) / max) * 90)}%` }} />
      <b style={{ height: `${Math.max(8, (Math.abs(num(profitVals[index])) / max) * 90)}%` }} />
      <small>{label}</small>
    </div>)}
  </div>
}
function KpiCard({ icon, label, value, sub, delta = '', tone = 'blue', danger = false, onClick }) {
  return <button className="rc2-kpi-card" type="button" onClick={onClick}>
    <span className={`rc2-icon-bubble ${tone}`}><Icon name={icon} size={22} /></span>
    <div className="rc2-kpi-copy"><p>{label}</p><strong className={danger ? 'is-danger' : ''}>{value}</strong><small>{sub}</small></div>
    {delta ? <em className={danger ? 'down' : 'up'}>{delta}</em> : null}
  </button>
}
function Panel({ title, icon, action = 'View All', onAction, children, className = '' }) {
  return <section className={`rc2-panel ${className}`}>
    <header className="rc2-panel-head"><div><Icon name={icon} size={18} /><h2>{title}</h2></div>{onAction ? <button type="button" onClick={onAction}>{action}</button> : null}</header>
    {children}
  </section>
}
function MoneyLine({ label, value, tone = '', icon }) {
  return <div className="rc2-money-line"><span>{icon ? <Icon name={icon} size={16} /> : null}{label}</span><b className={tone}>{money(value)}</b></div>
}
function DataList({ rows = [], empty = 'No records in selected range.' }) {
  if (!rows.length) return <div className="rc2-empty">{empty}</div>
  return <div className="rc2-data-list">{rows.map((row, idx) => <div className="rc2-data-row" key={row.id || idx}><div><b>{row.label}</b>{row.meta ? <small>{row.meta}</small> : null}</div><strong>{row.amount}</strong></div>)}</div>
}
function DonutLegend({ rows = [], total = 0 }) {
  const shown = rows.filter(row => num(row.amount) > 0).slice(0, 6)
  return <div className="rc2-donut-wrap"><div className="rc2-donut"><span>{money(total)}</span><small>Total</small></div><div className="rc2-legend">{shown.length ? shown.map((row, index) => <div key={row.category || row.label || index}><i style={{ '--dot': `var(--rc2-chart-${(index % 6) + 1})` }} /><span>{row.label || row.category}</span><b>{money(row.amount)}</b><em>{pct(safeDivide(row.amount, total))}</em></div>) : <small>No category spend yet.</small>}</div></div>
}
function DetailTable({ title, rows, columns, onOpen, message }) {
  return <section className="table-card compact-table-card rc2-detail-card" id="dashboard-details">
    <header><h2>{title}</h2><button className="btn ghost small-btn" type="button" onClick={onOpen}>Open Screen</button></header>
    {message ? <p className="dashboard-detail-message">{message}</p> : null}
    <table><thead><tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>
      {rows.length ? rows.slice(0, 14).map((row, idx) => <tr key={row.id || idx}>{columns.map(col => <td key={col.key}>{col.render ? col.render(row) : String(row[col.key] ?? '-')}</td>)}</tr>) : <tr><td colSpan={columns.length}><small>No details to show.</small></td></tr>}
    </tbody></table>
  </section>
}

export default function Dashboard({ data, setActive }) {
  const [detail, setDetail] = useState('')
  const salesDays = data?.salesDays || []
  const payroll = data?.payrollEntries || []
  const invoices = data?.invoices || []
  const invoiceItems = data?.invoiceItems || []
  const expenseRows = data?.expenses || []
  const employees = data?.employees || []
  const vendors = data?.vendors || []
  const groups = data?.payrollGroups || []
  const [dateStart, setDateStart] = useState(() => readSavedDateRange().start)
  const [dateEnd, setDateEnd] = useState(() => readSavedDateRange().end)

  function updateDateStart(value) { setDateStart(value); saveGlobalDateRange(value, dateEnd) }
  function updateDateEnd(value) { setDateEnd(value); saveGlobalDateRange(dateStart, value) }
  function setThisMonth() { const start = startOfMonthISO(); const end = todayStr(); setDateStart(start); setDateEnd(end); saveGlobalDateRange(start, end) }
  function setThisWeek() { const n = new Date(); const s = new Date(n); s.setDate(n.getDate() - n.getDay()); const start = s.toISOString().slice(0, 10); const end = todayStr(); setDateStart(start); setDateEnd(end); saveGlobalDateRange(start, end) }
  function setAllDates() { setDateStart(''); setDateEnd(''); saveGlobalDateRange('', '') }
  const rangeLabel = `${dateStart || 'First record'} to ${dateEnd || 'Latest record'}`
  function openScreen(key) { if (setActive) setActive(key) }
  function showDetail(key) { setDetail(key); setTimeout(() => document.getElementById('dashboard-details')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0) }

  const derived = useMemo(() => {
    const rangeSales = salesDays.filter(row => inRange(rowDate(row, ['business_date', 'date']), dateStart, dateEnd))
    const todaySales = salesDays.filter(row => row.business_date === todayStr())
    const weekSales = salesDays.filter(row => thisWeek(row.business_date))
    const rangePayroll = payroll.filter(row => inRange(rowDate(row, ['pay_date', 'date']), dateStart, dateEnd))
    const cashPayrollRows = rangePayroll.filter(isCashPayroll)
    const checkPayrollRows = rangePayroll.filter(isCheckPayroll)
    const rangeInvoices = invoices.filter(row => inRange(rowDate(row, ['invoice_date', 'date']), dateStart, dateEnd))
    const rangeExpenses = expenseRows.filter(row => inRange(rowDate(row, ['date', 'expense_date']), dateStart, dateEnd))
    const invoiceById = Object.fromEntries(invoices.map(inv => [inv.id, inv]))
    const rangeInvoiceItems = invoiceItems.filter(row => {
      const inv = invoiceById[row.invoice_id] || {}
      const date = rowDate(row, ['invoice_date', 'date', 'created_at']) || rowDate(inv, ['invoice_date', 'date'])
      return inRange(date, dateStart, dateEnd)
    })
    const salesMonth = rangeSales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const grossSales = rangeSales.reduce((sum, row) => sum + num(row.gross_sales || row.total_sales || row.net_sales), 0)
    const cashMonth = rangeSales.reduce((sum, row) => sum + num(row.cash_sales), 0)
    const creditSales = rangeSales.reduce((sum, row) => sum + num(row.credit_sales), 0)
    const giftSales = rangeSales.reduce((sum, row) => sum + num(row.gift_card_sales), 0)
    const onlineSales = rangeSales.reduce((sum, row) => sum + num(row.online_orders), 0)
    const taxMonth = rangeSales.reduce((sum, row) => sum + num(row.tax), 0)
    const tipsActual = rangeSales.reduce((sum, row) => sum + tipActual(row), 0)
    const tipsWithheld = rangeSales.reduce((sum, row) => sum + tipWithheld(row), 0)
    const tipsAfterWithholding = rangeSales.reduce((sum, row) => sum + tipAfter(row), 0)
    const cashPayroll = cashPayrollRows.reduce((sum, row) => sum + num(row.total_pay || row.amount), 0)
    const checkPayroll = checkPayrollRows.reduce((sum, row) => sum + num(row.total_pay || row.amount), 0)
    const payrollMonth = rangePayroll.reduce((sum, row) => sum + num(row.total_pay || row.amount), 0)
    const invoiceSpend = rangeInvoices.reduce((sum, row) => sum + invoiceTotal(row), 0)
    const expenseSpend = rangeExpenses.reduce((sum, row) => sum + num(row.amount), 0)
    const invoicesWithLineItems = new Set(rangeInvoiceItems.map(item => item.invoice_id).filter(Boolean))
    const invoiceItemSpend = rangeInvoiceItems.map(row => {
      const inv = invoiceById[row.invoice_id] || {}
      const vendor = inv.vendor || inv.vendor_name || row.vendor || row.vendor_name
      return { ...row, source: 'Invoice Item', vendor, vendor_name: vendor, amount: itemAmount(row), category: inferCategory({ ...row, vendor, category: row.category || inv.category }), date: rowDate(row, ['invoice_date', 'date']) || rowDate(inv, ['invoice_date', 'date']) }
    }).filter(row => num(row.amount) > 0)
    const invoiceHeaderSpend = rangeInvoices.filter(row => !invoicesWithLineItems.has(row.id)).map(row => ({ ...row, source: 'Invoice', amount: invoiceTotal(row), category: inferCategory(row), date: rowDate(row, ['invoice_date', 'date']) }))
    const expenseSpendRows = rangeExpenses.map(row => ({ ...row, source: 'Expense', amount: num(row.amount), category: inferCategory(row), date: rowDate(row, ['date', 'expense_date']) }))
    const allSpendRows = [...invoiceItemSpend, ...invoiceHeaderSpend, ...expenseSpendRows]
    const categoryRows = sumByCategoryEngine(allSpendRows, data || {})
    const vendorPurchaseRowsRaw = filterRowsByFinancialGroup(allSpendRows, 'vendor')
    const businessExpenseRowsRaw = filterRowsByFinancialGroup(allSpendRows, 'business')
    const vendorPurchaseCategoryRows = rollupCategoryRows(sumByCategoryEngine(vendorPurchaseRowsRaw, categoriesForGroup(data || {}, 'vendor')), 'vendor', 6)
    const businessExpenseCategoryRows = rollupCategoryRows(sumByCategoryEngine(businessExpenseRowsRaw, categoriesForGroup(data || {}, 'business')), 'business', 6)
    const vendorPurchaseSpend = rowsTotal(vendorPurchaseRowsRaw)
    const businessExpenseSpend = rowsTotal(businessExpenseRowsRaw)
    const totalExpensesAll = allSpendRows.reduce((sum, row) => sum + num(row.amount), 0)
    const foodSpend = categoryRows.find(row => row.category === 'Food' || row.label === 'Food')?.amount || 0
    const profit = salesMonth - payrollMonth - totalExpensesAll
    const foodCostPercent = safeDivide(foodSpend, salesMonth)
    const laborPercent = safeDivide(payrollMonth, salesMonth)
    const remainingCash = cashMonth - cashPayroll - businessExpenseRowsRaw.filter(row => String(row.payment_method || row.pay_method || '').toLowerCase().includes('cash')).reduce((sum, row) => sum + num(row.amount), 0)
    const weekSalesTotal = weekSales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const salesTrend = [...rangeSales].sort((a, b) => String(a.business_date).localeCompare(String(b.business_date))).map(row => num(row.net_sales || row.gross_sales))
    const profitTrend = [...rangeSales].sort((a, b) => String(a.business_date).localeCompare(String(b.business_date))).map(row => num(row.net_sales) - num(row.tax) - tipAfter(row))
    const vendorRecentRows = [...vendorPurchaseRowsRaw].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    const businessExpenseRecentRows = [...businessExpenseRowsRaw].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    return { rangeSales, todaySales, weekSales, rangePayroll, cashPayrollRows, checkPayrollRows, rangeInvoices, rangeExpenses, rangeInvoiceItems, salesMonth, grossSales, cashMonth, creditSales, giftSales, onlineSales, taxMonth, tipsActual, tipsWithheld, tipsAfterWithholding, cashPayroll, checkPayroll, payrollMonth, invoiceSpend, expenseSpend, allSpendRows, categoryRows, vendorPurchaseRowsRaw, businessExpenseRowsRaw, vendorPurchaseCategoryRows, businessExpenseCategoryRows, vendorPurchaseSpend, businessExpenseSpend, totalExpensesAll, foodSpend, profit, foodCostPercent, laborPercent, remainingCash, weekSalesTotal, salesTrend, profitTrend, vendorRecentRows, businessExpenseRecentRows }
  }, [salesDays, payroll, invoices, invoiceItems, expenseRows, dateStart, dateEnd, data])

  const detailConfig = {
    sales: { title: 'Sales Details', open: 'sales', rows: derived.rangeSales, message: `${compactNote(derived.rangeSales, 'sales rows')} for ${rangeLabel}`, columns: [
      { key: 'business_date', label: 'Date' }, { key: 'gross_sales', label: 'Gross', render: r => money(num(r.gross_sales || r.net_sales)) }, { key: 'cash_sales', label: 'Cash', render: r => money(num(r.cash_sales)) }, { key: 'credit_sales', label: 'Credit', render: r => money(num(r.credit_sales)) }, { key: 'tips', label: 'Tips After', render: r => money(tipAfter(r)) }
    ]},
    cash: { title: 'Cash Flow Details', open: 'sales', rows: [
      { label: 'Cash Collected from Sales', amount: derived.cashMonth }, { label: 'Cash Payroll', amount: -derived.cashPayroll }, { label: 'Estimated Remaining Cash', amount: derived.remainingCash }
    ], columns: [{ key: 'label', label: 'Line Item' }, { key: 'amount', label: 'Amount', render: r => money(num(r.amount)) }]},
    vendors: { title: 'Vendor Purchase Details', open: 'invoices', rows: derived.vendorRecentRows, columns: [
      { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Vendor', render: r => r.vendor || r.vendor_name || '-' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: r => money(num(r.amount)) }
    ]},
    expenses: { title: 'Business Expense Details', open: 'expenses', rows: derived.businessExpenseRecentRows, columns: [
      { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Name', render: r => r.vendor || r.name || r.category || '-' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: r => money(num(r.amount)) }
    ]},
    payroll: { title: 'Payroll Details', open: 'payroll', rows: derived.rangePayroll, columns: [
      { key: 'pay_date', label: 'Date' }, { key: 'employee_name', label: 'Employee', render: r => r.employee_name || r.name || '-' }, { key: 'payment_method', label: 'Method', render: r => r.payment_method || r.payroll_type || '-' }, { key: 'total_pay', label: 'Total', render: r => money(num(r.total_pay || r.amount)) }
    ]},
    tips: { title: 'Toast Tips Details', open: 'sales', rows: derived.rangeSales.filter(r => tipActual(r) || tipAfter(r)), message: `Actual tips ${money(derived.tipsActual)} • Withholding ${money(derived.tipsWithheld)} • Tips after withholding ${money(derived.tipsAfterWithholding)}`, columns: [
      { key: 'business_date', label: 'Date' }, { key: 'actual_tips', label: 'Actual Tips', render: r => money(tipActual(r)) }, { key: 'tips_withheld', label: 'Withheld', render: r => money(tipWithheld(r)) }, { key: 'tips', label: 'After Withholding', render: r => money(tipAfter(r)) }
    ]},
    food: { title: 'Food Cost Details', open: 'reports', rows: derived.allSpendRows.filter(row => (row.category || row.label) === 'Food'), message: `Food cost ${pct(derived.foodCostPercent)} from ${money(derived.foodSpend)} food spend.`, columns: [
      { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Vendor', render: r => r.vendor || r.vendor_name || '-' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: r => money(num(r.amount)) }
    ]}
  }
  const currentDetail = detailConfig[detail]
  const actionButton = (screen, label, icon) => <button className="btn secondary" type="button" onClick={() => openScreen(screen)}><Icon name={icon} size={18} />{label}</button>

  const topVendors = derived.vendorRecentRows.slice(0, 5).map(row => ({ label: row.vendor || row.vendor_name || row.name || 'Vendor', meta: `${row.category || 'Other'} • ${row.date || '-'}`, amount: money(num(row.amount)) }))
  const paymentAlerts = [
    ...derived.businessExpenseRecentRows.filter(r => num(r.amount) > 0).slice(0, 3).map(row => ({ label: row.vendor || row.name || row.category || 'Business Expense', meta: `${row.category || 'Expense'} • ${row.date || '-'}`, amount: money(num(row.amount)) })),
    ...(derived.profit < 0 ? [{ label: 'Profit / Loss Needs Review', meta: 'Selected date range', amount: money(derived.profit) }] : [])
  ].slice(0, 5)

  return <div className="rc2-dashboard-page">
    <div className="rc2-dashboard-head">
      <div><h1>Dashboard</h1><p>Overview of your restaurant performance</p></div>
      <div className="rc2-dashboard-actions">
        {actionButton('sales', 'Import Sales', 'upload')}
        {actionButton('invoices', 'Add Invoice', 'invoices')}
        <button className="btn primary" type="button" onClick={() => openScreen('expenses')}><Icon name="plus" size={18} /> Add Expense</button>
      </div>
    </div>

    <section className="rc2-filter-bar">
      <label><Icon name="calendar" size={18} /><span>Start</span><input type="date" value={dateStart} onChange={e => updateDateStart(e.target.value)} /></label>
      <span className="rc2-range-arrow">→</span>
      <label><span>End</span><input type="date" value={dateEnd} onChange={e => updateDateEnd(e.target.value)} /></label>
      <button type="button" className="active" onClick={() => { saveGlobalDateRange(dateStart, dateEnd) }}>Apply Date Range</button>
      <button type="button" onClick={setThisWeek}>This Week</button>
      <button type="button" onClick={setThisMonth}>This Month</button>
      <button type="button" onClick={setAllDates}>All Dates</button>
      <p>Filtering dashboard by <b>{rangeLabel}</b></p>
    </section>

    <section className="rc2-kpi-grid">
      <KpiCard icon="sales" label="Gross Sales" value={money(derived.grossSales)} sub={`${derived.rangeSales.length} sales rows`} delta="↗ live" tone="green" onClick={() => showDetail('sales')} />
      <KpiCard icon="dollar" label="Cash Collected" value={money(derived.cashMonth)} sub="Uploaded Toast cash" delta="cash" tone="blue" onClick={() => showDetail('cash')} />
      <KpiCard icon="reports" label="Profit / Loss" value={money(derived.profit)} sub="Sales - payroll - expenses" tone="purple" danger={derived.profit < 0} onClick={() => showDetail('cash')} />
      <KpiCard icon="utensils" label="Food Cost %" value={pct(derived.foodCostPercent)} sub={`${money(derived.foodSpend)} food spend`} tone="orange" onClick={() => showDetail('food')} />
      <KpiCard icon="payroll" label="Total Payroll" value={money(derived.payrollMonth)} sub={`Cash ${money(derived.cashPayroll)} • Check ${money(derived.checkPayroll)}`} tone="teal" onClick={() => showDetail('payroll')} />
      <KpiCard icon="gift" label="Tips After Withholding" value={money(derived.tipsAfterWithholding)} sub={`Withheld ${money(derived.tipsWithheld)} (3.5%)`} tone="red" onClick={() => showDetail('tips')} />
      <KpiCard icon="expenses" label="Total Expenses" value={money(derived.businessExpenseSpend)} sub={`${derived.businessExpenseRecentRows.length} business rows`} tone="indigo" onClick={() => showDetail('expenses')} />
      <KpiCard icon="employees" label="Employees" value={String(employees.length)} sub={`${vendors.length} vendors • ${groups.length} payroll groups`} tone="amber" onClick={() => openScreen('employees')} />
    </section>

    <section className="rc2-dashboard-grid rc2-dashboard-grid-top">
      <Panel title="Restaurant Performance" icon="reports" onAction={() => openScreen('reports')}>
        <div className="rc2-chart-card"><Sparkline values={derived.salesTrend} tone="blue" /><Sparkline values={derived.profitTrend} tone="green" /></div>
        <div className="rc2-metric-strip"><div><span>Total Sales</span><b>{money(derived.grossSales)}</b></div><div><span>Total Cost</span><b>{money(derived.totalExpensesAll + derived.payrollMonth)}</b></div><div><span>Profit</span><b className={derived.profit < 0 ? 'is-danger' : 'is-good'}>{money(derived.profit)}</b></div><div><span>Labor %</span><b>{pct(derived.laborPercent)}</b></div></div>
      </Panel>
      <Panel title="Cash Position" icon="dollar" onAction={() => showDetail('cash')}>
        <div className="rc2-cash-lines"><MoneyLine label="Cash Collected (Sales)" value={derived.cashMonth} tone="is-good" icon="dollar" /><MoneyLine label="Cash Payroll" value={-derived.cashPayroll} tone="is-danger" icon="payroll" /><MoneyLine label="Estimated Cash Expenses" value={-(derived.businessExpenseSpend)} tone="is-danger" icon="expenses" /><MoneyLine label="Remaining Cash" value={derived.remainingCash} tone={derived.remainingCash < 0 ? 'is-danger' : 'is-good'} /></div>
      </Panel>
      <Panel title="Expense Summary" icon="pie" onAction={() => showDetail('expenses')}>
        <DonutLegend rows={derived.businessExpenseCategoryRows} total={derived.businessExpenseSpend} />
      </Panel>
    </section>

    <section className="rc2-dashboard-grid rc2-dashboard-grid-middle">
      <Panel title="Top Vendor Purchases" icon="vendors" onAction={() => showDetail('vendors')}><DataList rows={topVendors} /></Panel>
      <Panel title="Payroll & Tips Summary" icon="payroll" onAction={() => showDetail('payroll')}>
        <div className="rc2-payroll-summary"><div><span>Total Payroll</span><b>{money(derived.payrollMonth)}</b></div><div><span>Cash Payroll</span><b>{money(derived.cashPayroll)}</b></div><div><span>Check Payroll</span><b>{money(derived.checkPayroll)}</b></div></div>
        <div className="rc2-tip-box"><MoneyLine label="Actual Tips" value={derived.tipsActual} /><MoneyLine label="Withholding (3.5%)" value={-derived.tipsWithheld} tone="is-danger" /><MoneyLine label="Tips After Withholding" value={derived.tipsAfterWithholding} tone="is-good" /></div>
      </Panel>
      <Panel title="Upcoming Payments & Alerts" icon="alert" action="View All" onAction={() => openScreen('expenses')}><DataList rows={paymentAlerts} empty="No current alerts." /></Panel>
    </section>

    <section className="rc2-wide-panel">
      <Panel title="Sales Trend" icon="reports" onAction={() => openScreen('reports')}>
        <div className="rc2-sales-trend-wrap"><MiniChart sales={derived.salesTrend} profit={derived.profitTrend} /><div className="rc2-trend-totals"><div><span>This Week</span><b>{money(derived.weekSalesTotal)}</b></div><div><span>This Month</span><b>{money(derived.grossSales)}</b></div><div><span>Cash</span><b>{money(derived.cashMonth)}</b></div><div><span>Tips After Withholding</span><b>{money(derived.tipsAfterWithholding)}</b></div></div></div>
      </Panel>
    </section>

    {currentDetail ? <DetailTable title={currentDetail.title} rows={currentDetail.rows} message={currentDetail.message} columns={currentDetail.columns} onOpen={() => openScreen(currentDetail.open)} /> : null}
  </div>
}
