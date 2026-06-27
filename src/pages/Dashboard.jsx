import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'

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
  'Cash Expenses', 'Credit Cards', 'Property Expenses', 'Cleaning', 'Paper Goods',
  'Equipment', 'Rent', 'Lease', 'Bank Fees', 'Taxes', 'Licenses',
  'Marketing', 'Professional Services', 'POS / Software', 'Vehicle Expenses',
  'Restaurant Expenses', 'Other'
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

function SummaryPanel({ title, subtitle, total, icon, tone = 'blue', rows = [], footerRows = [], totalLabel = 'Total', onViewAll }) {
  return <section className="enterprise-panel">
    <header className="enterprise-panel-head">
      <div className="enterprise-panel-title">
        <span className={`enterprise-panel-icon ${tone}`}><Icon name={icon} size={22} /></span>
        <div><h2>{title}</h2><small>{subtitle}</small></div>
      </div>
      <div className="enterprise-panel-total"><b>{total}</b><button onClick={onViewAll} type="button">View All</button></div>
    </header>
    <div className="enterprise-panel-rows">
      {rows.length ? rows.map((row, idx) => <button className="enterprise-row" key={`${title}-${idx}`} onClick={row.onClick || onViewAll} type="button">
        <div className="enterprise-row-main"><b>{row.label}</b>{row.meta ? <small>{row.meta}</small> : null}</div>
        {row.badge ? <span className={`enterprise-badge ${String(row.badge).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{row.badge}</span> : null}
        <strong>{row.amount}</strong>
      </button>) : <div className="empty-panel-note">No data entered yet.</div>}
    </div>
    {footerRows.length ? <div className="enterprise-subtotals">
      {footerRows.map((row, idx) => <button className="enterprise-subtotal-row" key={`${title}-footer-${idx}`} onClick={row.onClick || onViewAll} type="button">
        <span>{row.label}</span><b>{row.amount}</b>
      </button>)}
    </div> : null}
    <button className="enterprise-grand-total" onClick={onViewAll} type="button"><span>{totalLabel}</span><b>{total}</b></button>
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
  const vendorCategories = data?.vendorCategories || []
  const expenseCategories = data?.expenseCategories || []
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
        category: inferItemCategory(row, inv),
        date: rowDate(row, ['invoice_date', 'date']) || rowDate(inv, ['invoice_date', 'date'])
      }
    }).filter(row => num(row.amount) > 0)

    const invoiceHeaderCategorySpend = monthInvoices
      .filter(row => !invoicesWithLineItems.has(row.id))
      .map(row => ({...row, source: 'Invoice', amount: invoiceTotal(row), category: normalizeSpendCategory(rowCategory(row)), date: rowDate(row, ['invoice_date', 'date']) }))

    const expenseCategorySpend = monthExpenses.map(row => ({...row, source: 'Expense', amount: num(row.amount), category: normalizeSpendCategory(rowCategory(row)), date: rowDate(row, ['date', 'expense_date']) }))
    const expensesFromInvoiceCategories = [...invoiceItemCategorySpend, ...invoiceHeaderCategorySpend, ...expenseCategorySpend]
    const totalExpensesAll = expensesFromInvoiceCategories.reduce((sum, row) => sum + num(row.amount), 0)
    const profit = salesMonth - payrollMonth - totalExpensesAll
    const categoryDefaults = Array.from(new Set([
      ...SPEND_CATEGORY_ORDER,
      ...vendorCategories,
      ...expenseCategories,
      ...expensesFromInvoiceCategories.map(row => row.category)
    ].filter(Boolean).map(normalizeSpendCategory)))
    const buildCategoryRows = (rows, prefix) => {
      const map = new Map()
      rows.forEach(row => {
        const key = normalizeSpendCategory(row.category)
        map.set(key, (map.get(key) || 0) + num(row.amount))
      })
      categoryDefaults.forEach(category => {
        if (!map.has(category)) map.set(category, 0)
      })
      return [...map.entries()]
        .sort((a, b) => {
          const ai = SPEND_CATEGORY_ORDER.indexOf(a[0])
          const bi = SPEND_CATEGORY_ORDER.indexOf(b[0])
          if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
          return b[1] - a[1]
        })
        .map(([category, amount]) => ({ id: `${prefix}-${category}`, category, amount }))
    }
    const categoryRows = buildCategoryRows(expensesFromInvoiceCategories, 'cat')
    const invoiceCategoryRows = buildCategoryRows([...invoiceItemCategorySpend, ...invoiceHeaderCategorySpend], 'invoice-cat')
    const expenseCategoryRows = buildCategoryRows(expenseCategorySpend, 'expense-cat')
    const foodSpend = categoryRows.find(row => row.category === 'Food')?.amount || 0
    const foodCostPercent = salesMonth > 0 ? (foodSpend / salesMonth) * 100 : 0
    return { todaySales, weekSales, monthSales, monthPayroll, cashPayrollRows, checkPayrollRows, monthInvoices, monthExpenses, monthInvoiceItems, salesToday, salesWeek, salesMonth, cashMonth, taxMonth, tipsMonth, tipsWithheldMonth, tipsAfterWithholdingMonth, trueNetSalesMonth, cashPayroll, checkPayroll, payrollMonth, invoiceSpend, expenseSpend, foodSpend, foodCostPercent, totalExpensesAll, profit, categoryRows, invoiceCategoryRows, expenseCategoryRows, expensesFromInvoiceCategories }
  }, [salesDays, payroll, invoices, invoiceItems, expenseRows, vendorCategories, expenseCategories, dateStart, dateEnd])

  const kpiItems = [
    ['Sales Today', money(derived.salesToday), noThisPeriod(derived.todaySales, 'sales', 'today'), 'cart', 'green', 'sales-today'],
    ['Sales This Week', money(derived.salesWeek), noThisPeriod(derived.weekSales, 'sales', 'this week'), 'store', 'blue', 'sales-week'],
    ['Sales Selected Range', money(derived.trueNetSalesMonth), `${derived.monthSales.length} rows • ${rangeLabel}`, 'calendar', 'purple', 'sales-month', [['Sales Tax', money(derived.taxMonth)], ['Tips After Withholding', money(derived.tipsAfterWithholdingMonth)], ['Tips Withheld', money(derived.tipsWithheldMonth)]]],
    ['Cash Collected', money(derived.cashMonth), `${derived.monthSales.length} uploaded sales rows • ${rangeLabel}`, 'dollar', 'green', 'cash-collected'],
    ['Profit / Loss', money(derived.profit), 'Sales - payroll - expenses - invoices', 'dollar', 'teal', 'profit-loss'],
    ['Cash Payroll', money(derived.cashPayroll), emptyLabel(derived.cashPayrollRows, 'cash payroll'), 'payroll', 'orange', 'cash-payroll'],
    ['Check Payroll', money(derived.checkPayroll), emptyLabel(derived.checkPayrollRows, 'check payroll'), 'card', 'blue', 'check-payroll'],
    ['Food Cost %', pct(derived.foodCostPercent), `${money(derived.foodSpend)} food spend`, 'utensils', 'orange', 'food-cost'],
    ['Expenses by Category', money(derived.totalExpensesAll), `${derived.categoryRows.length} categories`, 'expenses', 'purple', 'expense-categories'],
    ['Invoice Spend', money(derived.invoiceSpend), emptyLabel(derived.monthInvoices, 'invoices in selected range'), 'invoices', 'red', 'invoices'],
    ['Tips', money(derived.tipsMonth), 'Selected range from sales', 'gift', 'green', 'sales-tips'],
    ['Employees', String(employees.length), emptyLabel(employees, 'employees'), 'employees', 'teal', 'employees']
  ]

  const salesSummary = [
    { label: 'Cash Sales', meta: `${derived.monthSales.length} sales rows`, amount: money(derived.cashMonth), onClick: () => showDetail('cash-collected') },
    { label: 'Credit Sales', meta: `${derived.monthSales.length} sales rows`, amount: money(derived.monthSales.reduce((s, r) => s + num(r.credit_sales), 0)), onClick: () => showDetail('sales-month') },
    { label: 'Tips Before Withholding', meta: 'Imported tips', amount: money(derived.tipsMonth), onClick: () => showDetail('sales-tips') },
    { label: 'Sales Tax', meta: 'Collected tax', amount: money(derived.taxMonth), onClick: () => showDetail('sales-month') }
  ]
  const salesFooterRows = [
    { label: 'Tips Withheld', amount: money(derived.tipsWithheldMonth), onClick: () => showDetail('sales-tips') },
    { label: 'Tips After Withholding', amount: money(derived.tipsAfterWithholdingMonth), onClick: () => showDetail('sales-tips') },
    { label: 'Net Sales', amount: money(derived.trueNetSalesMonth), onClick: () => showDetail('sales-month') },
    { label: 'Gross Sales', amount: money(derived.salesMonth), onClick: () => showDetail('sales-month') }
  ]
  const invoiceRows = derived.monthInvoices.slice(0, 6).map(row => ({
    label: row.vendor || row.vendor_name || 'Invoice',
    meta: rowDate(row, ['invoice_date', 'date']),
    amount: money(invoiceTotal(row)),
    badge: row.status || row.payment_status || '',
    onClick: () => showDetail('invoices')
  }))
  const invoiceFooterRows = derived.invoiceCategoryRows.filter(row => num(row.amount) > 0).slice(0, 6).map(row => ({ label: row.category, amount: money(row.amount), onClick: () => showDetail('expense-categories') }))
  const recentExpenses = derived.monthExpenses.slice(0, 6).map(row => ({
    label: row.vendor || row.name || row.category || 'Expense',
    meta: [rowDate(row, ['date', 'expense_date']), row.category, row.payment_method].filter(Boolean).join(' • '),
    amount: money(num(row.amount)),
    badge: row.payment_method || '',
    onClick: () => showDetail('expense-categories')
  }))
  const expenseFooterRows = derived.expenseCategoryRows.filter(row => num(row.amount) > 0).slice(0, 6).map(row => ({ label: row.category, amount: money(row.amount), onClick: () => showDetail('expense-categories') }))

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

  return <>
    <style>{`
      .enterprise-summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(260px, 1fr));
        gap: 14px;
        margin-top: 16px;
      }
      .enterprise-panel {
        background: #fff;
        border: 1px solid #d8e4f2;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(15, 30, 53, .06);
      }
      .enterprise-panel-head {
        min-height: 88px;
        padding: 18px 20px;
        background: linear-gradient(135deg, #071a33, #102a4e);
        color: #fff;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }
      .enterprise-panel-title {
        display: flex;
        gap: 12px;
        align-items: center;
        min-width: 0;
      }
      .enterprise-panel-title h2 {
        margin: 0;
        color: #fff;
        font-size: 18px;
        line-height: 1.1;
      }
      .enterprise-panel-title small,
      .enterprise-panel-total button {
        color: #b9cff0;
        font-size: 12px;
      }
      .enterprise-panel-icon {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255,255,255,.12);
      }
      .enterprise-panel-icon.green { background: linear-gradient(135deg, #16a34a, #0f766e); }
      .enterprise-panel-icon.blue { background: linear-gradient(135deg, #2563eb, #0ea5e9); }
      .enterprise-panel-icon.purple { background: linear-gradient(135deg, #7c3aed, #6366f1); }
      .enterprise-panel-total {
        text-align: right;
        display: grid;
        gap: 6px;
        white-space: nowrap;
      }
      .enterprise-panel-total b {
        font-size: 20px;
        color: #fff;
      }
      .enterprise-panel-total button,
      .enterprise-grand-total,
      .enterprise-row,
      .enterprise-subtotal-row {
        border: 0;
        background: transparent;
        cursor: pointer;
        font: inherit;
      }
      .enterprise-panel-rows {
        display: grid;
      }
      .enterprise-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 10px;
        min-height: 62px;
        padding: 12px 18px;
        text-align: left;
        border-bottom: 1px solid #edf2f8;
      }
      .enterprise-row:hover,
      .enterprise-subtotal-row:hover,
      .enterprise-grand-total:hover {
        background: #f8fbff;
      }
      .enterprise-row-main {
        display: grid;
        gap: 3px;
        min-width: 0;
      }
      .enterprise-row-main b {
        color: #061a35;
        font-size: 14px;
      }
      .enterprise-row-main small {
        color: #60738c;
        font-size: 12px;
      }
      .enterprise-row strong {
        color: #061a35;
        font-size: 14px;
        white-space: nowrap;
      }
      .enterprise-badge {
        padding: 4px 8px;
        border-radius: 999px;
        background: #e8f0ff;
        color: #1d4ed8;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
      }
      .enterprise-badge.cash, .enterprise-badge.paid { background: #dcfce7; color: #15803d; }
      .enterprise-badge.check, .enterprise-badge.ach, .enterprise-badge.credit { background: #dbeafe; color: #1d4ed8; }
      .enterprise-badge.partial { background: #ffedd5; color: #c2410c; }
      .enterprise-subtotals {
        padding: 10px 18px;
        background: #fbfdff;
        border-top: 1px solid #edf2f8;
        display: grid;
        gap: 6px;
      }
      .enterprise-subtotal-row,
      .enterprise-grand-total {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        width: 100%;
        color: #24415f;
      }
      .enterprise-subtotal-row span {
        font-size: 12px;
      }
      .enterprise-subtotal-row b {
        font-size: 12px;
        color: #061a35;
      }
      .enterprise-grand-total {
        padding: 14px 18px;
        background: linear-gradient(135deg, #f8fbff, #eef6ff);
        border-top: 1px solid #dbe7f5;
        font-weight: 900;
      }
      .enterprise-grand-total b {
        font-size: 17px;
        color: #0f45a6;
      }
      @media (max-width: 1200px) {
        .enterprise-summary-grid { grid-template-columns: 1fr; }
      }
    `}</style>

    <div className="page-head">
      <div><h1>Good morning, Admin 👋</h1><p>Live dashboard using only data entered/imported in RestaPay.</p></div>
      <div className="actions"><button className="btn secondary" onClick={() => openScreen('sales')}><Icon name="upload" /> Import Sales</button><button className="btn secondary" onClick={() => openScreen('invoices')}><Icon name="invoices" /> Add Invoice</button><button className="btn primary" onClick={() => openScreen('expenses')}><Icon name="plus" /> Add Expense</button></div>
    </div>

    <div className="sales-filter-bar report-filter-bar">
      <label className="date-range-field"><span>Start</span><input type="date" value={dateStart} onChange={e => updateDateStart(e.target.value)} /></label>
      <span className="range-arrow">→</span>
      <label className="date-range-field"><span>End</span><input type="date" value={dateEnd} onChange={e => updateDateEnd(e.target.value)} /></label>
      <button className="btn primary" onClick={() => { saveGlobalDateRange(dateStart, dateEnd); setDetail('') }}>Apply Date Range</button>
      <button className="btn ghost" onClick={setThisMonth}>This Month</button>
      <button className="btn ghost" onClick={setAllDates}>All Dates</button>
      <span className="filter-note">Filtering dashboard by {rangeLabel}</span>
    </div>
    <div className="kpi-grid">{kpiItems.map((item) => <KpiCard key={item[0]} item={item} onClick={() => showDetail(item[5])} />)}</div>
    <div className="enterprise-summary-grid">
      <SummaryPanel title="Sales Summary" subtitle={`${derived.monthSales.length} imported sales`} total={money(derived.salesMonth)} icon="dollar" tone="blue" rows={salesSummary} footerRows={salesFooterRows} totalLabel="Total Sales" onViewAll={() => showDetail('sales-month')} />
      <SummaryPanel title="Vendor Invoices" subtitle={`${derived.monthInvoices.length} invoices`} total={money(derived.invoiceSpend)} icon="invoices" tone="purple" rows={invoiceRows} footerRows={invoiceFooterRows} totalLabel="Total Invoices" onViewAll={() => showDetail('invoices')} />
      <SummaryPanel title="Business Expenses" subtitle={`${derived.monthExpenses.length} expenses`} total={money(derived.expenseSpend)} icon="expenses" tone="green" rows={recentExpenses} footerRows={expenseFooterRows} totalLabel="Total Expenses" onViewAll={() => showDetail('expense-categories')} />
    </div>
    <div id="dashboard-details">
      {currentDetail ? <DetailTable title={currentDetail.title} rows={currentDetail.rows} columns={currentDetail.columns} onOpen={() => openScreen(currentDetail.open)} message={currentDetail.message} /> : null}
    </div>
  </>
}
