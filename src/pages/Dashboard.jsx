import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { getAllCategories, inferCategory, sumRowsByCategory as sumByCategoryEngine, categoryGroup, categoriesForGroup, rollupCategoryRows } from '../engine/CategoryEngine'

function num(value) { return Number(String(value ?? '').replace(/[$,%(),]/g, '').trim()) || 0 }
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
function thisWeek(dateText) {
  if (!dateText) return false
  const d = new Date(dateText)
  if (Number.isNaN(d.getTime())) return false
  const n = new Date()
  const start = new Date(n); start.setDate(n.getDate() - n.getDay()); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(start.getDate() + 7)
  return d >= start && d < end
}
function thisMonth(dateText) {
  if (!dateText) return false
  const d = new Date(dateText)
  const n = new Date()
  return !Number.isNaN(d.getTime()) && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}
function emptyLabel(rows, label) { return rows.length ? `${rows.length} rows` : `No ${label} entered yet` }
function noThisPeriod(rows, label, period) { return rows.length ? `${rows.length} rows` : `No ${label} ${period}` }
function payrollType(row) { return String(row.payment_method || row.payroll_type || row.type || row.pay_method || '').toLowerCase() }
function isCashPayroll(row) { return payrollType(row).includes('cash') }
function isCheckPayroll(row) { return payrollType(row).includes('check') }
function invoiceTotal(row) { return num(row.total || row.amount || row.invoice_total || row.grand_total) }
function itemUnit(row) { return num(row.unit_price || row.price || row.cost || row.item_price || row.rate) }
function itemAmount(row) { return num(row.line_total || row.total || row.amount || row.extended_price || (num(row.qty || row.quantity) * itemUnit(row))) }
function rowCategory(row) { return String(row.category || row.expense_category || row.invoice_category || row.type || '').trim() }
function isFoodCategory(value) {
  const text = String(value || '').toLowerCase()
  return ['food', 'meat', 'produce', 'grocery', 'restaurant food', 'food cost'].some(term => text.includes(term))
}
function categoryKey(value) { return String(value || 'Uncategorized').trim() || 'Uncategorized' }

const SPEND_CATEGORY_ORDER = [
  'Food', 'Beverage', 'Beer', 'Liquor', 'Supplies', 'Utilities',
  'Maintenance', 'Insurance', 'Accounting Fees', 'Loans',
  'Cash Expenses', 'Restaurant Expenses', 'Other'
]

function normalizeSpendCategory(value) {
  const text = String(value || '').toLowerCase()
  if (text.includes('food') || text.includes('meat') || text.includes('produce') || text.includes('grocery') || text.includes('chicken') || text.includes('beef') || text.includes('fish') || text.includes('rice') || text.includes('oil') || text.includes('flour') || text.includes('cheese') || text.includes('sauce')) return 'Food'
  if (text.includes('beer')) return 'Beer'
  if (text.includes('liquor') || text.includes('wine') || text.includes('alcohol') || text.includes('vodka') || text.includes('tequila') || text.includes('whiskey') || text.includes('rum')) return 'Liquor'
  if (text.includes('beverage') || text.includes('soda') || text.includes('drink') || text.includes('coffee') || text.includes('tea') || text.includes('juice') || text.includes('coke') || text.includes('pepsi')) return 'Beverage'
  if (text.includes('suppl') || text.includes('glove') || text.includes('napkin') || text.includes('straw') || text.includes('bag') || text.includes('container') || text.includes('paper') || text.includes('chemical') || text.includes('soap')) return 'Supplies'
  if (text.includes('util') || text.includes('electric') || text.includes('gas') || text.includes('water')) return 'Utilities'
  if (text.includes('maint') || text.includes('repair') || text.includes('service')) return 'Maintenance'
  if (text.includes('insurance')) return 'Insurance'
  if (text.includes('account')) return 'Accounting Fees'
  if (text.includes('loan') || text.includes('mortgage')) return 'Loans'
  if (text.includes('cash')) return 'Cash Expenses'
  if (text.includes('restaurant')) return 'Restaurant Expenses'
  return categoryKey(value || 'Other')
}

function inferItemCategory(row, invoice = {}) {
  const explicit = rowCategory(row) || row.category || invoice.category
  const description = String(row.description || row.item_name || row.item || row.name || '').toLowerCase()
  return normalizeSpendCategory(`${explicit || ''} ${description}`)
}


function sumRowsByCategory(rows = [], configuredCategories = []) {
  const map = new Map()

  configuredCategories.filter(Boolean).forEach(category => {
    const key = normalizeSpendCategory(category)
    if (!map.has(key)) map.set(key, 0)
  })

  rows.forEach(row => {
    const key = normalizeSpendCategory(row.category || rowCategory(row) || 'Other')
    map.set(key, (map.get(key) || 0) + num(row.amount))
  })

  return [...map.entries()]
    .sort((a, b) => {
      const ai = SPEND_CATEGORY_ORDER.indexOf(a[0])
      const bi = SPEND_CATEGORY_ORDER.indexOf(b[0])
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      return String(a[0]).localeCompare(String(b[0]))
    })
    .map(([category, amount]) => ({ id: `sum-${category}`, label: category, amount }))
}

function filterRowsByFinancialGroup(rows = [], group = 'business') {
  return rows.filter(row => categoryGroup(row.category || row.label) === group)
}
function rowsTotal(rows = []) { return rows.reduce((sum, row) => sum + num(row.amount), 0) }

function EnterprisePanel({ icon, title, total, count, actionLabel = 'View All', rows = [], subtotalRows = [], grandLabel = 'Total', onViewAll }) {
  return <section className="enterprise-panel">
    <header className="enterprise-panel-head">
      <div className="enterprise-panel-title"><span className="enterprise-panel-icon"><Icon name={icon} size={18} /></span><div><h2>{title}</h2><small>{count}</small></div></div>
      <div className="enterprise-panel-total"><strong>{total}</strong><button type="button" onClick={onViewAll}>{actionLabel}</button></div>
    </header>
    <div className="enterprise-panel-body">
      {rows.length ? rows.map((row, idx) => <button className="enterprise-row" key={row.id || `${title}-${idx}`} type="button" onClick={row.onClick || onViewAll}>
        <div><b>{row.label}</b>{row.meta ? <small>{row.meta}</small> : null}</div><strong>{row.amount}</strong>
      </button>) : <div className="enterprise-empty">No data in selected range.</div>}
    </div>
    {subtotalRows.length ? <div className="enterprise-subtotals">
      {subtotalRows.map((row, idx) => <button className="enterprise-subtotal-row" key={row.id || `${title}-sub-${idx}`} type="button" onClick={row.onClick || onViewAll}><span>{row.label}</span><b>{money(row.amount)}</b></button>)}
    </div> : null}
    <footer className="enterprise-panel-foot"><span>{grandLabel}</span><strong>{total}</strong></footer>
  </section>
}

function KpiCard({ item, onClick }) {
  const [title, value, meta, icon, tone, , details = []] = item
  return <button className="kpi-card dashboard-click-card" onClick={onClick} type="button">
    <div className={`kpi-icon ${tone}`}><Icon name={icon} size={24} /></div>
    <div>
      <h3>{title}</h3>
      <strong>{value}</strong>
      <p className={title.includes('Loss') || title.includes('Refund') ? 'down' : ''}>{meta}</p>
      {details.length ? <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5edf6', display: 'grid', gap: 4 }}>
        {details.map(([label, amount]) => <small key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#536984', fontSize: 12, lineHeight: 1.25 }}>
          <span>{label}</span><b style={{ color: '#001b3d', whiteSpace: 'nowrap' }}>{amount}</b>
        </small>)}
      </div> : null}
    </div>
  </button>
}

function ListPanel({ title, rows, type, onViewAll }) {
  return <section className="list-panel">
    <header><h2>{title}</h2><button onClick={onViewAll} type="button">View All</button></header>
    <div className="rows">
      {rows.length ? rows.map((row, idx) => <button className="data-row dashboard-row-button" key={idx} onClick={onViewAll} type="button">
        <div className="row-left"><span className="mini-icon"><Icon name={type === 'expenses' ? 'expenses' : type === 'sales' ? 'dollar' : 'vendors'} size={16} /></span><div><b>{row[0]}</b><small>{row[1]}</small></div></div>
        <div className="row-right"><b className={row[0] === 'Refunds' ? 'danger' : ''}>{row[2]}</b>{row[3] && <em className={String(row[3]).toLowerCase()}>{row[3]}</em>}</div>
      </button>) : <div className="empty-panel-note">No data entered yet.</div>}
    </div>
  </section>
}

function DetailTable({ title, rows, columns, onOpen, message }) {
  return <section className="table-card compact-table-card dashboard-detail-card focused-detail-card">
    <header><h2>{title}</h2><button className="btn ghost small-btn" onClick={onOpen}>Open Screen</button></header>
    {message ? <p className="dashboard-detail-message">{message}</p> : null}
    <table><thead><tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>
      {rows.length ? rows.slice(0, 12).map((row, idx) => <tr key={row.id || `${title}-${idx}`}>{columns.map(col => <td key={col.key}>{col.render ? col.render(row) : String(row[col.key] ?? '-')}</td>)}</tr>) : <tr><td colSpan={columns.length}><small>No details to show for this card yet.</small></td></tr>}
    </tbody></table>
  </section>
}

function SparkLine({ tone = 'green' }) {
  const points = '2,35 18,30 34,33 50,23 66,27 82,18 98,21 116,12'
  return <svg className={`rp-spark rp-spark-${tone}`} viewBox="0 0 120 42" preserveAspectRatio="none" aria-hidden="true">
    <path d="M2 40 L2 35 L18 30 L34 33 L50 23 L66 27 L82 18 L98 21 L116 12 L116 40 Z" />
    <polyline points={points} />
  </svg>
}

function StatCard({ icon, label, value, hint, delta = '+0.0%', tone = 'green', onClick }) {
  return <button type="button" className={`rp-stat-card tone-${tone}`} onClick={onClick}>
    <span className="rp-stat-icon"><Icon name={icon} size={20} /></span>
    <span className="rp-stat-label">{label}</span>
    <strong>{value}</strong>
    <small><b>{delta}</b> {hint}</small>
    <SparkLine tone={tone} />
  </button>
}

function ColorPanel({ tone = 'blue', icon, title, amount, meta, action = 'View all', children, onClick }) {
  return <section className={`rp-color-panel panel-${tone}`}>
    <header>
      <div className="rp-panel-title"><span><Icon name={icon} size={20} /></span><div><h2>{title}</h2><small>{meta}</small></div></div>
      <div className="rp-panel-amount"><strong>{amount}</strong><button type="button" onClick={onClick}>{action}</button></div>
    </header>
    <div className="rp-panel-body">{children}</div>
  </section>
}

function MiniRow({ label, value, color }) {
  return <div className="rp-mini-row"><span>{label}</span><b className={color ? `text-${color}` : ''}>{value}</b></div>
}

function InsightCard({ icon, title, value, subtitle, tone = 'blue' }) {
  return <div className={`rp-insight-card insight-${tone}`}>
    <span><Icon name={icon} size={22} /></span>
    <div><b>{title}</b><strong>{value}</strong><small>{subtitle}</small></div>
  </div>
}

function HealthMeter({ score }) {
  const clamped = Math.max(0, Math.min(100, Number(score || 0)))
  return <div className="rp-health-meter">
    <div className="rp-gauge" style={{ '--score': `${clamped * 1.8 - 90}deg` }}>
      <div className="rp-gauge-score"><strong>{Math.round(clamped)}</strong><span>{clamped >= 80 ? 'Excellent' : clamped >= 65 ? 'Good' : 'Needs Work'}</span></div>
    </div>
    <div className="rp-health-list">
      {[
        ['Sales Performance', clamped >= 65 ? 'Good' : 'Review'],
        ['Expense Control', clamped >= 70 ? 'Good' : 'High'],
        ['Profitability', clamped >= 80 ? 'Excellent' : 'Review'],
        ['Cash Flow', clamped >= 60 ? 'Good' : 'Watch'],
        ['Payroll Management', clamped >= 70 ? 'Excellent' : 'Review'],
        ['Vendor Payments', 'Good']
      ].map(([label, status]) => <div key={label}><span>{label}</span><b>{status}</b></div>)}
    </div>
  </div>
}

function BarChartLite() {
  const bars = [55, 68, 61, 75, 66, 70, 64]
  return <div className="rp-bars" aria-hidden="true">{bars.map((h, i) => <span key={i} style={{ height: `${h}%` }}><i style={{ height: `${Math.max(20, h - 28)}%` }} /></span>)}</div>
}

function CashChartLite() {
  return <div className="rp-cash-chart" aria-hidden="true">
    {[62,48,70,66,58,54,50].map((h, i) => <span key={`in-${i}`} className="cash-in" style={{ height: `${h}%` }} />)}
    {[28,25,36,42,32,25,31].map((h, i) => <span key={`out-${i}`} className="cash-out" style={{ height: `${h}%` }} />)}
    <svg viewBox="0 0 240 100" preserveAspectRatio="none"><polyline points="5,58 42,64 80,46 118,38 156,46 194,61 235,72" /></svg>
  </div>
}

function DonutLite({ total }) {
  return <div className="rp-donut-wrap"><div className="rp-donut" /><div className="rp-donut-center"><strong>{total}</strong><span>Total</span></div></div>
}

export default function Dashboard({ data, setActive }) {
  const [detail, setDetail] = useState('')
  const [expensePanelMode, setExpensePanelMode] = useState('categories')
  const salesDays = data?.salesDays || []
  const payroll = data?.payrollEntries || []
  const invoices = data?.invoices || []
  const invoiceItems = data?.invoiceItems || []
  const expenseRows = data?.expenses || []
  const employees = data?.employees || []
  const vendors = data?.vendors || []
  const groups = data?.payrollGroups || []
  const allConfiguredCategories = getAllCategories(data || {})
  const [dateStart, setDateStart] = useState(() => readSavedDateRange().start)
  const [dateEnd, setDateEnd] = useState(() => readSavedDateRange().end)

  function updateDateStart(value) {
    setDateStart(value)
    saveGlobalDateRange(value, dateEnd)
  }
  function updateDateEnd(value) {
    setDateEnd(value)
    saveGlobalDateRange(dateStart, value)
  }
  function setThisMonth() {
    const start = startOfMonthISO()
    const end = todayStr()
    setDateStart(start)
    setDateEnd(end)
    saveGlobalDateRange(start, end)
  }
  function setAllDates() {
    setDateStart('')
    setDateEnd('')
    saveGlobalDateRange('', '')
  }
  function inSelectedRange(dateText) {
    const d = String(dateText || '').slice(0, 10)
    if (!d) return false
    if (dateStart && d < dateStart) return false
    if (dateEnd && d > dateEnd) return false
    return true
  }
  const rangeLabel = `${dateStart || 'First record'} to ${dateEnd || 'Latest record'}`

  const derived = useMemo(() => {
    const todaySales = salesDays.filter(row => row.business_date === todayStr())
    const weekSales = salesDays.filter(row => thisWeek(row.business_date))
    const monthSales = salesDays.filter(row => inSelectedRange(rowDate(row, ['business_date', 'date'])))
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
    const salesToday = todaySales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const salesWeek = weekSales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const salesMonth = monthSales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const cashMonth = monthSales.reduce((sum, row) => sum + num(row.cash_sales), 0)
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
      return {
        ...row,
        source: 'Invoice Item',
        vendor: inv.vendor || inv.vendor_name || row.vendor || row.vendor_name,
        amount: itemAmount(row),
        category: inferCategory({ ...row, vendor: inv.vendor || inv.vendor_name || row.vendor || row.vendor_name, category: row.category || inv.category }),
        date: rowDate(row, ['invoice_date', 'date']) || rowDate(inv, ['invoice_date', 'date'])
      }
    }).filter(row => num(row.amount) > 0)

    const invoiceHeaderCategorySpend = monthInvoices
      .filter(row => !invoicesWithLineItems.has(row.id))
      .map(row => ({...row, source: 'Invoice', amount: invoiceTotal(row), category: inferCategory(row), date: rowDate(row, ['invoice_date', 'date']) }))

    const expenseCategorySpend = monthExpenses.map(row => ({...row, source: 'Expense', amount: num(row.amount), category: inferCategory(row), date: rowDate(row, ['date', 'expense_date']) }))
    const expensesFromInvoiceCategories = [...invoiceItemCategorySpend, ...invoiceHeaderCategorySpend, ...expenseCategorySpend]
    const totalExpensesAll = expensesFromInvoiceCategories.reduce((sum, row) => sum + num(row.amount), 0)
    const profit = salesMonth - payrollMonth - totalExpensesAll
    const categoryRows = sumByCategoryEngine(expensesFromInvoiceCategories, data || {})
    const vendorPurchaseRowsRaw = filterRowsByFinancialGroup(expensesFromInvoiceCategories, 'vendor')
    const businessExpenseRowsRaw = filterRowsByFinancialGroup(expensesFromInvoiceCategories, 'business')
    const vendorPurchaseCategoryRowsAll = sumByCategoryEngine(vendorPurchaseRowsRaw, categoriesForGroup(data || {}, 'vendor'))
    const businessExpenseCategoryRowsAll = sumByCategoryEngine(businessExpenseRowsRaw, categoriesForGroup(data || {}, 'business'))
    const vendorPurchaseCategoryRows = rollupCategoryRows(vendorPurchaseCategoryRowsAll, 'vendor', 8)
    const businessExpenseCategoryRows = rollupCategoryRows(businessExpenseCategoryRowsAll, 'business', 8)
    const vendorPurchaseSpend = rowsTotal(vendorPurchaseRowsRaw)
    const businessExpenseSpend = rowsTotal(businessExpenseRowsRaw)
    const foodSpend = categoryRows.find(row => row.category === 'Food')?.amount || 0
    const foodCostPercent = salesMonth > 0 ? (foodSpend / salesMonth) * 100 : 0
    const grossSales = monthSales.reduce((sum, row) => sum + num(row.gross_sales || row.total_sales || row.net_sales), 0)
    const creditSales = monthSales.reduce((sum, row) => sum + num(row.credit_sales), 0)
    const giftSales = monthSales.reduce((sum, row) => sum + num(row.gift_card_sales), 0)
    const onlineSales = monthSales.reduce((sum, row) => sum + num(row.online_orders), 0)
    const vendorPurchaseRecentRows = vendorPurchaseRowsRaw.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    const businessExpenseRecentRows = businessExpenseRowsRaw.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    return { todaySales, weekSales, monthSales, monthPayroll, cashPayrollRows, checkPayrollRows, monthInvoices, monthExpenses, monthInvoiceItems, salesToday, salesWeek, salesMonth, grossSales, creditSales, giftSales, onlineSales, cashMonth, taxMonth, tipsMonth, tipsWithheldMonth, tipsAfterWithholdingMonth, trueNetSalesMonth, cashPayroll, checkPayroll, payrollMonth, invoiceSpend, expenseSpend, vendorPurchaseSpend, businessExpenseSpend, foodSpend, foodCostPercent, totalExpensesAll, profit, categoryRows, vendorPurchaseCategoryRows, vendorPurchaseCategoryRowsAll, businessExpenseCategoryRows, businessExpenseCategoryRowsAll, vendorPurchaseRecentRows, businessExpenseRecentRows, expensesFromInvoiceCategories }
  }, [salesDays, payroll, invoices, invoiceItems, expenseRows, dateStart, dateEnd])

  const kpiItems = [
    ['Sales Today', money(derived.salesToday), noThisPeriod(derived.todaySales, 'sales', 'today'), 'cart', 'green', 'sales-today'],
    ['Sales This Week', money(derived.salesWeek), noThisPeriod(derived.weekSales, 'sales', 'this week'), 'store', 'blue', 'sales-week'],
    ['Sales Selected Range', money(derived.trueNetSalesMonth), `${derived.monthSales.length} rows • ${rangeLabel}`, 'calendar', 'purple', 'sales-month', [['Sales Tax', money(derived.taxMonth)], ['Tips After Withholding', money(derived.tipsAfterWithholdingMonth)], ['Tips Withheld', money(derived.tipsWithheldMonth)]]],
    ['Cash Collected', money(derived.cashMonth), `${derived.monthSales.length} uploaded sales rows • ${rangeLabel}`, 'dollar', 'green', 'cash-collected'],
    ['Profit / Loss', money(derived.profit), 'Sales - payroll - expenses - invoices', 'dollar', 'teal', 'profit-loss'],
    ['Cash Payroll', money(derived.cashPayroll), emptyLabel(derived.cashPayrollRows, 'cash payroll'), 'payroll', 'orange', 'cash-payroll'],
    ['Check Payroll', money(derived.checkPayroll), emptyLabel(derived.checkPayrollRows, 'check payroll'), 'card', 'blue', 'check-payroll'],
    ['Food Cost %', pct(derived.foodCostPercent), `${money(derived.foodSpend)} food spend`, 'utensils', 'orange', 'food-cost'],
    ['All Expenses by Category', money(derived.totalExpensesAll), `${derived.categoryRows.length} categories`, 'expenses', 'purple', 'expense-categories'],
    ['Vendor Purchases', money(derived.vendorPurchaseSpend), `${derived.vendorPurchaseRecentRows.length} purchase rows`, 'invoices', 'red', 'invoices'],
    ['Tips', money(derived.tipsMonth), 'Selected range from sales', 'gift', 'green', 'sales-tips'],
    ['Employees', String(employees.length), emptyLabel(employees, 'employees'), 'employees', 'teal', 'employees']
  ]

  const salesSummary = [
    ['Cash Sales', money(derived.monthSales.reduce((s, r) => s + num(r.cash_sales), 0)), emptyLabel(derived.monthSales, 'sales')],
    ['Credit Sales', money(derived.monthSales.reduce((s, r) => s + num(r.credit_sales), 0)), emptyLabel(derived.monthSales, 'sales')],
    ['Tips', money(derived.monthSales.reduce((s, r) => s + num(r.tips), 0)), emptyLabel(derived.monthSales, 'sales')],
    ['Total Sales', money(derived.monthSales.reduce((s, r) => s + num(r.net_sales), 0)), emptyLabel(derived.monthSales, 'sales')]
  ]
  const invoiceRows = derived.monthInvoices.slice(0, 6).map(row => [row.vendor || row.vendor_name || 'Invoice', rowDate(row, ['invoice_date', 'date']), money(invoiceTotal(row))])
  const recentExpenses = derived.monthExpenses.slice(0, 6).map(row => [row.name || row.category || 'Expense', rowDate(row, ['date', 'expense_date']), money(num(row.amount))])

  const detailConfig = {
    'sales-today': { title: 'Sales Today Details', open: 'sales', rows: derived.todaySales, message: derived.todaySales.length ? '' : 'No sales today.', columns: [
      { key: 'business_date', label: 'Date' }, { key: 'net_sales', label: 'Net', render: r => money(num(r.net_sales)) }, { key: 'cash_sales', label: 'Cash', render: r => money(num(r.cash_sales)) }, { key: 'credit_sales', label: 'Credit', render: r => money(num(r.credit_sales)) }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }
    ]},
    'sales-week': { title: 'Sales This Week Details', open: 'sales', rows: derived.weekSales, message: derived.weekSales.length ? '' : 'No sales this week.', columns: [
      { key: 'business_date', label: 'Date' }, { key: 'net_sales', label: 'Net', render: r => money(num(r.net_sales)) }, { key: 'cash_sales', label: 'Cash', render: r => money(num(r.cash_sales)) }, { key: 'credit_sales', label: 'Credit', render: r => money(num(r.credit_sales)) }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }
    ]},
    'sales-month': { title: 'Sales Selected Range Details', open: 'sales', rows: derived.monthSales, message: derived.monthSales.length ? '' : 'No sales in selected range.', columns: [
      { key: 'business_date', label: 'Date' }, { key: 'net_sales', label: 'Net', render: r => money(num(r.net_sales)) }, { key: 'cash_sales', label: 'Cash', render: r => money(num(r.cash_sales)) }, { key: 'credit_sales', label: 'Credit', render: r => money(num(r.credit_sales)) }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }
    ]},
    'sales-tips': { title: 'Tips From Sales', open: 'sales', rows: derived.monthSales.filter(r => num(r.tips) > 0), columns: [
      { key: 'business_date', label: 'Date' }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }, { key: 'net_sales', label: 'Net Sales', render: r => money(num(r.net_sales)) }
    ]},
    'cash-collected': { title: 'Cash Collected From Uploaded Sales', open: 'sales', rows: derived.monthSales.filter(r => num(r.cash_sales) > 0), message: `Cash collected this month = ${money(derived.cashMonth)}`, columns: [
      { key: 'business_date', label: 'Date' }, { key: 'cash_sales', label: 'Cash Sales', render: r => money(num(r.cash_sales)) }, { key: 'net_sales', label: 'Net Sales', render: r => money(num(r.net_sales)) }, { key: 'source_file', label: 'Source', render: r => r.source_file || '-' }
    ]},
    'cash-payroll': { title: 'Cash Payroll Employees', open: 'payroll', rows: derived.cashPayrollRows, columns: [
      { key: 'pay_date', label: 'Date' }, { key: 'employee_name', label: 'Employee', render: r => r.employee_name || r.name || '-' }, { key: 'hours', label: 'Hours', render: r => num(r.hours).toFixed(2) }, { key: 'extra_pay', label: 'Extra Pay', render: r => money(num(r.extra_pay)) }, { key: 'total_pay', label: 'Total', render: r => money(num(r.total_pay || r.amount)) }
    ]},
    'check-payroll': { title: 'Check Payroll Employees', open: 'payroll', rows: derived.checkPayrollRows, columns: [
      { key: 'pay_date', label: 'Date' }, { key: 'employee_name', label: 'Employee', render: r => r.employee_name || r.name || '-' }, { key: 'hours', label: 'Hours', render: r => num(r.hours).toFixed(2) }, { key: 'tips_after_withholding', label: 'Tips After Withheld', render: r => money(num(r.tips_after_withholding || r.final_tips || r.tips)) }, { key: 'total_pay', label: 'Total', render: r => money(num(r.total_pay || r.amount)) }
    ]},
    'profit-loss': { title: 'Profit / Loss Breakdown', open: 'reports', rows: [
      { label: 'Sales Selected Range', amount: derived.salesMonth }, { label: 'Payroll Selected Range', amount: -derived.payrollMonth }, { label: 'Invoices Selected Range', amount: -derived.invoiceSpend }, { label: 'Manual Expenses Selected Range', amount: -derived.expenseSpend }, { label: 'Profit / Loss', amount: derived.profit }
    ], columns: [
      { key: 'label', label: 'Line Item' }, { key: 'amount', label: 'Amount', render: r => money(num(r.amount)) }
    ]},
    'food-cost': { title: 'Food Cost Details', open: 'reports', rows: derived.expensesFromInvoiceCategories.filter(row => normalizeSpendCategory(row.category) === 'Food'), message: derived.foodSpend ? `Food Cost % = ${money(derived.foodSpend)} / ${money(derived.salesMonth)} = ${pct(derived.foodCostPercent)}` : 'No Food category spend entered this month.', columns: [
      { key: 'date', label: 'Date', render: r => r.date || rowDate(r, ['invoice_date', 'date']) }, { key: 'vendor', label: 'Vendor', render: r => r.vendor || r.vendor_name || '-' }, { key: 'description', label: 'Item/Category', render: r => r.description || r.item_name || r.category || '-' }, { key: 'amount', label: 'Amount', render: r => money(num(r.amount)) }
    ]},
    'expense-categories': { title: 'Expenses From Invoice Categories + Expenses', open: 'expenses', rows: derived.categoryRows, columns: [
      { key: 'category', label: 'Category' }, { key: 'amount', label: 'Total', render: r => money(num(r.amount)) }
    ]},
    invoices: { title: 'Invoice Spend Details', open: 'invoices', rows: derived.monthInvoices, columns: [
      { key: 'invoice_date', label: 'Date', render: r => rowDate(r, ['invoice_date', 'date']) }, { key: 'vendor', label: 'Vendor', render: r => r.vendor || r.vendor_name || '-' }, { key: 'category', label: 'Category', render: r => rowCategory(r) || '-' }, { key: 'total', label: 'Total', render: r => money(invoiceTotal(r)) }
    ]},
    employees: { title: 'Employee Details', open: 'employees', rows: employees, columns: [
      { key: 'name', label: 'Name' }, { key: 'employee_type', label: 'Type', render: r => r.employee_type || r.type || '-' }, { key: 'job_type', label: 'Job', render: r => r.job_type || '-' }, { key: 'pay_type', label: 'Pay Type', render: r => r.pay_type || '-' }
    ]},
    vendors: { title: 'Vendor Details', open: 'vendors', rows: vendors, columns: [
      { key: 'name', label: 'Vendor' }, { key: 'category', label: 'Category' }, { key: 'phone', label: 'Phone' }, { key: 'status', label: 'Status', render: r => r.status || 'Active' }
    ]}
  }
  const currentDetail = detailConfig[detail]
  function openScreen(key) { if (setActive) setActive(key) }
  function showDetail(key) { setDetail(key); setTimeout(() => document.getElementById('dashboard-details')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0) }

  const cashRemaining = derived.cashMonth - derived.cashPayroll - derived.businessExpenseSpend
  const cogs = derived.vendorPurchaseSpend || derived.foodSpend
  const operatingProfit = derived.trueNetSalesMonth - cogs - derived.businessExpenseSpend - derived.payrollMonth
  const primeCost = cogs + derived.payrollMonth
  const primePct = derived.trueNetSalesMonth > 0 ? (primeCost / derived.trueNetSalesMonth) * 100 : 0
  const laborPct = derived.trueNetSalesMonth > 0 ? (derived.payrollMonth / derived.trueNetSalesMonth) * 100 : 0
  const profitMargin = derived.trueNetSalesMonth > 0 ? (operatingProfit / derived.trueNetSalesMonth) * 100 : 0
  const healthScore = Math.max(35, Math.min(96, 100 - Math.max(0, derived.foodCostPercent - 30) * 1.6 - Math.max(0, laborPct - 32) * 1.2 + (operatingProfit >= 0 ? 8 : -12)))
  const topExpenseTotal = derived.totalExpensesAll || 1
  const topExpenseRows = derived.categoryRows.filter(r => num(r.amount) > 0).slice(0, 5)

  return <>
    <div className="rp-dashboard-header">
      <div><h1>Dashboard</h1><p>Real-time overview of your restaurant performance</p></div>
      <div className="rp-dashboard-actions">
        <label className="rp-date-pill"><Icon name="calendar" size={17} /><input type="date" value={dateStart} onChange={e => updateDateStart(e.target.value)} /><span>to</span><input type="date" value={dateEnd} onChange={e => updateDateEnd(e.target.value)} /></label>
        <button className="rp-btn rp-btn-light" onClick={() => openScreen('sales')}><Icon name="upload" /> Import Sales</button>
        <button className="rp-btn rp-btn-light" onClick={() => openScreen('invoices')}><Icon name="invoices" /> Add Invoice</button>
        <button className="rp-btn rp-btn-orange" onClick={() => openScreen('expenses')}><Icon name="plus" /> Add Expense</button>
      </div>
    </div>

    <div className="rp-filter-row">
      <button className="rp-btn rp-btn-orange" onClick={() => { saveGlobalDateRange(dateStart, dateEnd); setDetail('') }}>Apply</button>
      <button className="rp-btn rp-btn-light" onClick={setThisMonth}>This Week</button>
      <button className="rp-btn rp-btn-light" onClick={setAllDates}>All Dates</button>
      <span>Filtering dashboard by {rangeLabel}</span>
    </div>

    <div className="rp-stat-grid">
      <StatCard icon="dollar" label="Net Sales" value={money(derived.trueNetSalesMonth)} delta="↑ 12.5%" hint="vs last week" tone="green" onClick={() => showDetail('sales-month')} />
      <StatCard icon="cart" label="Gross Sales" value={money(derived.grossSales)} delta="↑ 9.7%" hint="vs last week" tone="blue" onClick={() => showDetail('sales-month')} />
      <StatCard icon="calendar" label="Cash Collected" value={money(derived.cashMonth)} delta="↑ 9.7%" hint="Toast cash sales" tone="purple" onClick={() => showDetail('cash-collected')} />
      <StatCard icon="trendingUp" label="Profit / Loss" value={money(operatingProfit)} delta="↓ -3.2%" hint="vs last week" tone="red" onClick={() => showDetail('profit-loss')} />
      <StatCard icon="utensils" label="Food Cost %" value={pct(derived.foodCostPercent)} delta="↓ -1.8%" hint="vs target" tone="orange" onClick={() => showDetail('food-cost')} />
      <StatCard icon="employees" label="Total Payroll" value={money(derived.payrollMonth)} delta="↓ -2.1%" hint="vs last week" tone="teal" onClick={() => showDetail('cash-payroll')} />
      <StatCard icon="expenses" label="Business Expenses" value={money(derived.businessExpenseSpend)} delta="↓ -5.1%" hint="vs last week" tone="pink" onClick={() => showDetail('expense-categories')} />
      <StatCard icon="card" label="Cash Balance" value={money(cashRemaining)} delta="↑ $1,250" hint="remaining" tone="blue" onClick={() => showDetail('cash-collected')} />
    </div>

    <div className="rp-main-grid">
      <section className="rp-card rp-chart-card header-green">
        <header><h2>Sales Overview</h2><button onClick={() => showDetail('sales-month')}>View Report →</button></header>
        <div className="rp-card-main">
          <div><strong className="rp-big-number">{money(derived.trueNetSalesMonth)}</strong><span className="rp-positive">↑ 12.5% vs last week</span></div>
          <BarChartLite />
        </div>
        <div className="rp-metric-strip"><span>Avg Daily Sales <b>{money(derived.trueNetSalesMonth / 7)}</b></span><span>Transactions <b>{derived.monthSales.length}</b></span><span>Avg Ticket <b>{money(derived.monthSales.length ? derived.trueNetSalesMonth / derived.monthSales.length : 0)}</b></span></div>
      </section>

      <section className="rp-card header-purple">
        <header><h2>Profit & Loss Summary</h2><button onClick={() => showDetail('profit-loss')}>View Report →</button></header>
        <MiniRow label="Total Sales" value={money(derived.trueNetSalesMonth)} />
        <MiniRow label="Cost of Goods Sold" value={money(-cogs)} color="red" />
        <MiniRow label="Gross Profit" value={money(derived.trueNetSalesMonth - cogs)} color="green" />
        <MiniRow label="Total Payroll" value={money(-derived.payrollMonth)} color="red" />
        <MiniRow label="Business Expenses" value={money(-derived.businessExpenseSpend)} color="red" />
        <div className="rp-total-line"><span>Total Profit / Loss</span><strong className={operatingProfit >= 0 ? 'text-green' : 'text-red'}>{money(operatingProfit)}</strong><small>{pct(profitMargin)} margin</small></div>
      </section>

      <section className="rp-card header-blue">
        <header><h2>Cash Flow This Week</h2><button onClick={() => showDetail('cash-collected')}>View Cash Flow →</button></header>
        <div className="rp-cash-totals"><span>Cash In <b className="text-green">{money(derived.cashMonth)}</b></span><span>Cash Out <b className="text-red">{money(derived.cashPayroll + derived.businessExpenseSpend)}</b></span><span>Net Cash Flow <b className="text-blue">{money(cashRemaining)}</b></span></div>
        <CashChartLite />
      </section>

      <section className="rp-card header-orange">
        <header><h2>Top Expense Categories</h2><strong>{money(derived.totalExpensesAll)}</strong></header>
        <div className="rp-donut-row"><DonutLite total={money(derived.totalExpensesAll)} /><div className="rp-donut-list">{topExpenseRows.map(row => <MiniRow key={row.category || row.label} label={row.category || row.label} value={`${money(row.amount)}  ${((num(row.amount)/topExpenseTotal)*100).toFixed(1)}%`} />)}</div></div>
        <button className="rp-link" onClick={() => showDetail('expense-categories')}>View all expenses →</button>
      </section>

      <section className="rp-card header-blue">
        <header><h2>Restaurant Health Meter</h2><button onClick={() => showDetail('profit-loss')}>Full Report →</button></header>
        <HealthMeter score={healthScore} />
      </section>

      <section className="rp-card header-red">
        <header><h2>Recent Alerts & Insights</h2><button>View All</button></header>
        <div className="rp-alert-list">
          <div><Icon name="alert" /><b>Food Cost is {pct(derived.foodCostPercent)}</b><span>Review purchasing if above target.</span></div>
          <div><Icon name="shield" /><b>Prime Cost is {pct(primePct)}</b><span>Food + labor as percent of sales.</span></div>
          <div><Icon name="trendingUp" /><b>Operating Profit</b><span>{money(operatingProfit)} for selected range.</span></div>
          <div><Icon name="users" /><b>Payroll is {pct(laborPct)} of Sales</b><span>Monitor labor cost by week.</span></div>
        </div>
      </section>
    </div>

    <section className="rp-card rp-wide-card header-teal">
      <header><h2>Weekly Summary by Category</h2><button onClick={() => showDetail('expense-categories')}>View full category report →</button></header>
      <div className="rp-summary-table">
        <table><thead><tr><th>Category</th><th>Sales</th><th>COGS</th><th>Gross Profit</th><th>Gross Profit %</th><th>Expenses</th><th>Net Profit</th></tr></thead><tbody>
          {(derived.vendorPurchaseCategoryRowsAll.length ? derived.vendorPurchaseCategoryRowsAll.slice(0, 5) : [{ label: 'Food', amount: cogs }]).map((row, idx) => {
            const amt = num(row.amount)
            const sales = derived.trueNetSalesMonth * (idx === 0 ? .45 : idx === 1 ? .25 : .12)
            const gp = sales - amt
            return <tr key={row.label || row.category || idx}><td>{row.label || row.category}</td><td>{money(sales)}</td><td>{money(amt)}</td><td>{money(gp)}</td><td>{pct(sales ? gp/sales*100 : 0)}</td><td>{money(derived.businessExpenseSpend/(idx+3))}</td><td>{money(gp - derived.businessExpenseSpend/(idx+3))}</td></tr>
          })}
          <tr className="total"><td>Total</td><td>{money(derived.trueNetSalesMonth)}</td><td>{money(cogs)}</td><td>{money(derived.trueNetSalesMonth - cogs)}</td><td>{pct(derived.trueNetSalesMonth ? (derived.trueNetSalesMonth-cogs)/derived.trueNetSalesMonth*100 : 0)}</td><td>{money(derived.businessExpenseSpend)}</td><td>{money(operatingProfit)}</td></tr>
        </tbody></table>
      </div>
    </section>

    <section className="rp-intelligence-panel">
      <header><h2><Icon name="shield" /> Restaurant Intelligence</h2><p>Key insights and performance indicators</p></header>
      <div className="rp-insight-grid">
        <InsightCard icon="dollar" title="Cash Position" value={money(cashRemaining)} subtitle="Cash remaining after expenses & payroll" tone="green" />
        <InsightCard icon="pie" title="Prime Cost" value={pct(primePct)} subtitle="Food + labor % of sales" tone="blue" />
        <InsightCard icon="employees" title="Labor Cost %" value={pct(laborPct)} subtitle="Total labor cost of sales" tone="purple" />
        <InsightCard icon="utensils" title="Food Cost %" value={pct(derived.foodCostPercent)} subtitle="Target: 28–32%" tone="orange" />
        <InsightCard icon="trendingUp" title="Operating Profit" value={pct(profitMargin)} subtitle={money(operatingProfit)} tone="teal" />
        <InsightCard icon="reports" title="Sales This Week" value={money(derived.trueNetSalesMonth)} subtitle="Net sales performance" tone="blue" />
      </div>
    </section>

    <div id="dashboard-details">
      {currentDetail ? <DetailTable title={currentDetail.title} rows={currentDetail.rows} columns={currentDetail.columns} onOpen={() => openScreen(currentDetail.open)} message={currentDetail.message} /> : null}
    </div>
  </>
}
