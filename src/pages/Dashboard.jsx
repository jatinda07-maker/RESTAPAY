import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { getAllCategories, inferCategory, categoryGroup, categoriesForGroup, rollupCategoryRows, sumRowsByCategory } from '../engine/CategoryEngine'

function num(value) {
  if (typeof value === 'number') return value
  const text = String(value ?? '').replace(/[$,%]/g, '').trim()
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
function saveGlobalDateRange(start, end) {
  try { localStorage.setItem('restapay_global_date_range', JSON.stringify({ start, end })) } catch {}
}
function rowDate(row, keys = []) {
  for (const key of keys) if (row?.[key]) return String(row[key]).slice(0, 10)
  return String(row?.business_date || row?.pay_date || row?.invoice_date || row?.date || row?.expense_date || row?.created_at || '').slice(0, 10)
}
function inRange(dateText, start, end) {
  const date = String(dateText || '').slice(0, 10)
  if (!date) return false
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}
function startOfWeek(date = new Date()) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}
function isThisWeek(dateText) {
  const d = new Date(dateText)
  if (Number.isNaN(d.getTime())) return false
  const start = startOfWeek()
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return d >= start && d < end
}
function invoiceTotal(row) { return num(row.total || row.amount || row.invoice_total || row.grand_total) }
function itemUnit(row) { return num(row.unit_price || row.price || row.cost || row.item_price || row.rate) }
function itemAmount(row) { return num(row.line_total || row.total || row.amount || row.extended_price || (num(row.qty || row.quantity) * itemUnit(row))) }
function payrollType(row) { return String(row.payment_method || row.payroll_type || row.type || row.pay_method || '').toLowerCase() }
function isCashPayroll(row) { return payrollType(row).includes('cash') }
function isCheckPayroll(row) { return payrollType(row).includes('check') }
function totalPayroll(row) { return num(row.total_pay || row.amount || (num(row.regular_pay) + num(row.tips_after_withheld || row.tips) - num(row.tip_deduction) + num(row.extra_pay))) }
function totalRows(rows = [], key = 'amount') { return rows.reduce((sum, row) => sum + num(row[key]), 0) }
function sortRecent(rows = []) { return [...rows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))) }
function emptyText(rows, label) { return rows.length ? `${rows.length} rows` : `No ${label} entered yet` }

function KpiCard({ icon, label, value, note, tone = 'blue', onClick }) {
  return <button type="button" className={`resta-kpi resta-kpi-${tone}`} onClick={onClick}>
    <span className="resta-kpi-icon"><Icon name={icon} size={18} /></span>
    <span className="resta-kpi-copy"><small>{label}</small><strong>{value}</strong><em>{note}</em></span>
  </button>
}

function MetricLine({ label, value, meta, onClick }) {
  const Cmp = onClick ? 'button' : 'div'
  return <Cmp type={onClick ? 'button' : undefined} className="resta-metric-line" onClick={onClick}>
    <span><b>{label}</b>{meta ? <small>{meta}</small> : null}</span><strong>{value}</strong>
  </Cmp>
}

function Panel({ title, subtitle, total, icon, children, onView }) {
  return <section className="resta-panel">
    <header className="resta-panel-head">
      <div className="resta-panel-title"><span><Icon name={icon} size={18} /></span><div><h2>{title}</h2>{subtitle ? <small>{subtitle}</small> : null}</div></div>
      <div className="resta-panel-actions">{total ? <strong>{total}</strong> : null}{onView ? <button type="button" onClick={onView}>View</button> : null}</div>
    </header>
    <div className="resta-panel-body">{children}</div>
  </section>
}

function ProgressBar({ label, amount, total, tone = 'blue' }) {
  const pctValue = total > 0 ? Math.min(100, Math.max(0, (amount / total) * 100)) : 0
  return <div className="resta-progress-row">
    <div><span>{label}</span><b>{money(amount)}</b></div>
    <div className="resta-progress-track"><i className={`resta-progress-fill ${tone}`} style={{ width: `${pctValue}%` }} /></div>
  </div>
}

function DetailTable({ config, onClose, setActive }) {
  if (!config) return null
  return <section className="resta-detail-panel">
    <header>
      <div><h2>{config.title}</h2><p>{config.message || `${config.rows.length} rows`}</p></div>
      <div className="resta-detail-actions">{config.open ? <button type="button" onClick={() => setActive(config.open)}>Open Page</button> : null}<button type="button" onClick={onClose}>Close</button></div>
    </header>
    <div className="resta-detail-scroll">
      <table>
        <thead><tr>{config.columns.map(col => <th key={col.key || col.label}>{col.label}</th>)}</tr></thead>
        <tbody>{config.rows.length ? config.rows.map((row, idx) => <tr key={row.id || idx}>{config.columns.map(col => <td key={col.key || col.label}>{col.render ? col.render(row) : row[col.key]}</td>)}</tr>) : <tr><td colSpan={config.columns.length}>No data found for this section.</td></tr>}</tbody>
      </table>
    </div>
  </section>
}

export default function Dashboard({ data, setActive }) {
  const [range, setRange] = useState(() => readSavedDateRange())
  const [detail, setDetail] = useState('')
  const [expenseMode, setExpenseMode] = useState('categories')
  const salesDays = data?.salesDays || []
  const payroll = data?.payrollEntries || []
  const vendors = data?.vendors || []
  const invoices = data?.invoices || []
  const invoiceItems = data?.invoiceItems || []
  const expenses = data?.expenses || []
  const employees = data?.employees || []
  const allCategories = getAllCategories(data || {})
  const rangeLabel = `${range.start || 'First record'} to ${range.end || 'Latest record'}`

  function updateRange(field, value) {
    const next = { ...range, [field]: value }
    setRange(next)
    saveGlobalDateRange(next.start, next.end)
  }
  function setMonth() {
    const next = { start: startOfMonthISO(), end: todayISO() }
    setRange(next)
    saveGlobalDateRange(next.start, next.end)
  }
  function setAllDates() {
    const next = { start: '', end: '' }
    setRange(next)
    saveGlobalDateRange('', '')
  }

  const metrics = useMemo(() => {
    const rangeSales = salesDays.filter(row => inRange(rowDate(row, ['business_date', 'date']), range.start, range.end))
    const weekSales = salesDays.filter(row => isThisWeek(rowDate(row, ['business_date', 'date'])))
    const todaySales = salesDays.filter(row => rowDate(row, ['business_date', 'date']) === todayISO())
    const rangePayroll = payroll.filter(row => inRange(rowDate(row, ['pay_date', 'date']), range.start, range.end))
    const cashPayrollRows = rangePayroll.filter(isCashPayroll)
    const checkPayrollRows = rangePayroll.filter(isCheckPayroll)
    const rangeInvoices = invoices.filter(row => inRange(rowDate(row, ['invoice_date', 'date']), range.start, range.end))
    const invoiceById = Object.fromEntries(invoices.map(invoice => [invoice.id, invoice]))
    const rangeInvoiceItems = invoiceItems.filter(row => {
      const invoice = invoiceById[row.invoice_id] || {}
      const date = rowDate(row, ['invoice_date', 'date', 'created_at']) || rowDate(invoice, ['invoice_date', 'date'])
      return inRange(date, range.start, range.end)
    })
    const rangeExpenses = expenses.filter(row => inRange(rowDate(row, ['date', 'expense_date']), range.start, range.end))
    const invoicesWithItems = new Set(rangeInvoiceItems.map(row => row.invoice_id).filter(Boolean))
    const itemSpend = rangeInvoiceItems.map(row => {
      const invoice = invoiceById[row.invoice_id] || {}
      const vendorName = invoice.vendor || invoice.vendor_name || row.vendor || row.vendor_name || 'Vendor'
      return { ...row, source: 'Invoice Item', vendor: vendorName, vendor_name: vendorName, amount: itemAmount(row), category: inferCategory({ ...row, vendor: vendorName, category: row.category || invoice.category }), date: rowDate(row, ['invoice_date', 'date']) || rowDate(invoice, ['invoice_date', 'date']) }
    }).filter(row => num(row.amount) > 0)
    const headerSpend = rangeInvoices.filter(row => !invoicesWithItems.has(row.id)).map(row => ({ ...row, source: 'Invoice', amount: invoiceTotal(row), category: inferCategory(row), date: rowDate(row, ['invoice_date', 'date']) })).filter(row => num(row.amount) > 0)
    const expenseSpendRows = rangeExpenses.map(row => ({ ...row, source: 'Expense', vendor: row.vendor || row.name, amount: num(row.amount), category: inferCategory(row), date: rowDate(row, ['date', 'expense_date']) })).filter(row => num(row.amount) > 0)
    const spendRows = [...itemSpend, ...headerSpend, ...expenseSpendRows]
    const vendorRows = spendRows.filter(row => categoryGroup(row.category || row.label) === 'vendor')
    const businessRows = spendRows.filter(row => categoryGroup(row.category || row.label) === 'business')
    const vendorCategoryRowsAll = sumRowsByCategory(vendorRows, categoriesForGroup(data || {}, 'vendor'))
    const businessCategoryRowsAll = sumRowsByCategory(businessRows, categoriesForGroup(data || {}, 'business'))
    const categoryRows = sumRowsByCategory(spendRows, data || {})
    const salesNet = totalRows(rangeSales, 'net_sales')
    const salesGross = rangeSales.reduce((sum, row) => sum + num(row.gross_sales || row.total_sales || row.net_sales), 0)
    const cashSales = totalRows(rangeSales, 'cash_sales')
    const creditSales = totalRows(rangeSales, 'credit_sales')
    const giftSales = totalRows(rangeSales, 'gift_card_sales')
    const onlineSales = totalRows(rangeSales, 'online_orders')
    const tax = totalRows(rangeSales, 'tax')
    const tipsAfter = totalRows(rangeSales, 'tips')
    const tipsWithheld = rangeSales.reduce((sum, row) => sum + num(row.tips_withheld || row.tip_deduction || row.tips_withholding), 0)
    const tipsBefore = rangeSales.reduce((sum, row) => sum + num(row.tips_before_withholding || row.total_tips || row.tips) + num(row.tips_withheld || 0), 0)
    const cashPayroll = cashPayrollRows.reduce((sum, row) => sum + totalPayroll(row), 0)
    const checkPayroll = checkPayrollRows.reduce((sum, row) => sum + totalPayroll(row), 0)
    const payrollTotal = rangePayroll.reduce((sum, row) => sum + totalPayroll(row), 0)
    const vendorSpend = vendorRows.reduce((sum, row) => sum + num(row.amount), 0)
    const businessSpend = businessRows.reduce((sum, row) => sum + num(row.amount), 0)
    const totalSpend = spendRows.reduce((sum, row) => sum + num(row.amount), 0)
    const foodSpend = categoryRows.find(row => row.category === 'Food' || row.label === 'Food')?.amount || 0
    const profit = salesNet - payrollTotal - totalSpend
    const cashBusiness = businessRows.filter(row => String(row.payment_method || row.method || '').toLowerCase().includes('cash')).reduce((sum, row) => sum + num(row.amount), 0)
    const cashVendor = vendorRows.filter(row => String(row.payment_method || row.method || '').toLowerCase().includes('cash')).reduce((sum, row) => sum + num(row.amount), 0)
    const cashRemaining = cashSales - cashPayroll - cashVendor - cashBusiness
    const primeCost = foodSpend + payrollTotal
    const foodCost = salesNet > 0 ? (foodSpend / salesNet) * 100 : 0
    const laborCost = salesNet > 0 ? (payrollTotal / salesNet) * 100 : 0
    const primeCostPercent = salesNet > 0 ? (primeCost / salesNet) * 100 : 0
    const avgDailySales = rangeSales.length ? salesNet / new Set(rangeSales.map(row => rowDate(row, ['business_date', 'date']))).size : 0
    return {
      rangeSales, todaySales, weekSales, rangePayroll, cashPayrollRows, checkPayrollRows, rangeInvoices, rangeExpenses, spendRows,
      salesNet, salesGross, cashSales, creditSales, giftSales, onlineSales, tax, tipsAfter, tipsWithheld, tipsBefore, cashPayroll, checkPayroll, payrollTotal,
      vendorSpend, businessSpend, totalSpend, foodSpend, profit, cashVendor, cashBusiness, cashRemaining, primeCost, foodCost, laborCost, primeCostPercent, avgDailySales,
      vendorRows: sortRecent(vendorRows), businessRows: sortRecent(businessRows), categoryRows, vendorCategoryRows: rollupCategoryRows(vendorCategoryRowsAll, 'vendor', 8), vendorCategoryRowsAll, businessCategoryRows: rollupCategoryRows(businessCategoryRowsAll, 'business', 10), businessCategoryRowsAll
    }
  }, [data, salesDays, payroll, invoices, invoiceItems, expenses, range.start, range.end])

  const detailConfig = {
    sales: { title: 'Sales Detail', open: 'sales', rows: metrics.rangeSales, message: emptyText(metrics.rangeSales, 'sales'), columns: [
      { key: 'business_date', label: 'Date' }, { key: 'gross_sales', label: 'Gross', render: r => money(num(r.gross_sales)) }, { key: 'net_sales', label: 'Net', render: r => money(num(r.net_sales)) }, { key: 'cash_sales', label: 'Cash', render: r => money(num(r.cash_sales)) }, { key: 'credit_sales', label: 'Credit', render: r => money(num(r.credit_sales)) }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }
    ]},
    cash: { title: 'Cash Position Detail', open: 'sales', rows: [
      { name: 'Cash Collected', amount: metrics.cashSales }, { name: 'Cash Payroll', amount: -metrics.cashPayroll }, { name: 'Cash Vendor Payments', amount: -metrics.cashVendor }, { name: 'Cash Business Expenses', amount: -metrics.cashBusiness }, { name: 'Remaining Cash', amount: metrics.cashRemaining }
    ], columns: [{ key: 'name', label: 'Line Item' }, { key: 'amount', label: 'Amount', render: r => money(r.amount) }]},
    payroll: { title: 'Payroll Detail', open: 'payroll', rows: metrics.rangePayroll, message: emptyText(metrics.rangePayroll, 'payroll'), columns: [
      { key: 'date', label: 'Date', render: r => rowDate(r, ['pay_date', 'date']) }, { key: 'employee_name', label: 'Employee' }, { key: 'payment_method', label: 'Method', render: r => r.payment_method || r.payroll_type || r.type || '' }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }, { key: 'tip_deduction', label: 'Withheld', render: r => money(num(r.tip_deduction)) }, { key: 'total_pay', label: 'Total', render: r => money(totalPayroll(r)) }
    ]},
    vendors: { title: 'Vendor Purchases Detail', open: 'invoices', rows: metrics.vendorRows, message: emptyText(metrics.vendorRows, 'vendor purchases'), columns: [
      { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Vendor', render: r => r.vendor || r.vendor_name || r.name || 'Vendor' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: r => money(r.amount) }
    ]},
    expenses: { title: 'Business Expenses Detail', open: 'expenses', rows: metrics.businessRows, message: emptyText(metrics.businessRows, 'business expenses'), columns: [
      { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Vendor / Name', render: r => r.vendor || r.name || r.category || 'Expense' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: r => money(r.amount) }
    ]},
    categories: { title: 'All Category Spend', open: 'reports', rows: metrics.categoryRows, message: `${metrics.categoryRows.length} categories`, columns: [
      { key: 'category', label: 'Category', render: r => r.category || r.label }, { key: 'amount', label: 'Amount', render: r => money(r.amount) }
    ]}
  }

  const health = metrics.salesNet <= 0 ? 'Needs Sales Data' : metrics.profit >= 0 && metrics.foodCost <= 32 && metrics.laborCost <= 28 ? 'Good' : metrics.profit >= 0 ? 'Watch Costs' : 'Needs Attention'

  return <div className="resta-dashboard">
    <section className="resta-hero">
      <div>
        <span className="resta-eyebrow">Restaurant Command Center</span>
        <h1>Financial health, cash, labor and vendor spending in one view.</h1>
        <p>{rangeLabel}</p>
      </div>
      <div className="resta-date-card">
        <label><span>Start</span><input type="date" value={range.start} onChange={e => updateRange('start', e.target.value)} /></label>
        <label><span>End</span><input type="date" value={range.end} onChange={e => updateRange('end', e.target.value)} /></label>
        <button type="button" onClick={setMonth}>This Month</button>
        <button type="button" onClick={setAllDates}>All Dates</button>
      </div>
    </section>

    <section className="resta-health-card">
      <div><span>Restaurant Health</span><strong>{health}</strong><small>{metrics.rangeSales.length ? `${metrics.rangeSales.length} sales rows imported` : 'Upload Toast Sales Summary to activate live metrics'}</small></div>
      <div><span>Prime Cost</span><strong>{pct(metrics.primeCostPercent)}</strong><small>{money(metrics.primeCost)} food + labor</small></div>
      <div><span>Avg Daily Sales</span><strong>{money(metrics.avgDailySales)}</strong><small>Selected range average</small></div>
      <div><span>Cash Remaining</span><strong className={metrics.cashRemaining < 0 ? 'resta-negative' : ''}>{money(metrics.cashRemaining)}</strong><small>After cash payroll/vendors/expenses</small></div>
    </section>

    <section className="resta-kpi-grid">
      <KpiCard icon="dollar" label="Net Sales" value={money(metrics.salesNet)} note={`${metrics.rangeSales.length} sales rows`} tone="blue" onClick={() => setDetail('sales')} />
      <KpiCard icon="cart" label="Cash Collected" value={money(metrics.cashSales)} note="From Toast cash payments" tone="green" onClick={() => setDetail('cash')} />
      <KpiCard icon="receipt" label="Profit / Loss" value={money(metrics.profit)} note="Sales - payroll - spend" tone={metrics.profit >= 0 ? 'teal' : 'red'} onClick={() => setDetail('categories')} />
      <KpiCard icon="utensils" label="Food Cost" value={pct(metrics.foodCost)} note={`${money(metrics.foodSpend)} food spend`} tone="orange" onClick={() => setDetail('vendors')} />
      <KpiCard icon="payroll" label="Labor Cost" value={pct(metrics.laborCost)} note={`${money(metrics.payrollTotal)} payroll`} tone="purple" onClick={() => setDetail('payroll')} />
      <KpiCard icon="gift" label="Tips After Withholding" value={money(metrics.tipsAfter)} note={`${money(metrics.tipsWithheld)} withheld`} tone="green" onClick={() => setDetail('sales')} />
    </section>

    <section className="resta-dashboard-grid resta-top-grid">
      <Panel icon="sales" title="Sales Breakdown" subtitle="Toast sales summary" total={money(metrics.salesGross)} onView={() => setDetail('sales')}>
        <ProgressBar label="Cash Sales" amount={metrics.cashSales} total={metrics.salesGross} tone="green" />
        <ProgressBar label="Credit Sales" amount={metrics.creditSales} total={metrics.salesGross} tone="blue" />
        <ProgressBar label="Online / Other" amount={metrics.onlineSales} total={metrics.salesGross} tone="purple" />
        <MetricLine label="Gift Cards" value={money(metrics.giftSales)} />
        <MetricLine label="Tax" value={money(metrics.tax)} />
        <MetricLine label="Tips After Withholding" value={money(metrics.tipsAfter)} meta={`${money(metrics.tipsWithheld)} withheld`} />
      </Panel>

      <Panel icon="wallet" title="Cash Position" subtitle="Cash available after payments" total={money(metrics.cashRemaining)} onView={() => setDetail('cash')}>
        <MetricLine label="Cash Collected" value={money(metrics.cashSales)} />
        <MetricLine label="Cash Payroll" value={`-${money(metrics.cashPayroll)}`} onClick={() => setDetail('payroll')} />
        <MetricLine label="Cash Vendor Payments" value={`-${money(metrics.cashVendor)}`} onClick={() => setDetail('vendors')} />
        <MetricLine label="Cash Business Expenses" value={`-${money(metrics.cashBusiness)}`} onClick={() => setDetail('expenses')} />
        <div className="resta-cash-total"><span>Remaining Cash</span><strong className={metrics.cashRemaining < 0 ? 'resta-negative' : ''}>{money(metrics.cashRemaining)}</strong></div>
      </Panel>
    </section>

    <section className="resta-dashboard-grid resta-middle-grid">
      <Panel icon="invoices" title="Vendor Purchases" subtitle={`${metrics.vendorRows.length} purchase rows`} total={money(metrics.vendorSpend)} onView={() => setDetail('vendors')}>
        {metrics.vendorRows.slice(0, 5).map((row, idx) => <MetricLine key={row.id || idx} label={row.vendor || row.vendor_name || row.name || 'Vendor Purchase'} meta={`${row.date || ''} • ${row.category || 'Other'}`} value={money(row.amount)} onClick={() => setDetail('vendors')} />)}
        {!metrics.vendorRows.length ? <div className="resta-empty">No vendor purchases in this range.</div> : null}
        <div className="resta-subtotal-stack">{metrics.vendorCategoryRows.slice(0, 6).map(row => <MetricLine key={row.id || row.category || row.label} label={row.label || row.category} value={money(row.amount)} onClick={() => setDetail('vendors')} />)}</div>
      </Panel>

      <Panel icon="expenses" title="Business Expenses" subtitle={`${metrics.businessRows.length} operating rows`} total={money(metrics.businessSpend)} onView={() => setDetail('expenses')}>
        <div className="resta-tabs"><button type="button" className={expenseMode === 'categories' ? 'active' : ''} onClick={() => setExpenseMode('categories')}>Categories</button><button type="button" className={expenseMode === 'recent' ? 'active' : ''} onClick={() => setExpenseMode('recent')}>Recent</button></div>
        {expenseMode === 'categories' ? <div className="resta-category-list">
          {metrics.businessCategoryRowsAll.slice(0, 10).map(row => <MetricLine key={row.id || row.category || row.label} label={row.label || row.category} value={money(row.amount)} onClick={() => setDetail('expenses')} />)}
        </div> : <div>
          {metrics.businessRows.slice(0, 7).map((row, idx) => <MetricLine key={row.id || idx} label={row.vendor || row.name || row.category || 'Expense'} meta={`${row.date || ''} • ${row.category || 'Other'}`} value={money(row.amount)} onClick={() => setDetail('expenses')} />)}
          {!metrics.businessRows.length ? <div className="resta-empty">No business expenses in this range.</div> : null}
        </div>}
      </Panel>

      <Panel icon="payroll" title="Payroll Summary" subtitle={`${metrics.rangePayroll.length} payroll rows`} total={money(metrics.payrollTotal)} onView={() => setDetail('payroll')}>
        <MetricLine label="Cash Payroll" value={money(metrics.cashPayroll)} meta={`${metrics.cashPayrollRows.length} rows`} onClick={() => setDetail('payroll')} />
        <MetricLine label="Check Payroll" value={money(metrics.checkPayroll)} meta={`${metrics.checkPayrollRows.length} rows`} onClick={() => setDetail('payroll')} />
        <MetricLine label="Tips After Withholding" value={money(metrics.tipsAfter)} meta={`${money(metrics.tipsWithheld)} withheld from Toast`} onClick={() => setDetail('sales')} />
        <MetricLine label="Employees" value={String(employees.length)} meta={`${vendors.length} vendors configured`} />
      </Panel>
    </section>

    <section className="resta-dashboard-grid resta-bottom-grid">
      <Panel icon="alert" title="Price Increase Intelligence" subtitle="Purchasing watch list" total={`${metrics.categoryRows.filter(row => num(row.amount) > 0).length} categories`} onView={() => setActive('price-increase')}>
        <MetricLine label="Food Spend" value={money(metrics.foodSpend)} meta={metrics.foodCost ? `${pct(metrics.foodCost)} of net sales` : 'No sales yet'} />
        <MetricLine label="Vendor Spend" value={money(metrics.vendorSpend)} meta="Food, beverage, liquor, supplies" />
        <MetricLine label="Business Spend" value={money(metrics.businessSpend)} meta="Utilities, insurance, fees, loans" />
        <button className="resta-action-wide" type="button" onClick={() => setActive('price-increase')}>Open Price Increase Center</button>
      </Panel>

      <Panel icon="reports" title="Weekly Trend Snapshot" subtitle="Selected period summary" total={money(metrics.salesNet)} onView={() => setActive('reports')}>
        <div className="resta-mini-chart" aria-label="Trend chart">
          {[42, 55, 48, 70, 64, 82, 74].map((height, idx) => <span key={idx} style={{ height: `${height}%` }} />)}
        </div>
        <div className="resta-trend-grid"><MetricLine label="This Week Sales" value={money(metrics.weekSales.reduce((sum, row) => sum + num(row.net_sales), 0))} /><MetricLine label="Today Sales" value={money(metrics.todaySales.reduce((sum, row) => sum + num(row.net_sales), 0))} /></div>
      </Panel>
    </section>

    <DetailTable config={detailConfig[detail]} setActive={setActive} onClose={() => setDetail('')} />
  </div>
}
