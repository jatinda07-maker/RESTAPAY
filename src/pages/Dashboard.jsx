import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'

function num(value) { return Number(String(value ?? '').replace(/[$,%(),]/g, '').trim()) || 0 }
function money(value) { return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function pct(value) { return `${Number(value || 0).toFixed(2)}%` }
function todayStr() { return new Date().toISOString().slice(0, 10) }
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
  if (text.includes('food') || text.includes('meat') || text.includes('produce') || text.includes('grocery')) return 'Food'
  if (text.includes('beer')) return 'Beer'
  if (text.includes('liquor') || text.includes('wine') || text.includes('alcohol')) return 'Liquor'
  if (text.includes('beverage') || text.includes('soda') || text.includes('drink') || text.includes('coffee') || text.includes('tea') || text.includes('juice')) return 'Beverage'
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
  const combined = `${String(explicit || '').toLowerCase()} ${description}`
  return normalizeSpendCategory(combined || explicit || 'Other')
}


function KpiCard({ item, onClick, derived }) {
  const [title, value, meta, icon, tone] = item
  const isSalesMonth = title === 'Sales This Month'
  const isCashCollected = title === 'Cash Collected'

  return <button className={`kpi-card dashboard-click-card ${isSalesMonth ? 'sales-month-enhanced' : ''} ${isCashCollected ? 'cash-collected-enhanced' : ''}`} onClick={onClick} type="button">
    <div className={`kpi-icon ${tone}`}><Icon name={icon} size={24} /></div>
    <div>
      <h3>{title}</h3>
      <strong>{value}</strong>
      <p className={title.includes('Loss') || title.includes('Refund') ? 'down' : ''}>{meta}</p>
      {isSalesMonth && derived ? <div className="sales-breakdown-mini">
        <div className="sales-breakdown-mini-row"><span>Sales Tax</span><b>{money(derived.taxMonth)}</b></div>
        <div className="sales-breakdown-mini-row"><span>Tips Net</span><b>{money(derived.tipsAfterWithholdingMonth)}</b></div>
        <div className="sales-breakdown-mini-row"><span>Tips Withheld</span><b>{money(derived.tipsWithheldMonth)}</b></div>
        <div className="net-formula-mini">Net = Sales - Tax - Tips</div>
      </div> : null}
      {isCashCollected && derived ? <div className="sales-breakdown-mini">
        <div className="sales-breakdown-mini-row"><span>Rows</span><b>{derived.monthSales.length}</b></div>
        <div className="sales-breakdown-mini-row"><span>Cash</span><b>{money(derived.cashMonth)}</b></div>
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

  const derived = useMemo(() => {
    const todaySales = salesDays.filter(row => row.business_date === todayStr())
    const weekSales = salesDays.filter(row => thisWeek(row.business_date))
    const monthSales = salesDays.filter(row => thisMonth(row.business_date))
    const monthPayroll = payroll.filter(row => thisMonth(row.pay_date || row.date))
    const cashPayrollRows = monthPayroll.filter(isCashPayroll)
    const checkPayrollRows = monthPayroll.filter(isCheckPayroll)
    const monthInvoices = invoices.filter(row => thisMonth(row.invoice_date || row.date))
    const invoiceById = Object.fromEntries(invoices.map(inv => [inv.id, inv]))
    const monthInvoiceItems = invoiceItems.filter(row => {
      const inv = invoiceById[row.invoice_id] || {}
      return thisMonth(row.invoice_date || row.date || row.created_at || inv.invoice_date || inv.date)
    })
    const monthExpenses = expenseRows.filter(row => thisMonth(row.date || row.expense_date))

    const salesToday = todaySales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const salesWeek = weekSales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const salesMonth = monthSales.reduce((sum, row) => sum + num(row.net_sales), 0)
    const cashMonth = monthSales.reduce((sum, row) => sum + num(row.cash_sales), 0)
    const taxMonth = monthSales.reduce((sum, row) => sum + num(row.tax), 0)
    const tipsMonth = monthSales.reduce((sum, row) => sum + num(row.tips), 0)
    const tipsWithheldMonth = monthSales.reduce((sum, row) => sum + num(row.tips_withheld || row.tip_deduction || row.tips_withholding), 0)
    const tipsAfterWithholdingMonth = tipsMonth - tipsWithheldMonth
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
      .map(row => ({ ...row, source: 'Invoice', amount: invoiceTotal(row), category: normalizeSpendCategory(rowCategory(row)), date: rowDate(row, ['invoice_date', 'date']) }))

    const expenseCategorySpend = monthExpenses.map(row => ({ ...row, source: 'Expense', amount: num(row.amount), category: normalizeSpendCategory(rowCategory(row)), date: rowDate(row, ['date', 'expense_date']) }))
    const expensesFromInvoiceCategories = [...invoiceItemCategorySpend, ...invoiceHeaderCategorySpend, ...expenseCategorySpend]

    const foodFromItems = invoiceItemCategorySpend.filter(row => row.category === 'Food').reduce((sum, row) => sum + num(row.amount), 0)
    const foodFromInvoices = invoiceHeaderCategorySpend.filter(row => row.category === 'Food').reduce((sum, row) => sum + num(row.amount), 0)
    const foodSpend = foodFromItems + foodFromInvoices
    const foodCostPercent = salesMonth > 0 ? (foodSpend / salesMonth) * 100 : 0

    const totalExpensesAll = expensesFromInvoiceCategories.reduce((sum, row) => sum + num(row.amount), 0)
    const profit = salesMonth - payrollMonth - totalExpensesAll
    const categoryMap = new Map()
    expensesFromInvoiceCategories.forEach(row => {
      const key = normalizeSpendCategory(row.category)
      categoryMap.set(key, (categoryMap.get(key) || 0) + num(row.amount))
    })
    SPEND_CATEGORY_ORDER.forEach(category => { if (!categoryMap.has(category)) categoryMap.set(category, 0) })
    const categoryRows = [...categoryMap.entries()]
      .sort((a, b) => {
        const ai = SPEND_CATEGORY_ORDER.indexOf(a[0])
        const bi = SPEND_CATEGORY_ORDER.indexOf(b[0])
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
        return b[1] - a[1]
      })
      .map(([category, amount]) => ({ id: `cat-${category}`, category, amount }))

    return { todaySales, weekSales, monthSales, monthPayroll, cashPayrollRows, checkPayrollRows, monthInvoices, monthExpenses, monthInvoiceItems, salesToday, salesWeek, salesMonth, cashMonth, taxMonth, tipsMonth, tipsWithheldMonth, tipsAfterWithholdingMonth, trueNetSalesMonth, cashPayroll, checkPayroll, payrollMonth, invoiceSpend, expenseSpend, foodSpend, foodCostPercent, totalExpensesAll, profit, categoryRows, expensesFromInvoiceCategories }
  }, [salesDays, payroll, invoices, invoiceItems, expenseRows])

  const kpiItems = [
    ['Sales Today', money(derived.salesToday), noThisPeriod(derived.todaySales, 'sales', 'today'), 'cart', 'green', 'sales-today'],
    ['Sales This Week', money(derived.salesWeek), noThisPeriod(derived.weekSales, 'sales', 'this week'), 'store', 'blue', 'sales-week'],
    ['Sales This Month', money(derived.trueNetSalesMonth), `${derived.monthSales.length} rows`, 'calendar', 'purple', 'sales-month'],
    ['Cash Collected', money(derived.cashMonth), `${derived.monthSales.length} uploaded sales rows`, 'dollar', 'green', 'cash-collected'],
    ['Profit / Loss', money(derived.profit), 'Sales - payroll - expenses - invoices', 'dollar', 'teal', 'profit-loss'],
    ['Cash Payroll', money(derived.cashPayroll), emptyLabel(derived.cashPayrollRows, 'cash payroll'), 'payroll', 'orange', 'cash-payroll'],
    ['Check Payroll', money(derived.checkPayroll), emptyLabel(derived.checkPayrollRows, 'check payroll'), 'card', 'blue', 'check-payroll'],
    ['Food Cost %', pct(derived.foodCostPercent), `${money(derived.foodSpend)} food spend / ${money(derived.salesMonth)} sales`, 'utensils', 'orange', 'food-cost'],
    ['Expenses by Category', money(derived.totalExpensesAll), `${derived.categoryRows.length} categories`, 'expenses', 'purple', 'expense-categories'],
    ['Invoice Spend', money(derived.invoiceSpend), emptyLabel(derived.monthInvoices, 'invoices this month'), 'invoices', 'red', 'invoices'],
    ['Tips', money(derived.tipsMonth), 'This month from sales', 'gift', 'green', 'sales-tips'],
    ['Employees', String(employees.length), emptyLabel(employees, 'employees'), 'employees', 'teal', 'employees']
  ]

  const salesSummary = [
    ['Cash', money(salesDays.reduce((s, r) => s + num(r.cash_sales), 0)), emptyLabel(salesDays, 'sales')],
    ['Credit Sales', money(salesDays.reduce((s, r) => s + num(r.credit_sales), 0)), emptyLabel(salesDays, 'sales')],
    ['Tips', money(salesDays.reduce((s, r) => s + num(r.tips), 0)), emptyLabel(salesDays, 'sales')],
    ['Total Sales', money(salesDays.reduce((s, r) => s + num(r.net_sales), 0)), emptyLabel(salesDays, 'sales')]
  ]
  const invoiceRows = invoices.slice(0, 6).map(row => [row.vendor || row.vendor_name || 'Invoice', rowDate(row, ['invoice_date', 'date']), money(invoiceTotal(row))])
  const recentExpenses = expenseRows.slice(0, 6).map(row => [row.name || row.category || 'Expense', rowDate(row, ['date', 'expense_date']), money(num(row.amount))])

  const detailConfig = {
    'sales-today': { title: 'Sales Today Details', open: 'sales', rows: derived.todaySales, message: derived.todaySales.length ? '' : 'No sales today.', columns: [
      { key: 'business_date', label: 'Date' }, { key: 'net_sales', label: 'Net', render: r => money(num(r.net_sales)) }, { key: 'cash_sales', label: 'Cash', render: r => money(num(r.cash_sales)) }, { key: 'credit_sales', label: 'Credit', render: r => money(num(r.credit_sales)) }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }
    ]},
    'sales-week': { title: 'Sales This Week Details', open: 'sales', rows: derived.weekSales, message: derived.weekSales.length ? '' : 'No sales this week.', columns: [
      { key: 'business_date', label: 'Date' }, { key: 'net_sales', label: 'Net', render: r => money(num(r.net_sales)) }, { key: 'cash_sales', label: 'Cash', render: r => money(num(r.cash_sales)) }, { key: 'credit_sales', label: 'Credit', render: r => money(num(r.credit_sales)) }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }
    ]},
    'sales-month': { title: 'Sales This Month Details', open: 'sales', rows: derived.monthSales, message: derived.monthSales.length ? '' : 'No sales this month.', columns: [
      { key: 'business_date', label: 'Date' }, { key: 'net_sales', label: 'Net', render: r => money(num(r.net_sales)) }, { key: 'cash_sales', label: 'Cash', render: r => money(num(r.cash_sales)) }, { key: 'credit_sales', label: 'Credit', render: r => money(num(r.credit_sales)) }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }
    ]},
    'sales-tips': { title: 'Tips From Sales', open: 'sales', rows: derived.monthSales.filter(r => num(r.tips) > 0), columns: [
      { key: 'business_date', label: 'Date' }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }, { key: 'net_sales', label: 'Net Sales', render: r => money(num(r.net_sales)) }
    ]},
    'cash-collected': { title: 'Cash Collected From Uploaded Sales', open: 'sales', rows: derived.monthSales.filter(r => num(r.cash_sales) > 0), message: `Cash collected this month = ${money(derived.cashMonth)}`, columns: [
      { key: 'business_date', label: 'Date' }, { key: 'cash_sales', label: 'Cash', render: r => money(num(r.cash_sales)) }, { key: 'net_sales', label: 'Net Sales', render: r => money(num(r.net_sales)) }, { key: 'source_file', label: 'Source', render: r => r.source_file || '-' }
    ]},
    'cash-payroll': { title: 'Cash Payroll Employees', open: 'payroll', rows: derived.cashPayrollRows, columns: [
      { key: 'pay_date', label: 'Date' }, { key: 'employee_name', label: 'Employee', render: r => r.employee_name || r.name || '-' }, { key: 'hours', label: 'Hours', render: r => num(r.hours).toFixed(2) }, { key: 'extra_pay', label: 'Extra Pay', render: r => money(num(r.extra_pay)) }, { key: 'total_pay', label: 'Total', render: r => money(num(r.total_pay || r.amount)) }
    ]},
    'check-payroll': { title: 'Check Payroll Employees', open: 'payroll', rows: derived.checkPayrollRows, columns: [
      { key: 'pay_date', label: 'Date' }, { key: 'employee_name', label: 'Employee', render: r => r.employee_name || r.name || '-' }, { key: 'hours', label: 'Hours', render: r => num(r.hours).toFixed(2) }, { key: 'tips_after_withholding', label: 'Tips After Withheld', render: r => money(num(r.tips_after_withholding || r.final_tips || r.tips)) }, { key: 'total_pay', label: 'Total', render: r => money(num(r.total_pay || r.amount)) }
    ]},
    'profit-loss': { title: 'Profit / Loss Breakdown', open: 'reports', rows: [
      { label: 'Sales This Month', amount: derived.salesMonth }, { label: 'Payroll This Month', amount: -derived.payrollMonth }, { label: 'Invoices This Month', amount: -derived.invoiceSpend }, { label: 'Manual Expenses This Month', amount: -derived.expenseSpend }, { label: 'Profit / Loss', amount: derived.profit }
    ], columns: [
      { key: 'label', label: 'Line Item' }, { key: 'amount', label: 'Amount', render: r => money(num(r.amount)) }
    ]},
    'food-cost': { title: 'Food Cost Details', open: 'reports', rows: derived.monthInvoiceItems.filter(row => isFoodCategory(rowCategory(row))).length ? derived.monthInvoiceItems.filter(row => isFoodCategory(rowCategory(row))).map(row => ({...row, amount: itemAmount(row)})) : derived.monthInvoices.filter(row => isFoodCategory(rowCategory(row))).map(row => ({...row, amount: invoiceTotal(row)})), message: derived.foodSpend ? `Food Cost % = ${money(derived.foodSpend)} / ${money(derived.salesMonth)} = ${pct(derived.foodCostPercent)}` : 'No Food category spend entered this month.', columns: [
      { key: 'date', label: 'Date', render: r => rowDate(r, ['invoice_date', 'date']) }, { key: 'vendor', label: 'Vendor', render: r => r.vendor || r.vendor_name || '-' }, { key: 'description', label: 'Item/Category', render: r => r.description || r.item_name || r.category || '-' }, { key: 'amount', label: 'Amount', render: r => money(num(r.amount)) }
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
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(190px, 1fr));
        gap: 14px;
        align-items: stretch;
      }

      .kpi-card.dashboard-click-card {
        min-height: 150px;
        height: auto;
        padding: 18px 20px;
        display: flex;
        align-items: flex-start;
        gap: 16px;
        overflow: hidden;
      }

      .kpi-card.dashboard-click-card .kpi-icon {
        flex: 0 0 auto;
      }

      .kpi-card.dashboard-click-card > div:last-child {
        min-width: 0;
        width: 100%;
      }

      .kpi-card.dashboard-click-card h3 {
        margin: 0 0 8px;
        line-height: 1.2;
        font-size: 16px;
      }

      .kpi-card.dashboard-click-card strong {
        display: block;
        margin: 0 0 8px;
        font-size: clamp(24px, 2vw, 32px);
        line-height: 1.05;
        white-space: nowrap;
      }

      .kpi-card.dashboard-click-card p {
        margin: 0;
        color: #00a35c;
        font-size: 15px;
        line-height: 1.35;
      }

      .kpi-card.dashboard-click-card p.down {
        color: #e00000;
      }

      .dashboard-click-card.sales-month-enhanced,
      .dashboard-click-card.cash-collected-enhanced {
        min-height: 235px;
      }

      .sales-breakdown-mini {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #e4ecf5;
        display: grid;
        gap: 9px;
      }

      .sales-breakdown-mini-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: baseline;
        gap: 12px;
        font-size: 14px;
        line-height: 1.25;
        color: #536984;
      }

      .sales-breakdown-mini-row span {
        min-width: 0;
        overflow-wrap: normal;
      }

      .sales-breakdown-mini-row b {
        color: #001b3d;
        font-size: 14px;
        font-weight: 800;
        white-space: nowrap;
        text-align: right;
      }

      .net-formula-mini {
        margin-top: 8px;
        padding: 10px 12px;
        border-radius: 14px;
        background: #f6f8fc;
        color: #25415f;
        font-size: 13px;
        font-weight: 800;
        line-height: 1.35;
      }

      .panel-grid {
        margin-top: 18px;
      }

      @media (max-width: 1350px) {
        .kpi-grid {
          grid-template-columns: repeat(4, minmax(190px, 1fr));
        }
      }

      @media (max-width: 1100px) {
        .kpi-grid {
          grid-template-columns: repeat(3, minmax(190px, 1fr));
        }
      }

      @media (max-width: 760px) {
        .kpi-grid {
          grid-template-columns: repeat(2, minmax(160px, 1fr));
        }
      }

      @media (max-width: 520px) {
        .kpi-grid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>


    <div className="page-head">
      <div><h1>Good morning, Admin 👋</h1><p>Live dashboard using only data entered/imported in RestaPay.</p></div>
      <div className="actions"><button className="btn secondary" onClick={() => openScreen('sales')}><Icon name="upload" /> Import Sales</button><button className="btn secondary" onClick={() => openScreen('invoices')}><Icon name="invoices" /> Add Invoice</button><button className="btn primary" onClick={() => openScreen('expenses')}><Icon name="plus" /> Add Expense</button></div>
    </div>
    <div className="kpi-grid">{kpiItems.map((item) => <KpiCard key={item[0]} item={item} derived={derived} onClick={() => showDetail(item[5])} />)}</div>
    <div className="panel-grid"><ListPanel title="Sales Summary" rows={salesSummary} type="sales" onViewAll={() => showDetail('sales-month')} /><ListPanel title="Recent Invoices" rows={invoiceRows} onViewAll={() => showDetail('invoices')} /><ListPanel title="Recent Expenses" rows={recentExpenses} type="expenses" onViewAll={() => showDetail('expense-categories')} /></div>
    <div className="bottom-strip">
      {[["Employees", String(employees.length), 'Total','employees','employees'],['Active Vendors',String(vendors.length),'Vendors','vendors','vendors'],['Open Invoices',String(invoices.length),money(invoices.reduce((s, r) => s + invoiceTotal(r), 0)),'invoices','invoices'],['Expenses Categories',String(derived.categoryRows.length),money(derived.totalExpensesAll),'expenses','expense-categories'],['Sales Rows',String(salesDays.length),'Saved locally','reports','sales-month'],['Payroll Groups',String(groups.length),'Active','payroll','cash-payroll']].map(x => <button className="strip-item dashboard-strip-button" key={x[0]} onClick={() => showDetail(x[4])}><Icon name={x[3]} /><div><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small></div></button>)}
      <div className="sync-card"><Icon name="refresh" /><div><b>Local Data</b><small>Auto-saved in browser</small></div><span>✓</span></div>
    </div>
    <div id="dashboard-details">
      {currentDetail ? <DetailTable title={currentDetail.title} rows={currentDetail.rows} columns={currentDetail.columns} onOpen={() => openScreen(currentDetail.open)} message={currentDetail.message} /> : null}
    </div>
  </>
}
