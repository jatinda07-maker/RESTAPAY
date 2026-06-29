import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { inferCategory, categoryGroup, categoriesForGroup, sumRowsByCategory, rollupCategoryRows } from '../engine/CategoryEngine'

function num(value) {
  if (typeof value === 'number') return value
  const text = String(value ?? '').replace(/[$,%]/g, '').replace(/,/g, '').trim()
  if (!text) return 0
  if (/^\(.+\)$/.test(text)) return -Number(text.replace(/[()]/g, '')) || 0
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
function saveDateRange(start, end) {
  try { localStorage.setItem('restapay_global_date_range', JSON.stringify({ start, end })) } catch {}
}
function rowDate(row, keys = []) {
  for (const key of keys) if (row?.[key]) return String(row[key]).slice(0, 10)
  return String(row?.business_date || row?.pay_date || row?.invoice_date || row?.date || row?.expense_date || row?.created_at || '').slice(0, 10)
}
function inRange(row, start, end, keys = []) {
  const date = rowDate(row, keys)
  if (!date) return false
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}
function invoiceTotal(row) { return num(row.total || row.amount || row.invoice_total || row.grand_total) }
function itemUnit(row) { return num(row.unit_price || row.price || row.cost || row.item_price || row.rate) }
function itemAmount(row) { return num(row.line_total || row.total || row.amount || row.extended_price || (num(row.qty || row.quantity) * itemUnit(row))) }
function paymentText(row) { return String(row.payment_method || row.payment_type || row.pay_method || row.payroll_type || row.type || '').toLowerCase() }
function isCash(row) { return paymentText(row).includes('cash') }
function isCheck(row) { return paymentText(row).includes('check') }
function payrollTotal(row) { return num(row.total_pay || row.amount || row.pay || row.regular_pay || row.base_pay) + num(row.extra_pay) }
function payrollTipAmount(row) { return num(row.tips_after_withheld || row.tips_after_withholding || row.final_tips || row.net_tips || row.tips_paid || row.tips || row.tip_amount) }
function restaurantPayrollCost(row) { return Math.max(payrollTotal(row) - payrollTipAmount(row), 0) }
function salesTipsCollected(row) {
  const explicit = num(row.tips_collected || row.total_tips || row.tips_before_withholding || row.actual_tips)
  if (explicit) return explicit
  const net = num(row.tips_after_withholding || row.net_tips || row.tips)
  const withheld = num(row.tips_withheld || row.tips_withholding || row.tip_deduction)
  if (net && withheld) return net + Math.abs(withheld)
  if (net) return net / 0.965
  return 0
}
function salesTipsWithheld(row) {
  const explicit = Math.abs(num(row.tips_withheld || row.tips_withholding || row.tip_deduction))
  if (explicit) return explicit
  const collected = salesTipsCollected(row)
  return collected ? collected * 0.035 : 0
}
function salesTipsNet(row) {
  const explicit = num(row.tips_after_withholding || row.net_tips || row.tips)
  if (explicit) return explicit
  const collected = salesTipsCollected(row)
  return Math.max(collected - salesTipsWithheld(row), 0)
}
function categoryIsCogs(category) {
  const normalized = inferCategory({ category })
  return ['Food', 'Beverage', 'Beer', 'Liquor'].includes(normalized)
}
function rowsTotal(rows = [], key = 'amount') { return rows.reduce((sum, row) => sum + num(row[key]), 0) }
function sortByAmount(rows = []) { return [...rows].sort((a, b) => num(b.amount) - num(a.amount)) }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)) }

function buildSpendRows(data, start, end) {
  const invoices = data?.invoices || []
  const invoiceItems = data?.invoiceItems || []
  const expenses = data?.expenses || []
  const invoiceById = Object.fromEntries(invoices.map(row => [row.id, row]))
  const periodInvoices = invoices.filter(row => inRange(row, start, end, ['invoice_date', 'date']))
  const periodItems = invoiceItems.filter(row => {
    const inv = invoiceById[row.invoice_id] || {}
    return inRange({ ...row, date: rowDate(row, ['invoice_date', 'date']) || rowDate(inv, ['invoice_date', 'date']) }, start, end, ['date'])
  })
  const invoicesWithItems = new Set(periodItems.map(row => row.invoice_id).filter(Boolean))

  const itemRows = periodItems.map(row => {
    const inv = invoiceById[row.invoice_id] || {}
    const vendor = inv.vendor || inv.vendor_name || row.vendor || row.vendor_name || 'Vendor'
    const category = inferCategory({ ...row, category: row.category || inv.category, vendor })
    return {
      ...row,
      source: 'Invoice Item',
      vendor,
      vendor_name: vendor,
      category,
      amount: itemAmount(row),
      date: rowDate(row, ['invoice_date', 'date']) || rowDate(inv, ['invoice_date', 'date']),
      payment_method: inv.payment_method || row.payment_method
    }
  }).filter(row => num(row.amount) > 0)

  const invoiceRows = periodInvoices
    .filter(row => !invoicesWithItems.has(row.id))
    .map(row => ({
      ...row,
      source: 'Invoice',
      vendor: row.vendor || row.vendor_name || row.name || 'Vendor',
      category: inferCategory(row),
      amount: invoiceTotal(row),
      date: rowDate(row, ['invoice_date', 'date'])
    }))
    .filter(row => num(row.amount) > 0)

  const expenseRows = expenses
    .filter(row => inRange(row, start, end, ['date', 'expense_date']))
    .map(row => ({
      ...row,
      source: 'Expense',
      vendor: row.vendor || row.name || row.category || 'Business Expense',
      category: inferCategory(row),
      amount: num(row.amount),
      date: rowDate(row, ['date', 'expense_date'])
    }))
    .filter(row => num(row.amount) > 0)

  return [...itemRows, ...invoiceRows, ...expenseRows]
}

function calculateDashboard(data, start, end) {
  const sales = (data?.salesDays || []).filter(row => inRange(row, start, end, ['business_date', 'date']))
  const payroll = (data?.payrollEntries || []).filter(row => inRange(row, start, end, ['pay_date', 'date']))
  const spendRows = buildSpendRows(data, start, end)
  const vendorRows = spendRows.filter(row => categoryGroup(row.category) === 'vendor')
  const businessRows = spendRows.filter(row => categoryGroup(row.category) === 'business')
  const cogsRows = spendRows.filter(row => categoryIsCogs(row.category))

  const grossSales = sales.reduce((sum, row) => sum + num(row.gross_sales || row.total_sales || row.net_sales), 0)
  const netSalesRaw = sales.reduce((sum, row) => sum + num(row.net_sales), 0)
  const tax = sales.reduce((sum, row) => sum + num(row.tax), 0)
  const discounts = sales.reduce((sum, row) => sum + Math.abs(num(row.discounts)), 0)
  const refunds = sales.reduce((sum, row) => sum + Math.abs(num(row.refunds)), 0)
  const netSales = netSalesRaw || Math.max(grossSales - discounts - refunds, 0)
  const cashSales = sales.reduce((sum, row) => sum + num(row.cash_sales), 0)
  const creditSales = sales.reduce((sum, row) => sum + num(row.credit_sales), 0)
  const onlineSales = sales.reduce((sum, row) => sum + num(row.online_orders), 0)
  const giftSales = sales.reduce((sum, row) => sum + num(row.gift_card_sales), 0)
  const guests = sales.reduce((sum, row) => sum + num(row.guest_count), 0)
  const averageTicket = guests > 0 ? netSales / guests : 0

  const tipsCollected = sales.reduce((sum, row) => sum + salesTipsCollected(row), 0)
  const tipsWithheld = sales.reduce((sum, row) => sum + salesTipsWithheld(row), 0)
  const netTipsPaidFromSales = sales.reduce((sum, row) => sum + salesTipsNet(row), 0)

  const payrollCost = payroll.reduce((sum, row) => sum + restaurantPayrollCost(row), 0)
  const payrollTips = payroll.reduce((sum, row) => sum + payrollTipAmount(row), 0)
  const tipsPaid = payrollTips || netTipsPaidFromSales
  const cashPayroll = payroll.filter(isCash).reduce((sum, row) => sum + restaurantPayrollCost(row), 0)
  const checkPayroll = payroll.filter(isCheck).reduce((sum, row) => sum + restaurantPayrollCost(row), 0)

  const cogs = cogsRows.reduce((sum, row) => sum + num(row.amount), 0)
  const vendorSpend = vendorRows.reduce((sum, row) => sum + num(row.amount), 0)
  const businessExpenses = businessRows.reduce((sum, row) => sum + num(row.amount), 0)
  const operatingExpenses = businessExpenses
  const operatingProfit = netSales - cogs - payrollCost - operatingExpenses
  const profitMargin = netSales > 0 ? (operatingProfit / netSales) * 100 : 0
  const foodCostPct = netSales > 0 ? (cogs / netSales) * 100 : 0
  const laborPct = netSales > 0 ? (payrollCost / netSales) * 100 : 0
  const primeCost = cogs + payrollCost
  const primeCostPct = netSales > 0 ? (primeCost / netSales) * 100 : 0

  const cashVendor = vendorRows.filter(isCash).reduce((sum, row) => sum + num(row.amount), 0)
  const cashExpenses = businessRows.filter(isCash).reduce((sum, row) => sum + num(row.amount), 0)
  const cashRemaining = cashSales - cashPayroll - cashVendor - cashExpenses

  const vendorCategoryRows = rollupCategoryRows(sumRowsByCategory(vendorRows, categoriesForGroup(data || {}, 'vendor')), 'vendor', 7)
  const businessCategoryRows = rollupCategoryRows(sumRowsByCategory(businessRows, categoriesForGroup(data || {}, 'business')), 'business', 7)
  const vendorRecentRows = [...vendorRows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 7)
  const expenseRecentRows = [...businessRows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 7)

  const healthScore = Math.round(clamp(
    100
    - Math.max(foodCostPct - 32, 0) * 1.5
    - Math.max(laborPct - 28, 0) * 1.5
    - Math.max(primeCostPct - 65, 0) * 1.2
    + Math.max(profitMargin, 0) * 0.8
    + (cashRemaining > 0 ? 6 : -10),
    0,
    100
  ))

  return {
    sales, payroll, spendRows, vendorRows, businessRows, cogsRows,
    grossSales, netSales, tax, discounts, refunds, cashSales, creditSales, onlineSales, giftSales, guests, averageTicket,
    tipsCollected, tipsWithheld, netTipsPaidFromSales, tipsPaid,
    payrollCost, payrollTips, cashPayroll, checkPayroll,
    cogs, vendorSpend, businessExpenses, operatingExpenses, operatingProfit, profitMargin,
    foodCostPct, laborPct, primeCost, primeCostPct, cashVendor, cashExpenses, cashRemaining,
    vendorCategoryRows, businessCategoryRows, vendorRecentRows, expenseRecentRows, healthScore
  }
}

function Kpi({ icon, label, value, detail, tone = 'blue', onClick }) {
  return <button className={`rc2-kpi rc2-${tone}`} type="button" onClick={onClick}>
    <span className="rc2-kpi-icon"><Icon name={icon} size={18} /></span>
    <span className="rc2-kpi-label">{label}</span>
    <strong>{value}</strong>
    <small>{detail}</small>
  </button>
}

function Panel({ title, subtitle, icon, action, children, className = '' }) {
  return <section className={`rc2-panel ${className}`}>
    <header className="rc2-panel-head">
      <div className="rc2-panel-title"><span><Icon name={icon} size={17} /></span><div><h2>{title}</h2><small>{subtitle}</small></div></div>
      {action ? <button type="button" onClick={action.onClick}>{action.label}</button> : null}
    </header>
    {children}
  </section>
}

function MetricLine({ label, value, strong = false, negative = false }) {
  return <div className={`rc2-metric-line ${strong ? 'strong' : ''} ${negative ? 'negative' : ''}`}><span>{label}</span><b>{value}</b></div>
}

function CategoryList({ rows = [], onClick }) {
  return <div className="rc2-category-list">
    {rows.length ? rows.map((row, idx) => {
      const amount = num(row.amount)
      return <button type="button" key={row.id || `${row.label}-${idx}`} onClick={onClick}>
        <span>{row.label || row.category}</span>
        <b>{money(amount)}</b>
      </button>
    }) : <div className="rc2-empty">No rows in this period.</div>}
  </div>
}

function ActivityRows({ rows = [], onClick }) {
  return <div className="rc2-activity-list">
    {rows.length ? rows.map((row, idx) => <button type="button" key={row.id || idx} onClick={onClick}>
      <div><b>{row.vendor || row.vendor_name || row.name || row.category || 'Item'}</b><small>{row.date || rowDate(row)} • {row.category || row.source || 'Other'}</small></div>
      <strong>{money(row.amount)}</strong>
    </button>) : <div className="rc2-empty">No recent rows in this period.</div>}
  </div>
}

function BarTrend({ metrics }) {
  const max = Math.max(...metrics.map(row => Math.abs(num(row.value))), 1)
  return <div className="rc2-trend-grid">
    {metrics.map(row => <div className="rc2-trend-row" key={row.label}>
      <span>{row.label}</span>
      <div><i style={{ width: `${Math.max(4, Math.abs(num(row.value)) / max * 100)}%` }} /></div>
      <b>{row.display}</b>
    </div>)}
  </div>
}

function DetailTable({ title, rows, columns }) {
  return <section className="rc2-detail-table">
    <h3>{title}</h3>
    <table><thead><tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>
      {rows.length ? rows.slice(0, 14).map((row, index) => <tr key={row.id || index}>{columns.map(col => <td key={col.key}>{col.render ? col.render(row) : String(row[col.key] ?? '-')}</td>)}</tr>) : <tr><td colSpan={columns.length}>No detail rows for selected date range.</td></tr>}
    </tbody></table>
  </section>
}

export default function Dashboard({ data = {}, setActive }) {
  const [detail, setDetail] = useState('')
  const saved = readSavedDateRange()
  const [dateStart, setDateStart] = useState(saved.start)
  const [dateEnd, setDateEnd] = useState(saved.end)
  const [vendorMode, setVendorMode] = useState('categories')
  const [expenseMode, setExpenseMode] = useState('categories')
  const metrics = useMemo(() => calculateDashboard(data, dateStart, dateEnd), [data, dateStart, dateEnd])

  function changeStart(value) { setDateStart(value); saveDateRange(value, dateEnd) }
  function changeEnd(value) { setDateEnd(value); saveDateRange(dateStart, value) }
  function thisMonth() { const start = startOfMonthISO(); const end = todayISO(); setDateStart(start); setDateEnd(end); saveDateRange(start, end) }
  function allTime() { setDateStart(''); setDateEnd(''); saveDateRange('', '') }
  function openScreen(screen) { if (setActive) setActive(screen) }

  const healthTone = metrics.healthScore >= 80 ? 'green' : metrics.healthScore >= 60 ? 'orange' : 'red'
  const detailColumns = {
    sales: [
      { key: 'business_date', label: 'Date', render: row => rowDate(row, ['business_date', 'date']) },
      { key: 'gross_sales', label: 'Gross', render: row => money(num(row.gross_sales || row.net_sales)) },
      { key: 'net_sales', label: 'Net', render: row => money(num(row.net_sales)) },
      { key: 'cash_sales', label: 'Cash', render: row => money(num(row.cash_sales)) },
      { key: 'tips', label: 'Net Tips', render: row => money(salesTipsNet(row)) }
    ],
    payroll: [
      { key: 'date', label: 'Date', render: row => rowDate(row, ['pay_date', 'date']) },
      { key: 'employee', label: 'Employee', render: row => row.employee_name || row.name || '-' },
      { key: 'cost', label: 'Restaurant Cost', render: row => money(restaurantPayrollCost(row)) },
      { key: 'tips', label: 'Customer Tips', render: row => money(payrollTipAmount(row)) }
    ],
    spend: [
      { key: 'date', label: 'Date', render: row => row.date || rowDate(row) },
      { key: 'vendor', label: 'Vendor / Expense', render: row => row.vendor || row.vendor_name || row.name || row.category || '-' },
      { key: 'category', label: 'Category', render: row => row.category || '-' },
      { key: 'amount', label: 'Amount', render: row => money(row.amount) }
    ]
  }

  return <div className="rc2-dashboard">
    <section className="rc2-hero">
      <div className="rc2-hero-copy">
        <span className="rc2-eyebrow">Restaurant Command Center</span>
        <h1>Dashboard</h1>
        <p>Profit, cash, payroll, vendor spend, tips, and restaurant health from one clean view.</p>
      </div>
      <div className="rc2-date-card">
        <label><span>From</span><input type="date" value={dateStart} onChange={event => changeStart(event.target.value)} /></label>
        <label><span>To</span><input type="date" value={dateEnd} onChange={event => changeEnd(event.target.value)} /></label>
        <button type="button" onClick={thisMonth}>This Month</button>
        <button type="button" onClick={allTime}>All</button>
      </div>
    </section>

    <section className="rc2-health-card">
      <div className={`rc2-health-score rc2-${healthTone}`}><strong>{metrics.healthScore}</strong><span>Health Score</span></div>
      <div className="rc2-health-summary">
        <h2>{metrics.operatingProfit >= 0 ? 'Restaurant is profitable for this period' : 'Restaurant is running at a loss for this period'}</h2>
        <p>Operating profit excludes customer-paid server tips so your profit is not understated.</p>
      </div>
      <div className="rc2-health-pills">
        <span>Food {pct(metrics.foodCostPct)}</span><span>Labor {pct(metrics.laborPct)}</span><span>Prime {pct(metrics.primeCostPct)}</span><span>Cash {money(metrics.cashRemaining)}</span>
      </div>
    </section>

    <section className="rc2-kpi-grid">
      <Kpi icon="dollar" label="Gross Sales" value={money(metrics.grossSales)} detail={`${metrics.sales.length} sales rows`} tone="blue" onClick={() => setDetail('sales')} />
      <Kpi icon="pie" label="Net Sales" value={money(metrics.netSales)} detail={`Tax ${money(metrics.tax)}`} tone="green" onClick={() => setDetail('sales')} />
      <Kpi icon="trending" label="Operating Profit" value={money(metrics.operatingProfit)} detail={`${pct(metrics.profitMargin)} margin`} tone={metrics.operatingProfit >= 0 ? 'green' : 'red'} onClick={() => setDetail('profit')} />
      <Kpi icon="wallet" label="Cash Remaining" value={money(metrics.cashRemaining)} detail={`Cash sales ${money(metrics.cashSales)}`} tone={metrics.cashRemaining >= 0 ? 'green' : 'red'} onClick={() => setDetail('cash')} />
      <Kpi icon="utensils" label="Food Cost" value={pct(metrics.foodCostPct)} detail={money(metrics.cogs)} tone="orange" onClick={() => setDetail('vendors')} />
      <Kpi icon="payroll" label="Labor Cost" value={pct(metrics.laborPct)} detail={money(metrics.payrollCost)} tone="purple" onClick={() => setDetail('payroll')} />
      <Kpi icon="shield" label="Prime Cost" value={pct(metrics.primeCostPct)} detail={money(metrics.primeCost)} tone="teal" onClick={() => setDetail('profit')} />
      <Kpi icon="gift" label="Tips Paid" value={money(metrics.tipsPaid)} detail={`${money(metrics.tipsWithheld)} withheld`} tone="pink" onClick={() => setDetail('tips')} />
    </section>

    <section className="rc2-main-grid">
      <Panel title="Restaurant Performance" subtitle="P&L from gross sales" icon="reports" action={{ label: 'Reports', onClick: () => openScreen('reports') }} className="rc2-span-2">
        <div className="rc2-performance-grid">
          <div className="rc2-statement">
            <MetricLine label="Gross Sales" value={money(metrics.grossSales)} strong />
            <MetricLine label="Sales Tax" value={money(metrics.tax)} negative />
            <MetricLine label="Net Restaurant Sales" value={money(metrics.netSales)} strong />
            <MetricLine label="COGS / Vendor Food & Beverage" value={money(metrics.cogs)} negative />
            <MetricLine label="Restaurant Payroll" value={money(metrics.payrollCost)} negative />
            <MetricLine label="Operating Expenses" value={money(metrics.operatingExpenses)} negative />
            <MetricLine label="Operating Profit" value={money(metrics.operatingProfit)} strong />
          </div>
          <BarTrend metrics={[
            { label: 'Food Cost', value: metrics.foodCostPct, display: pct(metrics.foodCostPct) },
            { label: 'Labor Cost', value: metrics.laborPct, display: pct(metrics.laborPct) },
            { label: 'Prime Cost', value: metrics.primeCostPct, display: pct(metrics.primeCostPct) },
            { label: 'Profit Margin', value: Math.max(metrics.profitMargin, 0), display: pct(metrics.profitMargin) }
          ]} />
        </div>
      </Panel>

      <Panel title="Cash Position" subtitle="Cash available after cash obligations" icon="wallet" action={{ label: 'Sales', onClick: () => openScreen('sales') }}>
        <div className="rc2-statement compact">
          <MetricLine label="Cash Collected" value={money(metrics.cashSales)} strong />
          <MetricLine label="Cash Payroll" value={money(metrics.cashPayroll)} negative />
          <MetricLine label="Cash Vendor Payments" value={money(metrics.cashVendor)} negative />
          <MetricLine label="Cash Business Expenses" value={money(metrics.cashExpenses)} negative />
          <MetricLine label="Remaining Cash" value={money(metrics.cashRemaining)} strong />
        </div>
      </Panel>

      <Panel title="Vendor Intelligence" subtitle={`${metrics.vendorRows.length} purchase rows`} icon="vendors" action={{ label: 'Vendors', onClick: () => openScreen('vendors') }}>
        <div className="rc2-tabs"><button className={vendorMode === 'categories' ? 'active' : ''} onClick={() => setVendorMode('categories')} type="button">Categories</button><button className={vendorMode === 'recent' ? 'active' : ''} onClick={() => setVendorMode('recent')} type="button">Recent</button></div>
        {vendorMode === 'categories' ? <CategoryList rows={metrics.vendorCategoryRows} onClick={() => setDetail('vendors')} /> : <ActivityRows rows={metrics.vendorRecentRows} onClick={() => setDetail('vendors')} />}
      </Panel>

      <Panel title="Business Expenses" subtitle={`${metrics.businessRows.length} operating rows`} icon="expenses" action={{ label: 'Expenses', onClick: () => openScreen('expenses') }}>
        <div className="rc2-tabs"><button className={expenseMode === 'categories' ? 'active' : ''} onClick={() => setExpenseMode('categories')} type="button">Categories</button><button className={expenseMode === 'recent' ? 'active' : ''} onClick={() => setExpenseMode('recent')} type="button">Recent</button></div>
        {expenseMode === 'categories' ? <CategoryList rows={metrics.businessCategoryRows} onClick={() => setDetail('expenses')} /> : <ActivityRows rows={metrics.expenseRecentRows} onClick={() => setDetail('expenses')} />}
      </Panel>

      <Panel title="Payroll & Tips" subtitle="Server tips shown separately from profit" icon="payroll" action={{ label: 'Payroll', onClick: () => openScreen('payroll') }}>
        <div className="rc2-statement compact">
          <MetricLine label="Restaurant Payroll Cost" value={money(metrics.payrollCost)} strong />
          <MetricLine label="Cash Payroll" value={money(metrics.cashPayroll)} />
          <MetricLine label="Check Payroll" value={money(metrics.checkPayroll)} />
          <MetricLine label="Tips Collected" value={money(metrics.tipsCollected)} />
          <MetricLine label="3.5% Withheld" value={money(metrics.tipsWithheld)} />
          <MetricLine label="Net Tips Paid" value={money(metrics.tipsPaid)} strong />
        </div>
      </Panel>

      <Panel title="Manager Action Center" subtitle="Alerts and next actions" icon="alert" action={{ label: 'Reports', onClick: () => openScreen('reports') }}>
        <div className="rc2-alert-list">
          <button type="button" className={metrics.foodCostPct > 32 ? 'danger' : 'good'}><Icon name={metrics.foodCostPct > 32 ? 'alert' : 'shield'} size={16} /><span>Food cost {metrics.foodCostPct > 32 ? 'above target' : 'within target'}</span><b>{pct(metrics.foodCostPct)}</b></button>
          <button type="button" className={metrics.laborPct > 28 ? 'danger' : 'good'}><Icon name={metrics.laborPct > 28 ? 'alert' : 'shield'} size={16} /><span>Labor cost {metrics.laborPct > 28 ? 'needs review' : 'looks good'}</span><b>{pct(metrics.laborPct)}</b></button>
          <button type="button" className={metrics.cashRemaining < 0 ? 'danger' : 'good'}><Icon name={metrics.cashRemaining < 0 ? 'alert' : 'shield'} size={16} /><span>{metrics.cashRemaining < 0 ? 'Cash shortage projected' : 'Cash position positive'}</span><b>{money(metrics.cashRemaining)}</b></button>
        </div>
      </Panel>
    </section>

    {detail ? <DetailTable
      title={detail === 'sales' ? 'Sales Detail' : detail === 'payroll' || detail === 'tips' ? 'Payroll & Tips Detail' : detail === 'profit' || detail === 'cash' ? 'Profit / Cash Supporting Rows' : detail === 'vendors' ? 'Vendor Purchase Detail' : 'Business Expense Detail'}
      rows={detail === 'sales' ? metrics.sales : detail === 'payroll' || detail === 'tips' ? metrics.payroll : detail === 'vendors' ? metrics.vendorRows : detail === 'expenses' ? metrics.businessRows : metrics.spendRows}
      columns={detail === 'sales' ? detailColumns.sales : detail === 'payroll' || detail === 'tips' ? detailColumns.payroll : detailColumns.spend}
    /> : null}
  </div>
}
