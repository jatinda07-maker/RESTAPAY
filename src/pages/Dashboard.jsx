import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { getAllCategories, inferCategory, sumRowsByCategory as sumByCategoryEngine, categoryGroup, categoriesForGroup, rollupCategoryRows } from '../engine/CategoryEngine'

function num(value) {
  if (typeof value === 'number') return value
  const text = String(value ?? '').replace(/[$,%]/g, '').replace(/,/g, '').trim()
  if (!text) return 0
  if (/^\(.+\)$/.test(text)) return -Number(text.replace(/[()]/g, '')) || 0
  return Number(text) || 0
}
function money(value) { return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function pct(value) { return `${Number(value || 0).toFixed(1)}%` }
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
function rowsTotal(rows = []) { return rows.reduce((sum, row) => sum + num(row.amount), 0) }
function filterRowsByFinancialGroup(rows = [], group = 'business') { return rows.filter(row => categoryGroup(row.category || row.label) === group) }
function emptyRows(rows, label) { return rows.length ? `${rows.length} rows` : `No ${label} entered` }
function trendValue(value) { return value >= 0 ? `↑ ${pct(value)}` : `↓ ${pct(Math.abs(value))}` }

function Spark({ tone = 'blue' }) {
  return <svg className={`sparkline ${tone}`} viewBox="0 0 120 34" aria-hidden="true">
    <polyline points="3,25 17,23 29,26 43,19 55,21 69,14 82,20 96,12 116,15" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

function KpiCard({ label, value, icon, tone, trend, sub, onClick }) {
  const negative = String(value).includes('-') || String(trend).includes('↓')
  return <button type="button" className={`dash-kpi tone-${tone}`} onClick={onClick}>
    <div className="dash-kpi-top"><span><Icon name={icon} size={24} /></span><div><small>{label}</small><strong>{value}</strong></div></div>
    <p className={negative ? 'metric-down' : 'metric-up'}>{trend}</p>
    <em>{sub}</em>
    <Spark tone={tone} />
  </button>
}

function Panel({ title, action, tone = 'navy', children }) {
  return <section className={`dash-panel panel-${tone}`}>
    <header><h2>{title}</h2>{action ? <button type="button" onClick={action.onClick}>{action.label}</button> : null}</header>
    <div className="dash-panel-body">{children}</div>
  </section>
}

function Donut({ center, label }) {
  return <div className="donut-wrap">
    <div className="donut-chart"><div><strong>{center}</strong><small>{label}</small></div></div>
  </div>
}

function Gauge({ score }) {
  const offset = Math.max(0, Math.min(100, score))
  return <div className="health-gauge" style={{ '--score': offset }}>
    <div className="health-gauge-ring"><strong>{score}</strong><small>/100</small></div>
    <b>{score >= 75 ? 'Excellent' : score >= 55 ? 'Good' : 'Needs Review'}</b>
  </div>
}

function DetailTable({ title, rows, columns, onOpen, message }) {
  return <section className="table-card detail-table-card">
    <header><h2>{title}</h2><button className="btn soft" onClick={onOpen}>Open Screen</button></header>
    {message ? <p className="muted-note">{message}</p> : null}
    <div className="table-scroll"><table><thead><tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>
      {rows.length ? rows.slice(0, 12).map((row, idx) => <tr key={row.id || `${title}-${idx}`}>{columns.map(col => <td key={col.key}>{col.render ? col.render(row) : String(row[col.key] ?? '-')}</td>)}</tr>) : <tr><td colSpan={columns.length}><small>No details to show yet.</small></td></tr>}
    </tbody></table></div>
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

  function inSelectedRange(dateText) {
    const d = String(dateText || '').slice(0, 10)
    if (!d) return false
    if (dateStart && d < dateStart) return false
    if (dateEnd && d > dateEnd) return false
    return true
  }
  const rangeLabel = `${dateStart || 'First record'} to ${dateEnd || 'Latest record'}`
  function updateDateStart(value) { setDateStart(value); saveGlobalDateRange(value, dateEnd) }
  function updateDateEnd(value) { setDateEnd(value); saveGlobalDateRange(dateStart, value) }
  function setThisMonth() {
    const start = startOfMonthISO(); const end = todayStr()
    setDateStart(start); setDateEnd(end); saveGlobalDateRange(start, end)
  }
  function setAllDates() { setDateStart(''); setDateEnd(''); saveGlobalDateRange('', '') }
  function showDetail(key) {
    setDetail(key)
    setTimeout(() => document.getElementById('dashboard-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  function openScreen(screen) { if (screen) setActive(screen) }

  const derived = useMemo(() => {
    const monthSales = salesDays.filter(row => inSelectedRange(rowDate(row, ['business_date', 'date'])))
    const weekSales = salesDays.filter(row => thisWeek(row.business_date))
    const monthPayroll = payroll.filter(row => inSelectedRange(rowDate(row, ['pay_date', 'date'])))
    const cashPayrollRows = monthPayroll.filter(isCashPayroll)
    const checkPayrollRows = monthPayroll.filter(isCheckPayroll)
    const monthInvoices = invoices.filter(row => inSelectedRange(rowDate(row, ['invoice_date', 'date'])))
    const invoiceById = Object.fromEntries(invoices.map(inv => [inv.id, inv]))
    const monthInvoiceItems = invoiceItems.filter(row => {
      const inv = invoiceById[row.invoice_id] || {}
      const itemDate = rowDate(row, ['invoice_date', 'date', 'created_at']) || rowDate(inv, ['invoice_date', 'date'])
      return inSelectedRange(itemDate)
    })
    const monthExpenses = expenseRows.filter(row => inSelectedRange(rowDate(row, ['date', 'expense_date'])))
    const salesMonth = monthSales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const grossSales = monthSales.reduce((sum, row) => sum + num(row.gross_sales || row.total_sales || row.net_sales), 0)
    const cashMonth = monthSales.reduce((sum, row) => sum + num(row.cash_sales), 0)
    const creditSales = monthSales.reduce((sum, row) => sum + num(row.credit_sales), 0)
    const giftSales = monthSales.reduce((sum, row) => sum + num(row.gift_card_sales), 0)
    const onlineSales = monthSales.reduce((sum, row) => sum + num(row.online_orders), 0)
    const taxMonth = monthSales.reduce((sum, row) => sum + num(row.tax), 0)
    const tipsMonth = monthSales.reduce((sum, row) => sum + num(row.tips), 0)
    const tipsWithheldMonth = monthSales.reduce((sum, row) => sum + num(row.tips_withheld || row.tip_deduction || row.tips_withholding), 0)
    const tipsAfterWithholdingMonth = tipsMonth
    const trueNetSalesMonth = salesMonth - taxMonth - tipsAfterWithholdingMonth
    const cashPayroll = cashPayrollRows.reduce((sum, row) => sum + num(row.total_pay || row.amount), 0)
    const checkPayroll = checkPayrollRows.reduce((sum, row) => sum + num(row.total_pay || row.amount), 0)
    const payrollMonth = monthPayroll.reduce((sum, row) => sum + num(row.total_pay || row.amount), 0)
    const invoiceSpend = monthInvoices.reduce((sum, row) => sum + invoiceTotal(row), 0)
    const expenseSpend = monthExpenses.reduce((sum, row) => sum + num(row.amount), 0)
    const invoicesWithLineItems = new Set(monthInvoiceItems.map(item => item.invoice_id).filter(Boolean))
    const invoiceItemCategorySpend = monthInvoiceItems.map(row => {
      const inv = invoiceById[row.invoice_id] || {}
      return { ...row, source: 'Invoice Item', vendor: inv.vendor || inv.vendor_name || row.vendor || row.vendor_name, amount: itemAmount(row), category: inferCategory({ ...row, vendor: inv.vendor || inv.vendor_name || row.vendor || row.vendor_name, category: row.category || inv.category }), date: rowDate(row, ['invoice_date', 'date']) || rowDate(inv, ['invoice_date', 'date']) }
    }).filter(row => num(row.amount) > 0)
    const invoiceHeaderCategorySpend = monthInvoices.filter(row => !invoicesWithLineItems.has(row.id)).map(row => ({ ...row, source: 'Invoice', amount: invoiceTotal(row), category: inferCategory(row), date: rowDate(row, ['invoice_date', 'date']) }))
    const expenseCategorySpend = monthExpenses.map(row => ({ ...row, source: 'Expense', amount: num(row.amount), category: inferCategory(row), date: rowDate(row, ['date', 'expense_date']) }))
    const expensesFromInvoiceCategories = [...invoiceItemCategorySpend, ...invoiceHeaderCategorySpend, ...expenseCategorySpend]
    const categoryRows = sumByCategoryEngine(expensesFromInvoiceCategories, data || {})
    const vendorPurchaseRowsRaw = filterRowsByFinancialGroup(expensesFromInvoiceCategories, 'vendor')
    const businessExpenseRowsRaw = filterRowsByFinancialGroup(expensesFromInvoiceCategories, 'business')
    const vendorPurchaseCategoryRowsAll = sumByCategoryEngine(vendorPurchaseRowsRaw, categoriesForGroup(data || {}, 'vendor'))
    const businessExpenseCategoryRowsAll = sumByCategoryEngine(businessExpenseRowsRaw, categoriesForGroup(data || {}, 'business'))
    const vendorPurchaseCategoryRows = rollupCategoryRows(vendorPurchaseCategoryRowsAll, 'vendor', 4)
    const businessExpenseCategoryRows = rollupCategoryRows(businessExpenseCategoryRowsAll, 'business', 5)
    const vendorPurchaseSpend = rowsTotal(vendorPurchaseRowsRaw)
    const businessExpenseSpend = rowsTotal(businessExpenseRowsRaw)
    const foodSpend = categoryRows.find(row => row.category === 'Food')?.amount || 0
    const foodCostPercent = salesMonth > 0 ? (foodSpend / salesMonth) * 100 : 0
    const profit = salesMonth - payrollMonth - vendorPurchaseSpend - businessExpenseSpend
    const laborPct = salesMonth ? (payrollMonth / salesMonth) * 100 : 0
    const primeCost = vendorPurchaseSpend + payrollMonth
    const primePct = salesMonth ? (primeCost / salesMonth) * 100 : 0
    const cashRemaining = cashMonth - cashPayroll - businessExpenseSpend
    const vendorPurchaseRecentRows = vendorPurchaseRowsRaw.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    const businessExpenseRecentRows = businessExpenseRowsRaw.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    return { monthSales, weekSales, monthPayroll, cashPayrollRows, checkPayrollRows, monthInvoices, monthExpenses, grossSales, salesMonth, trueNetSalesMonth, cashMonth, creditSales, giftSales, onlineSales, taxMonth, tipsMonth, tipsWithheldMonth, tipsAfterWithholdingMonth, cashPayroll, checkPayroll, payrollMonth, invoiceSpend, expenseSpend, categoryRows, vendorPurchaseRowsRaw, businessExpenseRowsRaw, vendorPurchaseSpend, businessExpenseSpend, foodSpend, foodCostPercent, profit, laborPct, primeCost, primePct, cashRemaining, vendorPurchaseRecentRows, businessExpenseRecentRows, vendorPurchaseCategoryRows, businessExpenseCategoryRows }
  }, [salesDays, payroll, invoices, invoiceItems, expenseRows, dateStart, dateEnd])

  const healthScore = Math.max(0, Math.min(100, Math.round(82 - Math.max(0, derived.foodCostPercent - 32) * 1.2 - Math.max(0, derived.laborPct - 28) + (derived.profit > 0 ? 6 : -7) + (derived.cashRemaining > 0 ? 4 : -7))))

  const kpis = [
    { label: 'Total Sales', value: money(derived.grossSales || derived.salesMonth), icon: 'cart', tone: 'blue', trend: '↑ 18.7%', sub: `${derived.monthSales.length} sales rows`, detail: 'sales-month' },
    { label: 'Gross Profit', value: money(derived.salesMonth - derived.vendorPurchaseSpend), icon: 'dollar', tone: 'green', trend: '↑ 16.3%', sub: 'Sales less COGS', detail: 'profit-loss' },
    { label: 'Gross Margin', value: pct(derived.salesMonth ? ((derived.salesMonth - derived.vendorPurchaseSpend) / derived.salesMonth) * 100 : 0), icon: 'pie', tone: 'purple', trend: '↑ 1.8%', sub: 'Selected range', detail: 'profit-loss' },
    { label: 'Cash in Hand', value: money(derived.cashRemaining), icon: 'card', tone: 'orange', trend: trendValue(derived.cashRemaining > 0 ? 12.5 : -4.5), sub: 'Cash after cash costs', detail: 'cash-collected' },
    { label: 'Total Employees', value: String(employees.length), icon: 'employees', tone: 'cyan', trend: '— 0.0%', sub: `${vendors.length} vendors • ${groups.length} groups`, detail: 'employees' },
    { label: 'Total Expenses', value: money(derived.vendorPurchaseSpend + derived.businessExpenseSpend), icon: 'expenses', tone: 'red', trend: '↑ 14.2%', sub: 'Vendor + business spend', detail: 'expense-categories' }
  ]

  const detailConfig = {
    'sales-month': { title: 'Sales Details', open: 'sales', rows: derived.monthSales, columns: [
      { key: 'business_date', label: 'Date' }, { key: 'net_sales', label: 'Net', render: r => money(num(r.net_sales)) }, { key: 'cash_sales', label: 'Cash', render: r => money(num(r.cash_sales)) }, { key: 'credit_sales', label: 'Credit', render: r => money(num(r.credit_sales)) }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }
    ]},
    'cash-collected': { title: 'Cash Collected', open: 'sales', rows: derived.monthSales.filter(r => num(r.cash_sales) > 0), message: `Cash collected = ${money(derived.cashMonth)}`, columns: [
      { key: 'business_date', label: 'Date' }, { key: 'cash_sales', label: 'Cash Sales', render: r => money(num(r.cash_sales)) }, { key: 'net_sales', label: 'Net Sales', render: r => money(num(r.net_sales)) }
    ]},
    'profit-loss': { title: 'Profit / Loss Breakdown', open: 'reports', rows: [
      { label: 'Net Sales', amount: derived.salesMonth }, { label: 'COGS / Vendor Purchases', amount: -derived.vendorPurchaseSpend }, { label: 'Payroll', amount: -derived.payrollMonth }, { label: 'Business Expenses', amount: -derived.businessExpenseSpend }, { label: 'Profit / Loss', amount: derived.profit }
    ], columns: [{ key: 'label', label: 'Line Item' }, { key: 'amount', label: 'Amount', render: r => money(r.amount) }]},
    'expense-categories': { title: 'Expense Category Detail', open: 'expenses', rows: derived.categoryRows, columns: [{ key: 'category', label: 'Category', render: r => r.category || r.label }, { key: 'amount', label: 'Amount', render: r => money(r.amount) }]},
    'employees': { title: 'Employees', open: 'employees', rows: employees, columns: [{ key: 'name', label: 'Name', render: r => r.name || r.employee_name || '-' }, { key: 'type', label: 'Type', render: r => r.type || r.employee_type || '-' }, { key: 'payment_method', label: 'Payment', render: r => r.payment_method || '-' }]}
  }
  const currentDetail = detailConfig[detail]

  const salesBreakdown = [
    ['Cash Sales', derived.cashMonth, 'green'], ['Credit Sales', derived.creditSales, 'blue'], ['Gift Cards', derived.giftSales, 'purple'], ['Online Orders', derived.onlineSales, 'orange']
  ]
  const pnlLines = [
    ['Total Sales', derived.salesMonth, 'normal'], ['COGS', -derived.vendorPurchaseSpend, 'red'], ['Gross Profit', derived.salesMonth - derived.vendorPurchaseSpend, 'green'], ['Operating Expenses', -derived.businessExpenseSpend, 'red'], ['Payroll', -derived.payrollMonth, 'red'], ['Net Profit', derived.profit, derived.profit >= 0 ? 'green' : 'red']
  ]

  return <div className="dashboard-modern">
    <div className="dashboard-toolbar">
      <label><span>Start</span><input type="date" value={dateStart} onChange={e => updateDateStart(e.target.value)} /></label>
      <label><span>End</span><input type="date" value={dateEnd} onChange={e => updateDateEnd(e.target.value)} /></label>
      <button className="btn accent" type="button" onClick={() => { saveGlobalDateRange(dateStart, dateEnd); setDetail('') }}>Apply</button>
      <button className="btn soft" type="button" onClick={setThisMonth}>This Month</button>
      <button className="btn soft" type="button" onClick={setAllDates}>All Dates</button>
      <em>Filtering dashboard by {rangeLabel}</em>
    </div>

    <section className="dashboard-kpis">{kpis.map(item => <KpiCard key={item.label} {...item} onClick={() => showDetail(item.detail)} />)}</section>

    <section className="dashboard-top-grid">
      <Panel title="Sales Breakdown" tone="plain" action={{ label: 'View Report', onClick: () => showDetail('sales-month') }}>
        <div className="sales-breakdown">
          <div className="legend-list">{salesBreakdown.map(([label, amount, tone], idx) => <div key={label}><span className={`dot ${tone}`} /> <b>{label}</b><strong>{money(amount)}</strong><em>{derived.salesMonth ? pct((amount / derived.salesMonth) * 100) : '0.0%'}</em></div>)}</div>
          <Donut center={money(derived.salesMonth).replace('$', '$')} label="Total Sales" />
        </div>
      </Panel>

      <Panel title="Cash Position" tone="plain" action={{ label: 'View Report', onClick: () => showDetail('cash-collected') }}>
        <div className="cash-position">
          <div className="cash-highlight"><span>Cash in Hand</span><strong>{money(derived.cashRemaining)}</strong><em>{derived.cashRemaining >= 0 ? 'Healthy cash position' : 'Cash shortfall'}</em></div>
          <div className="line-list"><div><span>Cash Collected</span><b>{money(derived.cashMonth)}</b></div><div><span>Cash Payroll</span><b>{money(derived.cashPayroll)}</b></div><div><span>Cash Expenses</span><b>{money(derived.businessExpenseSpend)}</b></div><div className="total"><span>Net Cash Position</span><b>{money(derived.cashRemaining)}</b></div></div>
        </div>
      </Panel>

      <Panel title="Profit & Loss Snapshot" tone="plain" action={{ label: 'View Report', onClick: () => showDetail('profit-loss') }}>
        <div className="line-list pnl-list">{pnlLines.map(([label, value, tone]) => <div key={label} className={label === 'Net Profit' ? 'total' : ''}><span>{label}</span><b className={tone}>{money(value)}</b></div>)}</div>
        <div className="profit-meter"><span>{derived.salesMonth ? pct((derived.profit / derived.salesMonth) * 100) : '0.0%'}</span><small>Net Profit Margin</small></div>
      </Panel>
    </section>

    <section className="dashboard-mini-grid">
      <Panel title="Vendor Purchases" action={{ label: 'View Report', onClick: () => showDetail('expense-categories') }}><SummaryCard icon="bag" total={derived.vendorPurchaseSpend} trend="13.4%" rows={derived.vendorPurchaseCategoryRows} cta="Go to Vendors" /></Panel>
      <Panel title="Business Expenses" action={{ label: 'View Report', onClick: () => showDetail('expense-categories') }}><SummaryCard icon="building" total={derived.businessExpenseSpend} trend="11.6%" rows={derived.businessExpenseCategoryRows} cta="Go to Expenses" /></Panel>
      <Panel title="Payroll Summary" action={{ label: 'View Report', onClick: () => openScreen('payroll') }}><InfoRows rows={[["Total Payroll", money(derived.payrollMonth)], ["Cash Payroll", money(derived.cashPayroll)], ["Check Payroll", money(derived.checkPayroll)], ["Employees", employees.length]]} /></Panel>
      <Panel title="Tips Summary" action={{ label: 'View Report', onClick: () => openScreen('sales') }}><InfoRows rows={[["Total Tips", money(derived.tipsMonth)], ["After Withholding", money(derived.tipsAfterWithholdingMonth)], ["Tips Withheld", money(derived.tipsWithheldMonth)]]} /></Panel>
      <Panel title="Price Increase Insights" action={{ label: 'View Report', onClick: () => openScreen('price-increase') }}><InfoRows rows={[["Total Increases", '18'], ["Impact on COGS", money(0)], ["Impact on Margin", '-1.8%']]} /></Panel>
    </section>

    <section className="dashboard-bottom-grid">
      <Panel title="Weekly Performance Trend" tone="plain" action={{ label: 'View Report', onClick: () => openScreen('reports') }}>
        <div className="trend-chart"><span style={{ height: '34%' }} /><span style={{ height: '48%' }} /><span style={{ height: '42%' }} /><span style={{ height: '56%' }} /><span style={{ height: '46%' }} /><span style={{ height: '58%' }} /><span style={{ height: '70%' }} /></div>
      </Panel>
      <Panel title="Upcoming Payments & Alerts" tone="plain" action={{ label: 'View All', onClick: () => openScreen('reports') }}>
        <div className="alerts-list"><Alert icon="cart" label="Vendor Payment Review" amount={money(derived.vendorPurchaseSpend)} due="Due soon" /><Alert icon="building" label="Business Expenses" amount={money(derived.businessExpenseSpend)} due="Review" /><Alert icon="payroll" label="Payroll" amount={money(derived.payrollMonth)} due="This period" /><Alert icon="shield" label="Restaurant Health" amount={`${healthScore}/100`} due={healthScore >= 75 ? 'Good' : 'Watch'} /></div>
      </Panel>
      <Panel title="Restaurant Health Score" tone="plain" action={{ label: 'View Report', onClick: () => openScreen('reports') }}>
        <div className="health-panel"><Gauge score={healthScore} /><div className="health-lines"><div><span>Sales Performance</span><b>{derived.salesMonth > 0 ? 'Good' : 'Missing'}</b></div><div><span>Cash Position</span><b>{derived.cashRemaining >= 0 ? 'Good' : 'Watch'}</b></div><div><span>Food Cost</span><b>{derived.foodCostPercent <= 32 ? 'Good' : 'High'}</b></div><div><span>Labor Cost</span><b>{derived.laborPct <= 35 ? 'Good' : 'High'}</b></div></div></div>
      </Panel>
    </section>

    <div id="dashboard-details">{currentDetail ? <DetailTable title={currentDetail.title} rows={currentDetail.rows} columns={currentDetail.columns} onOpen={() => openScreen(currentDetail.open)} message={currentDetail.message} /> : null}</div>
  </div>
}

function SummaryCard({ icon, total, trend, rows = [], cta }) {
  return <div className="summary-card"><div className="summary-top"><span><Icon name={icon} size={26} /></span><div><small>Total</small><strong>{money(total)}</strong></div><em>↑ {trend}</em></div><div className="summary-rows">{rows.slice(0, 5).map(row => <div key={row.label || row.category}><span>{row.label || row.category}</span><b>{money(row.amount)}</b></div>)}</div><button>{cta}</button></div>
}
function InfoRows({ rows }) { return <div className="info-rows">{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div> }
function Alert({ icon, label, amount, due }) { return <div className="alert-row"><span><Icon name={icon} size={18} /></span><b>{label}</b><strong>{amount}</strong><em>{due}</em></div> }
