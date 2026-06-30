import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { getAllCategories, inferCategory, sumRowsByCategory as sumByCategoryEngine, categoryGroup, categoriesForGroup, rollupCategoryRows } from '../engine/CategoryEngine'

function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const text = String(value ?? '').replace(/[$,%]/g, '').replace(/,/g, '').trim()
  if (!text) return 0
  if (/^\(.+\)$/.test(text)) return -(Number(text.replace(/[()]/g, '')) || 0)
  return Number(text) || 0
}
function money(value) { return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function pct(value) { return `${Number(value || 0).toFixed(1)}%` }
function todayISO() { return new Date().toISOString().slice(0, 10) }
function startOfMonthISO(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10) }
function readSavedDateRange() {
  try {
    const saved = JSON.parse(localStorage.getItem('restapay_global_date_range') || '{}')
    return { start: saved.start || startOfMonthISO(), end: saved.end || todayISO() }
  } catch {
    return { start: startOfMonthISO(), end: todayISO() }
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
function payrollType(row) { return String(row.payment_method || row.payroll_type || row.type || row.pay_method || row.method || '').toLowerCase() }
function isCashPayroll(row) { return payrollType(row).includes('cash') }
function isCheckPayroll(row) { return payrollType(row).includes('check') }
function invoiceTotal(row) { return num(row.total || row.amount || row.invoice_total || row.grand_total) }
function itemUnit(row) { return num(row.unit_price || row.price || row.cost || row.item_price || row.rate) }
function itemAmount(row) { return num(row.line_total || row.total || row.amount || row.extended_price || (num(row.qty || row.quantity) * itemUnit(row))) }
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
  return String(value || 'Other').trim() || 'Other'
}
function filterRowsByFinancialGroup(rows = [], group = 'business') { return rows.filter(row => categoryGroup(row.category || row.label) === group) }
function rowsTotal(rows = []) { return rows.reduce((sum, row) => sum + num(row.amount), 0) }
function rangeText(start, end) { return `${start || 'First record'} to ${end || 'Latest record'}` }

function Meter({ value = 0, label, target, tone = 'blue' }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0))
  return <div className="health-meter-row">
    <div><strong>{label}</strong><small>{target}</small></div>
    <div className="meter-track"><span className={`meter-fill ${tone}`} style={{ width: `${safe}%` }} /></div>
    <b>{safe.toFixed(0)}</b>
  </div>
}

function MetricCard({ title, value, meta, icon, tone = 'blue', onClick }) {
  return <button type="button" className={`metric-card tone-${tone}`} onClick={onClick}>
    <div className="metric-header"><span><Icon name={icon} size={18} /></span><em>{title}</em></div>
    <strong>{value}</strong>
    <small>{meta}</small>
  </button>
}

function SectionCard({ title, subtitle, total, icon, tone = 'navy', rows = [], footer, action }) {
  return <section className={`section-card card-${tone}`}>
    <header className="section-card-head">
      <div className="section-title"><span><Icon name={icon} size={18} /></span><div><h2>{title}</h2><small>{subtitle}</small></div></div>
      {total ? <strong>{total}</strong> : null}
    </header>
    <div className="section-card-body">
      {rows.length ? rows.map((row, index) => <button key={row.id || `${title}-${index}`} type="button" className="insight-row" onClick={row.onClick || action}>
        <div><b>{row.label}</b>{row.meta ? <small>{row.meta}</small> : null}</div><strong>{row.amount}</strong>
      </button>) : <div className="empty-state">No data in selected range.</div>}
    </div>
    {footer ? <footer className="section-card-foot">{footer}</footer> : null}
  </section>
}

function DetailTable({ config, openScreen }) {
  if (!config) return null
  return <section className="table-card dashboard-detail-card" id="dashboard-details">
    <header><div><h2>{config.title}</h2>{config.message ? <p>{config.message}</p> : null}</div><button className="btn solid secondary" type="button" onClick={() => openScreen(config.open)}>Open Screen</button></header>
    <div className="table-scroll"><table><thead><tr>{config.columns.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>
      {config.rows.length ? config.rows.slice(0, 16).map((row, index) => <tr key={row.id || `${config.title}-${index}`}>{config.columns.map(col => <td key={col.key}>{col.render ? col.render(row) : String(row[col.key] ?? '-')}</td>)}</tr>) : <tr><td colSpan={config.columns.length}><small>No detail records to show.</small></td></tr>}
    </tbody></table></div>
  </section>
}

export default function Dashboard({ data = {}, setActive }) {
  const [detail, setDetail] = useState('')
  const [dateStart, setDateStart] = useState(() => readSavedDateRange().start)
  const [dateEnd, setDateEnd] = useState(() => readSavedDateRange().end)
  const salesDays = data.salesDays || []
  const payroll = data.payrollEntries || []
  const invoices = data.invoices || []
  const invoiceItems = data.invoiceItems || []
  const expenseRows = data.expenses || []
  const employees = data.employees || []
  const vendors = data.vendors || []
  const groups = data.payrollGroups || []
  const allConfiguredCategories = getAllCategories(data || {})

  function updateStart(value) { setDateStart(value); saveGlobalDateRange(value, dateEnd) }
  function updateEnd(value) { setDateEnd(value); saveGlobalDateRange(dateStart, value) }
  function setThisMonth() { const start = startOfMonthISO(); const end = todayISO(); setDateStart(start); setDateEnd(end); saveGlobalDateRange(start, end) }
  function setAllDates() { setDateStart(''); setDateEnd(''); saveGlobalDateRange('', '') }
  function inSelectedRange(dateText) {
    const d = String(dateText || '').slice(0, 10)
    if (!d) return false
    if (dateStart && d < dateStart) return false
    if (dateEnd && d > dateEnd) return false
    return true
  }

  const derived = useMemo(() => {
    const today = todayISO()
    const todaySales = salesDays.filter(row => rowDate(row, ['business_date', 'date']) === today)
    const weekSales = salesDays.filter(row => thisWeek(rowDate(row, ['business_date', 'date'])))
    const monthSales = salesDays.filter(row => inSelectedRange(rowDate(row, ['business_date', 'date'])))
    const monthPayroll = payroll.filter(row => inSelectedRange(rowDate(row, ['pay_date', 'payroll_date', 'date'])))
    const cashPayrollRows = monthPayroll.filter(isCashPayroll)
    const checkPayrollRows = monthPayroll.filter(isCheckPayroll)
    const monthInvoices = invoices.filter(row => inSelectedRange(rowDate(row, ['invoice_date', 'date'])))
    const monthExpenses = expenseRows.filter(row => inSelectedRange(rowDate(row, ['date', 'expense_date'])))
    const invoiceById = Object.fromEntries(invoices.map(inv => [inv.id, inv]))
    const monthInvoiceItems = invoiceItems.filter(row => {
      const inv = invoiceById[row.invoice_id] || {}
      const date = rowDate(row, ['invoice_date', 'date', 'created_at']) || rowDate(inv, ['invoice_date', 'date'])
      return inSelectedRange(date)
    })
    const salesToday = todaySales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const salesWeek = weekSales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const salesMonth = monthSales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const grossSales = monthSales.reduce((sum, row) => sum + num(row.gross_sales || row.total_sales || row.net_sales), 0)
    const cashMonth = monthSales.reduce((sum, row) => sum + num(row.cash_sales), 0)
    const creditSales = monthSales.reduce((sum, row) => sum + num(row.credit_sales), 0)
    const giftSales = monthSales.reduce((sum, row) => sum + num(row.gift_card_sales), 0)
    const onlineSales = monthSales.reduce((sum, row) => sum + num(row.online_orders), 0)
    const taxMonth = monthSales.reduce((sum, row) => sum + num(row.tax), 0)
    const tipsMonth = monthSales.reduce((sum, row) => sum + num(row.tips), 0)
    const tipsWithheldMonth = monthSales.reduce((sum, row) => sum + num(row.tips_withheld || row.tip_deduction || row.tips_withholding), 0)
    const tipsAfterWithholdingMonth = Math.max(0, tipsMonth - tipsWithheldMonth)
    const trueNetSalesMonth = Math.max(0, salesMonth - taxMonth - tipsAfterWithholdingMonth)
    const cashPayroll = cashPayrollRows.reduce((sum, row) => sum + num(row.total_pay || row.total || row.amount), 0)
    const checkPayroll = checkPayrollRows.reduce((sum, row) => sum + num(row.total_pay || row.total || row.amount), 0)
    const payrollMonth = monthPayroll.reduce((sum, row) => sum + num(row.total_pay || row.total || row.amount), 0)
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
    const invoiceHeaderCategorySpend = monthInvoices.filter(row => !invoicesWithLineItems.has(row.id)).map(row => ({ ...row, source: 'Invoice', amount: invoiceTotal(row), category: inferCategory(row), date: rowDate(row, ['invoice_date', 'date']) }))
    const expenseCategorySpend = monthExpenses.map(row => ({ ...row, source: 'Expense', amount: num(row.amount), category: inferCategory(row), date: rowDate(row, ['date', 'expense_date']) }))
    const allExpenseRows = [...invoiceItemCategorySpend, ...invoiceHeaderCategorySpend, ...expenseCategorySpend]
    const totalExpensesAll = allExpenseRows.reduce((sum, row) => sum + num(row.amount), 0)
    const categoryRows = sumByCategoryEngine(allExpenseRows, allConfiguredCategories)
    const vendorRowsRaw = filterRowsByFinancialGroup(allExpenseRows, 'vendor')
    const businessRowsRaw = filterRowsByFinancialGroup(allExpenseRows, 'business')
    const vendorCategoryRowsAll = sumByCategoryEngine(vendorRowsRaw, categoriesForGroup(data || {}, 'vendor'))
    const businessCategoryRowsAll = sumByCategoryEngine(businessRowsRaw, categoriesForGroup(data || {}, 'business'))
    const vendorCategoryRows = rollupCategoryRows(vendorCategoryRowsAll, 'vendor', 8)
    const businessCategoryRows = rollupCategoryRows(businessCategoryRowsAll, 'business', 8)
    const vendorSpend = rowsTotal(vendorRowsRaw)
    const businessSpend = rowsTotal(businessRowsRaw)
    const foodSpend = categoryRows.find(row => normalizeSpendCategory(row.category || row.label) === 'Food')?.amount || 0
    const cogs = vendorCategoryRowsAll.filter(row => ['Food', 'Beverage', 'Beer', 'Liquor'].includes(normalizeSpendCategory(row.label || row.category))).reduce((sum, row) => sum + num(row.amount), 0) || foodSpend
    const restaurantPayroll = payrollMonth
    const operatingProfit = trueNetSalesMonth - cogs - restaurantPayroll - businessSpend
    const cashRemaining = cashMonth - cashPayroll - vendorRowsRaw.filter(row => String(row.payment_type || row.payment_method || '').toLowerCase().includes('cash')).reduce((sum, row) => sum + num(row.amount), 0) - monthExpenses.filter(row => String(row.payment_type || row.payment_method || '').toLowerCase().includes('cash')).reduce((sum, row) => sum + num(row.amount), 0)
    const foodCostPercent = salesMonth > 0 ? (foodSpend / salesMonth) * 100 : 0
    const laborPercent = trueNetSalesMonth > 0 ? (restaurantPayroll / trueNetSalesMonth) * 100 : 0
    const primeCost = cogs + restaurantPayroll
    const primeCostPercent = trueNetSalesMonth > 0 ? (primeCost / trueNetSalesMonth) * 100 : 0
    const profitMargin = trueNetSalesMonth > 0 ? (operatingProfit / trueNetSalesMonth) * 100 : 0
    const healthScore = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, foodCostPercent - 30) * 1.2 - Math.max(0, laborPercent - 25) * 1.2 - Math.max(0, primeCostPercent - 65) - (cashRemaining < 0 ? 12 : 0) + (profitMargin > 12 ? 6 : 0))))
    const vendorRecentRows = [...vendorRowsRaw].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    const businessRecentRows = [...businessRowsRaw].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

    return { todaySales, weekSales, monthSales, monthPayroll, cashPayrollRows, checkPayrollRows, monthInvoices, monthExpenses, monthInvoiceItems, salesToday, salesWeek, salesMonth, grossSales, creditSales, giftSales, onlineSales, cashMonth, taxMonth, tipsMonth, tipsWithheldMonth, tipsAfterWithholdingMonth, trueNetSalesMonth, cashPayroll, checkPayroll, payrollMonth, invoiceSpend, expenseSpend, totalExpensesAll, categoryRows, vendorCategoryRows, vendorCategoryRowsAll, businessCategoryRows, businessCategoryRowsAll, vendorRecentRows, businessRecentRows, vendorSpend, businessSpend, foodSpend, cogs, foodCostPercent, laborPercent, primeCost, primeCostPercent, operatingProfit, profitMargin, cashRemaining, healthScore, allExpenseRows }
  }, [salesDays, payroll, invoices, invoiceItems, expenseRows, dateStart, dateEnd, allConfiguredCategories, data])

  function openScreen(key) { if (setActive) setActive(key) }
  function showDetail(key) { setDetail(key); setTimeout(() => document.getElementById('dashboard-details')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0) }

  const detailConfig = {
    sales: { title: 'Sales Selected Range', open: 'sales', rows: derived.monthSales, columns: [
      { key: 'business_date', label: 'Date', render: row => rowDate(row, ['business_date', 'date']) }, { key: 'net_sales', label: 'Net Sales', render: row => money(num(row.net_sales)) }, { key: 'cash_sales', label: 'Cash', render: row => money(num(row.cash_sales)) }, { key: 'credit_sales', label: 'Credit', render: row => money(num(row.credit_sales)) }, { key: 'tips', label: 'Tips', render: row => money(num(row.tips)) }
    ]},
    cash: { title: 'Cash Position Details', open: 'sales', message: `Remaining cash estimate: ${money(derived.cashRemaining)}`, rows: derived.monthSales, columns: [
      { key: 'business_date', label: 'Date', render: row => rowDate(row, ['business_date', 'date']) }, { key: 'cash_sales', label: 'Cash Sales', render: row => money(num(row.cash_sales)) }, { key: 'net_sales', label: 'Net Sales', render: row => money(num(row.net_sales)) }, { key: 'source_file', label: 'Source', render: row => row.source_file || '-' }
    ]},
    payroll: { title: 'Payroll Details', open: 'payroll', rows: derived.monthPayroll, columns: [
      { key: 'pay_date', label: 'Date', render: row => rowDate(row, ['pay_date', 'payroll_date', 'date']) }, { key: 'employee_name', label: 'Employee', render: row => row.employee_name || row.name || '-' }, { key: 'payment_method', label: 'Method', render: row => row.payment_method || row.payroll_type || row.method || '-' }, { key: 'total_pay', label: 'Total', render: row => money(num(row.total_pay || row.total || row.amount)) }
    ]},
    vendors: { title: 'Vendor Purchase Details', open: 'invoices', rows: derived.vendorRecentRows, columns: [
      { key: 'date', label: 'Date', render: row => row.date || rowDate(row, ['invoice_date', 'date']) }, { key: 'vendor', label: 'Vendor', render: row => row.vendor || row.vendor_name || row.name || '-' }, { key: 'category', label: 'Category', render: row => row.category || '-' }, { key: 'amount', label: 'Amount', render: row => money(num(row.amount)) }
    ]},
    expenses: { title: 'Business Expenses', open: 'expenses', rows: derived.businessRecentRows, columns: [
      { key: 'date', label: 'Date', render: row => row.date || rowDate(row, ['date', 'expense_date']) }, { key: 'name', label: 'Expense', render: row => row.name || row.vendor || row.category || '-' }, { key: 'category', label: 'Category', render: row => row.category || '-' }, { key: 'amount', label: 'Amount', render: row => money(num(row.amount)) }
    ]},
    categories: { title: 'Expense Categories', open: 'expenses', rows: derived.categoryRows, columns: [
      { key: 'category', label: 'Category', render: row => row.label || row.category }, { key: 'amount', label: 'Total', render: row => money(num(row.amount)) }
    ]}
  }

  const metrics = [
    { title: 'Net Sales', value: money(derived.trueNetSalesMonth), meta: `${derived.monthSales.length} sales rows`, icon: 'dollar', tone: 'blue', detail: 'sales' },
    { title: 'Gross Sales', value: money(derived.grossSales), meta: 'Before tax and tips adjustments', icon: 'store', tone: 'purple', detail: 'sales' },
    { title: 'Cash Remaining', value: money(derived.cashRemaining), meta: `${money(derived.cashMonth)} cash collected`, icon: 'wallet', tone: 'green', detail: 'cash' },
    { title: 'Operating Profit', value: money(derived.operatingProfit), meta: `${pct(derived.profitMargin)} profit margin`, icon: 'trendingUp', tone: 'teal', detail: 'sales' },
    { title: 'Food Cost', value: pct(derived.foodCostPercent), meta: `${money(derived.foodSpend)} food spend`, icon: 'utensils', tone: 'orange', detail: 'vendors' },
    { title: 'Labor Cost', value: pct(derived.laborPercent), meta: `${money(derived.payrollMonth)} payroll`, icon: 'payroll', tone: 'red', detail: 'payroll' }
  ]

  const advisorRows = [
    { label: 'Restaurant Health', amount: `${derived.healthScore}/100`, meta: derived.healthScore >= 80 ? 'Strong operating position' : derived.healthScore >= 60 ? 'Watch cost pressure' : 'Needs immediate review' },
    { label: 'Prime Cost', amount: pct(derived.primeCostPercent), meta: `${money(derived.primeCost)} combined COGS + labor` },
    { label: 'Tips After Withholding', amount: money(derived.tipsAfterWithholdingMonth), meta: `${money(derived.tipsWithheldMonth)} withheld` },
    { label: 'Total Expenses', amount: money(derived.totalExpensesAll), meta: `${derived.categoryRows.length} categories` }
  ]

  return <>
    <div className="dashboard-hero">
      <div className="hero-copy">
        <span className="eyebrow">Restaurant Intelligence</span>
        <h1>Executive dashboard</h1>
        <p>Track sales, cash, payroll, vendor purchases, business expenses, and restaurant health from one clean view.</p>
      </div>
      <div className="hero-actions">
        <button className="btn solid secondary" type="button" onClick={() => openScreen('invoices')}><Icon name="invoices" size={16} /> Add Invoice</button>
        <button className="btn solid secondary" type="button" onClick={() => openScreen('expenses')}><Icon name="plus" size={16} /> Add Expense</button>
        <button className="btn solid primary" type="button" onClick={() => openScreen('sales')}><Icon name="upload" size={16} /> Import Toast</button>
      </div>
    </div>

    <div className="filter-card">
      <label><span>Start</span><input type="date" value={dateStart} onChange={event => updateStart(event.target.value)} /></label>
      <label><span>End</span><input type="date" value={dateEnd} onChange={event => updateEnd(event.target.value)} /></label>
      <button type="button" className="btn solid primary" onClick={() => saveGlobalDateRange(dateStart, dateEnd)}>Apply</button>
      <button type="button" className="btn solid muted" onClick={setThisMonth}>This Month</button>
      <button type="button" className="btn solid muted" onClick={setAllDates}>All Dates</button>
      <strong>{rangeText(dateStart, dateEnd)}</strong>
    </div>

    <div className="metric-grid">
      {metrics.map(card => <MetricCard key={card.title} {...card} onClick={() => showDetail(card.detail)} />)}
    </div>

    <div className="dashboard-grid">
      <section className="health-card">
        <header><div><span className="eyebrow">Health Meter</span><h2>Restaurant Health</h2></div><strong>{derived.healthScore}</strong></header>
        <div className="health-circle"><span>{derived.healthScore}</span><small>Score</small></div>
        <Meter label="Food Cost" target="Target under 30%" value={100 - Math.max(0, derived.foodCostPercent - 20) * 2} tone="orange" />
        <Meter label="Labor Cost" target="Target under 25%" value={100 - Math.max(0, derived.laborPercent - 15) * 2} tone="teal" />
        <Meter label="Prime Cost" target="Target under 65%" value={100 - Math.max(0, derived.primeCostPercent - 45) * 1.5} tone="blue" />
      </section>

      <SectionCard title="Cash Position" subtitle="Cash collected and cash outflow" total={money(derived.cashRemaining)} icon="wallet" tone="green" action={() => showDetail('cash')} rows={[
        { label: 'Cash Collected', amount: money(derived.cashMonth), meta: 'Toast cash sales' },
        { label: 'Cash Payroll', amount: money(derived.cashPayroll), meta: `${derived.cashPayrollRows.length} payroll rows` },
        { label: 'Check Payroll', amount: money(derived.checkPayroll), meta: `${derived.checkPayrollRows.length} check rows` },
        { label: 'Remaining Cash', amount: money(derived.cashRemaining), meta: 'After visible cash outflows' }
      ]} />

      <SectionCard title="Profit & Loss" subtitle="Restaurant operating view" total={money(derived.operatingProfit)} icon="receipt" tone="purple" action={() => showDetail('sales')} rows={[
        { label: 'Net Restaurant Sales', amount: money(derived.trueNetSalesMonth), meta: 'Sales less tax and pass-through tips' },
        { label: 'COGS Estimate', amount: money(derived.cogs), meta: 'Food, beverage, beer, liquor' },
        { label: 'Restaurant Payroll', amount: money(derived.payrollMonth), meta: 'Tips tracked separately in payroll' },
        { label: 'Business Expenses', amount: money(derived.businessSpend), meta: 'Operating expense categories' }
      ]} />
    </div>

    <div className="dashboard-grid three">
      <SectionCard title="Vendor Purchases" subtitle={`${derived.vendorRecentRows.length} purchase rows`} total={money(derived.vendorSpend)} icon="invoices" tone="orange" action={() => showDetail('vendors')} rows={derived.vendorRecentRows.slice(0, 7).map(row => ({ label: row.vendor || row.vendor_name || row.name || 'Vendor Purchase', meta: `${row.date || rowDate(row, ['invoice_date', 'date'])} • ${row.category || 'Other'}`, amount: money(num(row.amount)) }))} footer={<button className="btn solid orange" type="button" onClick={() => showDetail('vendors')}>View Vendor Details</button>} />
      <SectionCard title="Business Expenses" subtitle={`${derived.businessRecentRows.length} operating rows`} total={money(derived.businessSpend)} icon="expenses" tone="red" action={() => showDetail('expenses')} rows={derived.businessRecentRows.slice(0, 7).map(row => ({ label: row.vendor || row.name || row.category || 'Expense', meta: `${row.date || rowDate(row, ['date', 'expense_date'])} • ${row.category || row.payment_method || ''}`, amount: money(num(row.amount)) }))} footer={<button className="btn solid danger" type="button" onClick={() => showDetail('expenses')}>View Expenses</button>} />
      <SectionCard title="Restaurant Intelligence" subtitle="Actionable owner summary" total={`${derived.healthScore}/100`} icon="zap" tone="navy" rows={advisorRows} footer={<div className="intelligence-foot"><b>{employees.length}</b><span>Employees</span><b>{vendors.length}</b><span>Vendors</span><b>{groups.length}</b><span>Payroll Groups</span></div>} />
    </div>

    <DetailTable config={detailConfig[detail]} openScreen={openScreen} />
  </>
}
