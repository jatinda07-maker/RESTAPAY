import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'

const money = value => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num = value => Number(String(value ?? 0).replace(/[$,%(),]/g, '')) || 0
const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
const dateOf = row => String(row?.business_date || row?.pay_date || row?.payroll_date || row?.invoice_date || row?.expense_date || row?.date || row?.created_at || '').slice(0, 10)
const inRange = (row, start, end) => {
  const date = dateOf(row)
  if (!date) return true
  return (!start || date >= start) && (!end || date <= end)
}
const first = (row, keys) => {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== '') return num(row[key])
  return 0
}

function KpiCard({ item, onOpen }) {
  return (
    <button type="button" className={`rv2-kpi rv2-kpi-${item.tone}`} onClick={() => onOpen(item)}>
      <span className="rv2-kpi-icon"><Icon name={item.icon} size={20} /></span>
      <span className="rv2-kpi-body">
        <span className="rv2-kpi-label">{item.label}</span>
        <strong>{item.value}</strong>
        <small>{item.note}</small>
      </span>
      <span className="rv2-kpi-arrow">›</span>
    </button>
  )
}

function SummaryPanel({ title, icon, tone, rows }) {
  return (
    <section className={`rv2-panel rv2-panel-${tone}`}>
      <header><span><Icon name={icon} size={18} /></span><h2>{title}</h2></header>
      <div className="rv2-summary-list">
        {rows.map(row => <div key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>)}
      </div>
    </section>
  )
}

function MiniTrend({ title, value, bars, tone }) {
  const max = Math.max(...bars, 1)
  return (
    <section className="rv2-trend-card">
      <header><div><h3>{title}</h3><strong>{value}</strong></div><span className={`rv2-trend-dot ${tone}`} /></header>
      <div className="rv2-bars" aria-hidden="true">
        {bars.map((bar, index) => <i key={index} style={{ height: `${Math.max(12, (bar / max) * 100)}%` }} />)}
      </div>
    </section>
  )
}

function DetailModal({ item, onClose }) {
  if (!item) return null
  const rows = item.details || []
  const subtotal = rows.reduce((sum, row) => sum + num(row.amount), 0)
  const total = num(item.rawValue)
  const difference = total - subtotal
  return (
    <div className="rv2-modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="rv2-modal" role="dialog" aria-modal="true" aria-label={`${item.label} details`}>
        <header className={`rv2-modal-header rv2-modal-${item.tone}`}>
          <span className="rv2-modal-icon"><Icon name={item.icon} size={22} /></span>
          <div><h2>{item.label} Details</h2><p>Selected Dashboard period</p></div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="rv2-modal-body">
          <div className="rv2-modal-summary">
            <article><span>Calculated Subtotal</span><strong>{money(subtotal)}</strong></article>
            <article><span>Dashboard Total</span><strong>{item.value}</strong></article>
            <article><span>Difference</span><strong>{money(difference)}</strong></article>
          </div>
          <div className="rv2-modal-table-wrap">
            <table className="rv2-modal-table">
              <thead><tr><th>Component</th><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {rows.length ? rows.map(row => <tr key={row.label}><td>{row.label}</td><td>{row.description}</td><td>{money(row.amount)}</td></tr>)
                  : <tr><td colSpan="3" className="rv2-empty">No detailed entries were found for this period.</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className={`rv2-reconcile ${Math.abs(difference) < 0.01 ? 'ok' : 'warn'}`}>
            <Icon name={Math.abs(difference) < 0.01 ? 'check' : 'warning'} size={18} />
            <div><strong>{Math.abs(difference) < 0.01 ? 'Reconciled' : 'Review Needed'}</strong><span>{Math.abs(difference) < 0.01 ? 'Subtotal and Dashboard total match.' : `Difference: ${money(difference)}`}</span></div>
          </footer>
        </div>
      </section>
    </div>
  )
}

export default function DashboardV2({ data = {}, setActive }) {
  const [start, setStart] = useState(monthStart())
  const [end, setEnd] = useState(today())
  const [applied, setApplied] = useState({ start: monthStart(), end: today() })
  const [detail, setDetail] = useState(null)

  const metrics = useMemo(() => {
    const salesRows = (data.salesDays || []).filter(row => inRange(row, applied.start, applied.end))
    const payrollRows = (data.payrollEntries || []).filter(row => inRange(row, applied.start, applied.end))
    const invoiceRows = (data.invoices || []).filter(row => inRange(row, applied.start, applied.end))
    const expenseRows = (data.expenses || []).filter(row => inRange(row, applied.start, applied.end))

    const totalSales = salesRows.reduce((sum, row) => sum + first(row, ['net_sales', 'netSales', 'total_sales', 'gross_sales', 'grossSales']), 0)
    const cashCollected = salesRows.reduce((sum, row) => sum + first(row, ['cash_sales', 'cashSales', 'cash_payments', 'cashPayments', 'actual_closeout_cash']), 0)
    const tips = salesRows.reduce((sum, row) => sum + first(row, ['tips', 'total_tips', 'tip_amount']), 0)
    const payroll = payrollRows.reduce((sum, row) => sum + first(row, ['total_pay', 'final_pay', 'payroll_total', 'regular_pay', 'base_pay']), 0)
    const cashPayroll = payrollRows.filter(row => String(row.payment_method || row.payroll_type || '').toLowerCase().includes('cash')).reduce((sum, row) => sum + first(row, ['total_pay', 'final_pay', 'payroll_total', 'regular_pay', 'base_pay']), 0)
    const checkPayroll = Math.max(0, payroll - cashPayroll)
    const vendorSpend = invoiceRows.reduce((sum, row) => sum + first(row, ['total', 'amount', 'invoice_total', 'grand_total']), 0)
    const expenses = expenseRows.reduce((sum, row) => sum + first(row, ['amount', 'total']), 0)
    const foodCost = invoiceRows.filter(row => /food|meat|produce|grocery/i.test(String(row.category || ''))).reduce((sum, row) => sum + first(row, ['total', 'amount', 'invoice_total']), 0)
    const alcoholCost = invoiceRows.filter(row => /beer|wine|liquor|alcohol/i.test(String(row.category || ''))).reduce((sum, row) => sum + first(row, ['total', 'amount', 'invoice_total']), 0)
    const primeCost = payroll + foodCost + alcoholCost
    const profit = totalSales - payroll - vendorSpend - expenses
    const cashRemaining = cashCollected - cashPayroll - expenses
    const healthScore = totalSales > 0 ? Math.max(0, Math.min(100, 100 - ((primeCost + expenses) / totalSales) * 65)) : 0

    const invoiceDetails = invoiceRows.slice(0, 8).map(row => ({ label: row.vendor_name || row.vendor || 'Invoice', description: row.invoice_number || row.category || 'Vendor invoice', amount: first(row, ['total', 'amount', 'invoice_total']) }))
    const expenseDetails = expenseRows.slice(0, 8).map(row => ({ label: row.name || row.category || 'Expense', description: row.vendor || row.notes || 'Business expense', amount: first(row, ['amount', 'total']) }))
    const payrollDetails = payrollRows.slice(0, 8).map(row => ({ label: row.employee_name || row.name || 'Employee', description: row.payment_method || row.payroll_type || 'Payroll', amount: first(row, ['total_pay', 'final_pay', 'payroll_total', 'regular_pay', 'base_pay']) }))

    return { totalSales, cashCollected, tips, payroll, cashPayroll, checkPayroll, vendorSpend, expenses, foodCost, alcoholCost, primeCost, profit, cashRemaining, healthScore, invoiceDetails, expenseDetails, payrollDetails }
  }, [data, applied])

  const kpis = [
    { label: 'Total Sales', value: money(metrics.totalSales), rawValue: metrics.totalSales, note: 'Toast net sales', icon: 'sales', tone: 'blue', details: [{ label: 'Toast Sales', description: 'Net sales for selected period', amount: metrics.totalSales }] },
    { label: 'Cash Collected', value: money(metrics.cashCollected), rawValue: metrics.cashCollected, note: 'Cash payments received', icon: 'cash', tone: 'green', details: [{ label: 'Cash Payments', description: 'Toast cash collected', amount: metrics.cashCollected }] },
    { label: 'Net Profit', value: money(metrics.profit), rawValue: metrics.profit, note: metrics.profit >= 0 ? 'Positive operating result' : 'Operating loss', icon: 'profit', tone: 'teal', details: [{ label: 'Sales', description: 'Total sales', amount: metrics.totalSales }, { label: 'Payroll', description: 'Operating payroll', amount: -metrics.payroll }, { label: 'Vendors', description: 'Vendor purchases', amount: -metrics.vendorSpend }, { label: 'Expenses', description: 'Business expenses', amount: -metrics.expenses }] },
    { label: 'Restaurant Health', value: `${metrics.healthScore.toFixed(0)}%`, rawValue: metrics.healthScore, note: metrics.healthScore >= 75 ? 'Strong operating health' : metrics.healthScore >= 55 ? 'Needs attention' : 'At risk', icon: 'health', tone: 'emerald', details: [{ label: 'Health Score', description: 'Weighted business health score', amount: metrics.healthScore }] },
    { label: 'Cash Payroll', value: money(metrics.cashPayroll), rawValue: metrics.cashPayroll, note: 'Cash-paid employees', icon: 'payroll', tone: 'mint', details: metrics.payrollDetails },
    { label: 'Check Payroll', value: money(metrics.checkPayroll), rawValue: metrics.checkPayroll, note: 'Check-paid employees', icon: 'employees', tone: 'cyan', details: metrics.payrollDetails },
    { label: 'Vendor Spending', value: money(metrics.vendorSpend), rawValue: metrics.vendorSpend, note: 'Invoice purchases', icon: 'vendors', tone: 'orange', details: metrics.invoiceDetails },
    { label: 'Business Expenses', value: money(metrics.expenses), rawValue: metrics.expenses, note: 'Operating expenses', icon: 'expenses', tone: 'red', details: metrics.expenseDetails },
    { label: 'Food Cost', value: money(metrics.foodCost), rawValue: metrics.foodCost, note: metrics.totalSales ? `${((metrics.foodCost / metrics.totalSales) * 100).toFixed(1)}% of sales` : 'No sales data', icon: 'food', tone: 'lime', details: metrics.invoiceDetails.filter(row => /food/i.test(row.description)) },
    { label: 'Alcohol Cost', value: money(metrics.alcoholCost), rawValue: metrics.alcoholCost, note: metrics.totalSales ? `${((metrics.alcoholCost / metrics.totalSales) * 100).toFixed(1)}% of sales` : 'No sales data', icon: 'liquor', tone: 'amber', details: metrics.invoiceDetails.filter(row => /beer|wine|liquor|alcohol/i.test(row.description)) },
    { label: 'Prime Cost', value: money(metrics.primeCost), rawValue: metrics.primeCost, note: metrics.totalSales ? `${((metrics.primeCost / metrics.totalSales) * 100).toFixed(1)}% of sales` : 'Labor + food + alcohol', icon: 'cost-analysis', tone: 'purple', details: [{ label: 'Payroll', description: 'Operating labor', amount: metrics.payroll }, { label: 'Food Cost', description: 'Food invoices', amount: metrics.foodCost }, { label: 'Alcohol Cost', description: 'Alcohol invoices', amount: metrics.alcoholCost }] },
    { label: 'Cash Remaining', value: money(metrics.cashRemaining), rawValue: metrics.cashRemaining, note: 'After cash payroll and expenses', icon: 'cash', tone: 'pink', details: [{ label: 'Cash Collected', description: 'Cash received', amount: metrics.cashCollected }, { label: 'Cash Payroll', description: 'Cash payroll paid', amount: -metrics.cashPayroll }, { label: 'Expenses', description: 'Business expenses', amount: -metrics.expenses }] }
  ]

  const summaryPanels = [
    { title: 'Cash Position', icon: 'cash', tone: 'green', rows: [
      { label: 'Cash collected', value: money(metrics.cashCollected) },
      { label: 'Cash payroll', value: money(metrics.cashPayroll) },
      { label: 'Cash remaining', value: money(metrics.cashRemaining) }
    ] },
    { title: 'Profit Snapshot', icon: 'profit', tone: 'blue', rows: [
      { label: 'Total sales', value: money(metrics.totalSales) },
      { label: 'Net profit', value: money(metrics.profit) },
      { label: 'Prime cost', value: money(metrics.primeCost) }
    ] },
    { title: 'Cost Snapshot', icon: 'cost-analysis', tone: 'purple', rows: [
      { label: 'Food cost', value: money(metrics.foodCost) },
      { label: 'Alcohol cost', value: money(metrics.alcoholCost) },
      { label: 'Vendor spend', value: money(metrics.vendorSpend) }
    ] },
    { title: 'Restaurant Health', icon: 'health', tone: 'emerald', rows: [
      { label: 'Health score', value: `${metrics.healthScore.toFixed(0)}%` },
      { label: 'Toast status', value: 'Connected' },
      { label: 'Review status', value: metrics.healthScore >= 70 ? 'On track' : 'Attention' }
    ] }
  ]

  const trendBase = [34, 48, 42, 65, 58, 78, 72]

  return (
    <div className="rv2-dashboard">
      <section className="rv2-datebar">
        <div><span className="rv2-date-icon"><Icon name="calendar" size={18} /></span><div><strong>Reporting period</strong><small>Update all Dashboard totals</small></div></div>
        <label><span>From</span><input type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
        <label><span>To</span><input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label>
        <button type="button" onClick={() => setApplied({ start, end })}>Apply</button>
      </section>

      <section className="rv2-kpi-grid">{kpis.map(item => <KpiCard key={item.label} item={item} onOpen={setDetail} />)}</section>

      <section className="rv2-section-heading"><div><h2>Executive Summary</h2><p>Key financial and operational indicators</p></div></section>
      <section className="rv2-panel-grid">{summaryPanels.map(panel => <SummaryPanel key={panel.title} {...panel} />)}</section>

      <section className="rv2-dashboard-split">
        <section className="rv2-insights">
          <header><div><h2>Business Insights</h2><p>What deserves attention today</p></div><Icon name="sparkles" size={20} /></header>
          <article><span className="good"><Icon name="profit" size={17} /></span><div><strong>Profit position</strong><p>{metrics.profit >= 0 ? `You are operating at ${money(metrics.profit)} profit for this period.` : `Operating loss is ${money(Math.abs(metrics.profit))}; review payroll and vendor spend.`}</p></div></article>
          <article><span className="warn"><Icon name="cost-analysis" size={17} /></span><div><strong>Prime cost</strong><p>{metrics.totalSales ? `Prime cost is ${((metrics.primeCost / metrics.totalSales) * 100).toFixed(1)}% of sales.` : 'Import Toast sales to calculate prime cost percentage.'}</p></div></article>
          <article><span className="info"><Icon name="cash" size={17} /></span><div><strong>Cash position</strong><p>{metrics.cashRemaining >= 0 ? `${money(metrics.cashRemaining)} remains after cash payroll and expenses.` : `${money(Math.abs(metrics.cashRemaining))} additional cash is needed.`}</p></div></article>
        </section>

        <section className="rv2-tasks">
          <header><div><h2>Today’s Tasks</h2><p>Common actions</p></div></header>
          {[
            ['import-center', 'Import Toast data', 'Upload sales, labor, and Product Mix', 'upload'],
            ['invoices', 'Review invoices', 'Check OCR totals and line items', 'invoices'],
            ['payroll', 'Run payroll', 'Process groups and manual payroll', 'payroll'],
            ['vendor-comparison', 'Compare vendors', 'Review price and package changes', 'vendor-comparison']
          ].map(([key, title, note, icon]) => (
            <button key={key} type="button" onClick={() => setActive?.(key)}><span><Icon name={icon} size={18} /></span><div><strong>{title}</strong><small>{note}</small></div><b>›</b></button>
          ))}
        </section>
      </section>

      <section className="rv2-quick-actions">
        <button type="button" onClick={() => setActive?.('import-center')}><Icon name="upload" size={18} />Import Toast</button>
        <button type="button" onClick={() => setActive?.('invoices')}><Icon name="invoices" size={18} />Add Invoice</button>
        <button type="button" onClick={() => setActive?.('expenses')}><Icon name="expenses" size={18} />Add Expense</button>
        <button type="button" onClick={() => setActive?.('payroll')}><Icon name="payroll" size={18} />Run Payroll</button>
        <button type="button" onClick={() => setActive?.('reports')}><Icon name="reports" size={18} />Reports</button>
      </section>

      <section className="rv2-trends">
        <MiniTrend title="Sales Trend" value={money(metrics.totalSales)} bars={trendBase} tone="blue" />
        <MiniTrend title="Profit Trend" value={money(metrics.profit)} bars={trendBase.map((value, index) => Math.max(12, value - index * 3))} tone="green" />
        <MiniTrend title="Payroll Trend" value={money(metrics.payroll)} bars={trendBase.map(value => Math.max(12, 86 - value / 2))} tone="purple" />
        <MiniTrend title="Vendor Spend" value={money(metrics.vendorSpend)} bars={trendBase.map((value, index) => 30 + ((value + index * 8) % 55))} tone="orange" />
      </section>

      <DetailModal item={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
