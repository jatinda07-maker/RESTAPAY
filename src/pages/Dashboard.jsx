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


function sumRowsByCategory(rows = []) {
  const map = new Map()
  rows.forEach(row => {
    const key = normalizeSpendCategory(row.category || rowCategory(row) || 'Other')
    map.set(key, (map.get(key) || 0) + num(row.amount))
  })
  return [...map.entries()].filter(([, amount]) => amount !== 0).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ id: `sum-${category}`, label: category, amount }))
}

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
  const allConfiguredCategories = Array.from(new Set([...(data?.vendorCategories || []), ...(data?.expenseCategories || []), ...SPEND_CATEGORY_ORDER].filter(Boolean)))
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
    const categoryMap = new Map()
    expensesFromInvoiceCategories.forEach(row => {
      const key = normalizeSpendCategory(row.category)
      categoryMap.set(key, (categoryMap.get(key) || 0) + num(row.amount))
    })
    allConfiguredCategories.forEach(category => {
      if (!categoryMap.has(category)) categoryMap.set(category, 0)
    })
    const categoryRows = [...categoryMap.entries()]
      .sort((a, b) => {
        const ai = SPEND_CATEGORY_ORDER.indexOf(a[0])
        const bi = SPEND_CATEGORY_ORDER.indexOf(b[0])
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
        return b[1] - a[1]
      })
      .map(([category, amount]) => ({ id: `cat-${category}`, category, amount }))
    const foodSpend = categoryMap.get('Food') || 0
    const foodCostPercent = salesMonth > 0 ? (foodSpend / salesMonth) * 100 : 0
    const grossSales = monthSales.reduce((sum, row) => sum + num(row.gross_sales || row.total_sales || row.net_sales), 0)
    const creditSales = monthSales.reduce((sum, row) => sum + num(row.credit_sales), 0)
    const giftSales = monthSales.reduce((sum, row) => sum + num(row.gift_card_sales), 0)
    const onlineSales = monthSales.reduce((sum, row) => sum + num(row.online_orders), 0)
    const invoiceCategoryRows = sumRowsByCategory([...invoiceItemCategorySpend, ...invoiceHeaderCategorySpend])
    const businessExpenseCategoryRows = sumRowsByCategory(expenseCategorySpend)
    return { todaySales, weekSales, monthSales, monthPayroll, cashPayrollRows, checkPayrollRows, monthInvoices, monthExpenses, monthInvoiceItems, salesToday, salesWeek, salesMonth, grossSales, creditSales, giftSales, onlineSales, cashMonth, taxMonth, tipsMonth, tipsWithheldMonth, tipsAfterWithholdingMonth, trueNetSalesMonth, cashPayroll, checkPayroll, payrollMonth, invoiceSpend, expenseSpend, foodSpend, foodCostPercent, totalExpensesAll, profit, categoryRows, invoiceCategoryRows, businessExpenseCategoryRows, expensesFromInvoiceCategories }
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
    ['Expenses by Category', money(derived.totalExpensesAll), `${derived.categoryRows.length} categories`, 'expenses', 'purple', 'expense-categories'],
    ['Invoice Spend', money(derived.invoiceSpend), emptyLabel(derived.monthInvoices, 'invoices in selected range'), 'invoices', 'red', 'invoices'],
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

  return <>
    <style>{`
      .enterprise-kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
        margin-bottom: 18px;
      }
      .enterprise-kpi-card {
        border: 1px solid #dbe5f1;
        background: #fff;
        border-radius: 18px;
        padding: 14px 16px;
        min-height: 104px;
        display: grid;
        gap: 8px;
        text-align: left;
        box-shadow: 0 12px 30px rgba(15, 30, 53, .06);
        cursor: pointer;
      }
      .enterprise-kpi-card span {
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: .05em;
      }
      .enterprise-kpi-card strong {
        color: #0f1e35;
        font-size: 24px;
        line-height: 1;
      }
      .enterprise-kpi-card small {
        color: #64748b;
        font-size: 12px;
      }
      .enterprise-panel-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
        align-items: stretch;
        margin-top: 18px;
      }
      .enterprise-panel {
        overflow: hidden;
        border: 1px solid #dbe5f1;
        border-radius: 20px;
        background: #ffffff;
        box-shadow: 0 14px 34px rgba(15, 30, 53, .07);
        display: flex;
        flex-direction: column;
        min-height: 520px;
      }
      .enterprise-panel-head {
        background: #0f1e35;
        color: #ffffff;
        padding: 16px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }
      .enterprise-panel-title {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .enterprise-panel-icon {
        width: 34px;
        height: 34px;
        border-radius: 12px;
        background: rgba(255,255,255,.12);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
      }
      .enterprise-panel-title h2 {
        margin: 0;
        font-size: 16px;
        color: #ffffff;
        line-height: 1.15;
      }
      .enterprise-panel-title small,
      .enterprise-panel-total button {
        color: rgba(255,255,255,.76);
        font-size: 12px;
      }
      .enterprise-panel-total {
        display: grid;
        justify-items: end;
        gap: 3px;
        flex: 0 0 auto;
      }
      .enterprise-panel-total strong {
        color: #ffffff;
        font-size: 18px;
        line-height: 1;
        white-space: nowrap;
      }
      .enterprise-panel-total button {
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 0;
      }
      .enterprise-panel-body {
        display: grid;
        gap: 0;
        padding: 8px 14px 4px;
        max-height: 280px;
        overflow: auto;
      }
      .enterprise-row,
      .enterprise-subtotal-row {
        border: 0;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 4px;
        border-bottom: 1px solid #eef3f8;
        text-align: left;
        cursor: pointer;
      }
      .enterprise-row b,
      .enterprise-subtotal-row span {
        color: #0f1e35;
        font-size: 13px;
        line-height: 1.2;
      }
      .enterprise-row small {
        display: block;
        margin-top: 2px;
        color: #718096;
        font-size: 11px;
      }
      .enterprise-row strong,
      .enterprise-subtotal-row b {
        color: #0f1e35;
        font-size: 13px;
        white-space: nowrap;
      }
      .enterprise-subtotals {
        border-top: 1px solid #dfe8f2;
        padding: 6px 14px;
        margin-top: auto;
        background: #f8fafc;
      }
      .enterprise-subtotal-row {
        padding: 8px 4px;
      }
      .enterprise-panel-foot {
        background: #f1f5f9;
        border-top: 1px solid #dbe5f1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        color: #0f1e35;
        font-weight: 900;
      }
      .enterprise-empty {
        padding: 26px 8px;
        text-align: center;
        color: #718096;
        font-size: 13px;
      }
      @media (max-width: 1180px) {
        .enterprise-panel-grid { grid-template-columns: 1fr; }
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
    <div className="enterprise-kpi-grid">
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('sales-month')}><span>Net Sales</span><strong>{money(derived.trueNetSalesMonth)}</strong><small>{derived.monthSales.length} sales rows</small></button>
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('sales-month')}><span>Gross Sales</span><strong>{money(derived.grossSales)}</strong><small>Before tax/tips adjustments</small></button>
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('cash-collected')}><span>Cash Collected</span><strong>{money(derived.cashMonth)}</strong><small>Uploaded sales cash</small></button>
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('profit-loss')}><span>Profit / Loss</span><strong>{money(derived.profit)}</strong><small>Sales - payroll - expenses</small></button>
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('food-cost')}><span>Food Cost %</span><strong>{pct(derived.foodCostPercent)}</strong><small>{money(derived.foodSpend)} food spend</small></button>
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('cash-payroll')}><span>Total Payroll</span><strong>{money(derived.payrollMonth)}</strong><small>Cash {money(derived.cashPayroll)} • Check {money(derived.checkPayroll)}</small></button>
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('cash-payroll')}><span>Cash Payroll</span><strong>{money(derived.cashPayroll)}</strong><small>{derived.cashPayrollRows.length} cash payroll rows</small></button>
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('check-payroll')}><span>Check Payroll</span><strong>{money(derived.checkPayroll)}</strong><small>{derived.checkPayrollRows.length} check payroll rows</small></button>
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('invoices')}><span>Invoice Spend</span><strong>{money(derived.invoiceSpend)}</strong><small>{derived.monthInvoices.length} invoices</small></button>
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('expense-categories')}><span>Business Expenses</span><strong>{money(derived.expenseSpend)}</strong><small>{derived.monthExpenses.length} expense rows</small></button>
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('sales-tips')}><span>Tips</span><strong>{money(derived.tipsMonth)}</strong><small>{money(derived.tipsAfterWithholdingMonth)} after withholding</small></button>
      <button className="enterprise-kpi-card" type="button" onClick={() => showDetail('employees')}><span>Employees</span><strong>{String(employees.length)}</strong><small>{vendors.length} vendors • {groups.length} payroll groups</small></button>
    </div>

    <div className="enterprise-panel-grid">
      <EnterprisePanel
        icon="dollar"
        title="Sales Summary"
        total={money(derived.grossSales)}
        count={`${derived.monthSales.length} imported sales`}
        onViewAll={() => showDetail('sales-month')}
        rows={[
          { label: 'Cash Sales', amount: money(derived.cashMonth) },
          { label: 'Credit Sales', amount: money(derived.creditSales) },
          { label: 'Gift Cards', amount: money(derived.giftSales) },
          { label: 'Online Orders', amount: money(derived.onlineSales) },
          { label: 'Sales Tax', amount: money(derived.taxMonth) },
          { label: 'Tips Before Withholding', amount: money(derived.tipsMonth) },
          { label: 'Tips Withheld', amount: money(derived.tipsWithheldMonth) },
          { label: 'Tips After Withholding', amount: money(derived.tipsAfterWithholdingMonth) }
        ]}
        subtotalRows={[{ label: 'Net Sales', amount: derived.trueNetSalesMonth }, { label: 'Gross Sales', amount: derived.grossSales }]}
        grandLabel="Total Sales"
      />

      <EnterprisePanel
        icon="invoices"
        title="Vendor Invoices"
        total={money(derived.invoiceSpend)}
        count={`${derived.monthInvoices.length} invoices`}
        onViewAll={() => showDetail('invoices')}
        rows={derived.monthInvoices.slice(0, 6).map(row => ({ label: row.vendor || row.vendor_name || 'Invoice', meta: rowDate(row, ['invoice_date', 'date']), amount: money(invoiceTotal(row)) }))}
        subtotalRows={derived.invoiceCategoryRows.slice(0, 8)}
        grandLabel="Invoice Total"
      />

      <EnterprisePanel
        icon="expenses"
        title="Business Expenses"
        total={money(derived.expenseSpend)}
        count={`${derived.monthExpenses.length} expenses`}
        onViewAll={() => showDetail('expense-categories')}
        rows={derived.monthExpenses.slice(0, 6).map(row => ({ label: row.vendor || row.name || row.category || 'Expense', meta: `${rowDate(row, ['date', 'expense_date'])} • ${row.category || row.payment_method || ''}`, amount: money(num(row.amount)) }))}
        subtotalRows={derived.businessExpenseCategoryRows.slice(0, 8)}
        grandLabel="Expense Total"
      />
    </div>
    <div id="dashboard-details">
      {currentDetail ? <DetailTable title={currentDetail.title} rows={currentDetail.rows} columns={currentDetail.columns} onOpen={() => openScreen(currentDetail.open)} message={currentDetail.message} /> : null}
    </div>
  </>
}
