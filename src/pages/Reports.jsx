import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { createId } from '../lib/localStore'

function today() { return new Date().toISOString().slice(0, 10) }
function startOfMonthISO(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10) }
function readSavedDateRange() {
  try {
    const saved = JSON.parse(localStorage.getItem('restapay_reports_date_range') || '{}')
    return { start: saved.start || startOfMonthISO(), end: saved.end || today() }
  } catch {
    return { start: startOfMonthISO(), end: today() }
  }
}
function saveGlobalDateRange(start, end) {
  try { localStorage.setItem('restapay_reports_date_range', JSON.stringify({ start, end })) } catch {}
}
function money(value) { return Number(value || 0).toFixed(2) }
function num(value) { return Number(String(value ?? '').replace(/[$,%]/g, '')) || 0 }
function rowDate(row) { return row.business_date || row.pay_date || row.date || row.invoice_date || row.expense_date || row.created_at?.slice(0, 10) || today() }
function inRange(row, start, end) {
  const d = rowDate(row)
  if (start && d < start) return false
  if (end && d > end) return false
  return true
}
function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
function exportPdf(title, headers, rows, rangeLabel) {
  const htmlRows = rows.map(row => `<tr>${row.map(cell => `<td>${String(cell ?? '')}</td>`).join('')}</tr>`).join('')
  const win = window.open('', '_blank')
  win.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body{font-family:Inter,Arial,sans-serif;color:#172033;padding:24px;background:#fff}
    h1{font-size:22px;margin:0 0 4px}p{margin:0 0 18px;color:#5d6b82;font-size:12px}
    table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #d8e1ea;padding:7px;text-align:left}th{background:#f5f8fb;font-weight:700}
  </style></head><body><h1>${title}</h1><p>${rangeLabel}</p><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${htmlRows || `<tr><td colspan="${headers.length}">No data</td></tr>`}</tbody></table><script>window.onload=()=>{window.print()}</script></body></html>`)
  win.document.close()
}

const fieldCatalog = {
  sales: [
    ['business_date', 'Date'], ['gross_sales', 'Gross'], ['net_sales', 'Net'], ['cash_sales', 'Cash'], ['credit_sales', 'Credit'],
    ['gift_card_sales', 'Gift'], ['online_orders', 'Online'], ['tips', 'Tips'], ['refunds', 'Refunds'], ['discounts', 'Discounts'], ['tax', 'Tax'], ['guest_count', 'Guests']
  ],
  payroll: [
    ['date', 'Date'], ['employee_name', 'Employee'], ['payroll_type', 'Payroll Type'], ['hours', 'Hours'], ['regular_pay', 'Base Pay'], ['rate', 'Rate'], ['tips', 'Tips'], ['tip_deduction', 'Withheld'], ['tips_after_withheld', 'Final Tips'], ['extra_pay', 'Extra Pay'], ['extra_reason', 'Reason'], ['total_pay', 'Total']
  ],
  vendors: [
    ['name', 'Vendor'], ['category', 'Category'], ['contact', 'Contact'], ['phone', 'Phone'], ['email', 'Email'], ['is_active', 'Status'], ['notes', 'Notes']
  ],
  invoices: [
    ['date', 'Date'], ['vendor_name', 'Vendor'], ['invoice_number', 'Invoice #'], ['category', 'Category'], ['total', 'Total'], ['status', 'Status']
  ],
  priceInflation: [
    ['vendor', 'Vendor'], ['item', 'Item'], ['category', 'Category'], ['first_date', 'First Date'], ['latest_date', 'Latest Date'], ['first_price', 'Old Unit'], ['latest_price', 'New Unit'], ['difference', 'Increase $'], ['percent', 'Increase %'], ['invoice_count', 'Invoices'], ['latest_invoice', 'Latest Invoice']
  ],
  expenses: [
    ['date', 'Date'], ['name', 'Expense'], ['category', 'Category'], ['payment_method', 'Paid By'], ['vendor', 'Vendor / Payee'], ['amount', 'Amount'], ['notes', 'Notes']
  ]
}

const standardReports = [
  { id: 'sales', label: 'Sales Report', source: 'sales', fields: ['business_date','gross_sales','net_sales','cash_sales','credit_sales','gift_card_sales','online_orders','tips','refunds','discounts','tax','guest_count'] },
  { id: 'payroll', label: 'Payroll Report', source: 'payroll', fields: ['date','employee_name','payroll_type','hours','tips_after_withheld','extra_pay','extra_reason','total_pay'] },
  { id: 'cash-payroll', label: 'Employee Cash Payroll Report', source: 'payrollCash', fields: ['date','employee_name','hours','regular_pay','extra_pay','extra_reason','total_pay'] },
  { id: 'check-payroll', label: 'Employee Check Payroll Report', source: 'payrollCheck', fields: ['date','employee_name','hours','tips','tip_deduction','tips_after_withheld','extra_pay','extra_reason','total_pay'] },
  { id: 'vendors', label: 'Vendor Report', source: 'vendors', fields: ['name','category','contact','phone','email','is_active'] },
  { id: 'invoices', label: 'Invoice Report', source: 'invoices', fields: ['date','vendor_name','invoice_number','category','total','status'] },
  { id: 'expenses', label: 'Restaurant Expenses Report', source: 'expenses', fields: ['date','name','category','payment_method','vendor','amount','notes'] },
  { id: 'custom-weekly-restaurant', label: 'Custom Weekly Restaurant Report', source: 'weeklyRestaurant', fields: [] },
  { id: 'price-inflation', label: 'Price Inflation Report', source: 'priceInflation', fields: ['vendor','item','category','first_date','latest_date','first_price','latest_price','difference','percent','invoice_count'] },
  { id: 'profit-loss', label: 'Profit & Loss Report', source: 'profitLoss', fields: [] },
  { id: 'profit', label: 'Profit Estimate', source: 'profit', fields: ['metric','amount'] }
]

function getRawRows(data, source, start, end) {
  if (source === 'sales') return (data.salesDays || []).filter(row => inRange(row, start, end))
  if (source === 'payroll') return (data.payrollEntries || []).filter(row => inRange(row, start, end))
  if (source === 'payrollCash') return (data.payrollEntries || []).filter(row => row.payroll_type === 'Cash').filter(row => inRange(row, start, end))
  if (source === 'payrollCheck') return (data.payrollEntries || []).filter(row => row.payroll_type === 'Check').filter(row => inRange(row, start, end))
  if (source === 'vendors') return (data.vendors || [])
  if (source === 'invoices') return (data.invoices || []).filter(row => inRange(row, start, end))
  if (source === 'expenses') return (data.expenses || []).filter(row => inRange(row, start, end))
  if (source === 'priceInflation') return buildPriceInflationRows(data, start, end)
  return []
}
function readValue(row, key) {
  if (key === 'date') return rowDate(row)
  if (key === 'employee_name') return row.employee_name || row.name || 'Employee'
  if (key === 'vendor_name') return row.vendor_name || row.vendor || 'Vendor'
  if (key === 'is_active') return row.is_active === false || row.active === false ? 'Inactive' : 'Active'
  if (key === 'tips_after_withheld') return money(num(row.tips_after_withheld ?? (num(row.tips) - num(row.tip_deduction))))
  const value = row[key]
  if (['gross_sales','net_sales','cash_sales','credit_sales','gift_card_sales','online_orders','tips','refunds','discounts','tax','hours','rate','regular_pay','tips_withheld','tip_deduction','tips_after_withheld','extra_pay','total_pay','total','amount','invoice_total','first_price','latest_price','difference'].includes(key)) return money(value)
  if (key === 'percent') return `${Number(value || 0).toFixed(2)}%`
  return value ?? ''
}
function cleanItemName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}
function buildPriceInflationRows(data, start, end) {
  const invoicesById = Object.fromEntries((data.invoices || []).map(inv => [inv.id, inv]))
  const groups = new Map()
  ;(data.invoiceItems || []).forEach(item => {
    const inv = invoicesById[item.invoice_id] || {}
    const date = rowDate(inv)
    if (start && date < start) return
    if (end && date > end) return
    const name = cleanItemName(item.description || item.item || item.name)
    if (!name) return
    const vendor = inv.vendor_name || inv.vendor || 'Unknown Vendor'
    const unit = num(item.unit_price || item.price || item.unit || item.total)
    if (!unit) return
    const key = `${String(vendor).toLowerCase()}::${name}`
    const record = {
      vendor,
      item: item.description || item.item || item.name || name,
      category: item.category || inv.category || 'Other',
      date,
      unit,
      qty: num(item.qty || item.quantity || 1),
      total: num(item.total || item.amount || unit),
      invoice: inv.invoice_number || ''
    }
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(record)
  })
  return [...groups.values()].map(records => {
    records.sort((a, b) => a.date.localeCompare(b.date))
    const first = records[0]
    const latest = records[records.length - 1]
    const diff = latest.unit - first.unit
    const pct = first.unit ? (diff / first.unit) * 100 : 0
    return {
      vendor: latest.vendor,
      item: latest.item,
      category: latest.category,
      first_date: first.date,
      latest_date: latest.date,
      first_price: first.unit,
      latest_price: latest.unit,
      difference: diff,
      percent: pct,
      invoice_count: records.length,
      latest_invoice: latest.invoice
    }
  }).filter(row => row.invoice_count > 1 || row.difference !== 0)
    .sort((a, b) => b.percent - a.percent)
}

function titleCase(value) {
  return String(value || 'Other').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

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
  if (text.includes('beverage') || text.includes('soda') || text.includes('drink') || text.includes('coffee')) return 'Beverage'
  if (text.includes('suppl')) return 'Supplies'
  if (text.includes('util') || text.includes('electric') || text.includes('gas') || text.includes('water')) return 'Utilities'
  if (text.includes('maint') || text.includes('repair')) return 'Maintenance'
  if (text.includes('insurance')) return 'Insurance'
  if (text.includes('account')) return 'Accounting Fees'
  if (text.includes('loan') || text.includes('mortgage')) return 'Loans'
  if (text.includes('cash')) return 'Cash Expenses'
  if (text.includes('restaurant')) return 'Restaurant Expenses'
  return titleCase(value || 'Other')
}
function paymentMethod(row) {
  return titleCase(row.payment_method || row.payment || row.paid_by || row.method || 'Unknown')
}
function employeePayType(row) {
  return String(row.payroll_type || row.payment_type || row.pay_type || '').toLowerCase()
}
function invoiceAmount(row) {
  return num(row.total || row.amount || row.invoice_total || row.grand_total)
}
function buildWeeklyRestaurantReport(data, start, end) {
  const salesRows = getRawRows(data, 'sales', start, end)
  const payrollRows = getRawRows(data, 'payroll', start, end)
  const expenseRows = getRawRows(data, 'expenses', start, end)
  const invoiceRows = getRawRows(data, 'invoices', start, end)
  const cashSales = salesRows.reduce((acc, row) => acc + num(row.cash_sales), 0)

  const cashPayrollRows = payrollRows
    .filter(row => employeePayType(row) === 'cash')
    .map(row => {
      const base = num(row.regular_pay || row.base_pay || row.pay || row.amount)
      const extra = num(row.extra_pay)
      const total = num(row.total_pay || row.total || base + extra)
      return [rowDate(row), readValue(row, 'employee_name'), money(base), money(extra), row.extra_reason || '', money(total)]
    })
  const cashPayrollSubtotal = cashPayrollRows.reduce((acc, row) => acc + num(row[5]), 0)

  const tipsRows = payrollRows
    .filter(row => num(row.tips) || num(row.tip_deduction) || num(row.tips_after_withheld))
    .map(row => {
      const tips = num(row.tips)
      const withheld = num(row.tip_deduction || row.tips_withheld || row.withheld)
      const after = num(row.tips_after_withheld || (tips - withheld))
      const extra = num(row.extra_pay)
      const total = after + extra
      return [rowDate(row), readValue(row, 'employee_name'), money(tips), money(withheld), money(after), money(extra), row.extra_reason || '', money(total)]
    })
  const tipsOriginalSubtotal = tipsRows.reduce((acc, row) => acc + num(row[2]), 0)
  const tipsWithheldSubtotal = tipsRows.reduce((acc, row) => acc + num(row[3]), 0)
  const tipsAfterSubtotal = tipsRows.reduce((acc, row) => acc + num(row[4]), 0)

  const normalizeVendorExpense = (row, source) => ({
    date: rowDate(row),
    vendor: row.vendor || row.vendor_name || row.name || row.payee || 'Vendor / Expense',
    category: normalizeSpendCategory(row.category || row.expense_category || 'Other'),
    method: paymentMethod(row),
    amount: source === 'invoice' ? invoiceAmount(row) : num(row.amount || row.total),
    note: row.notes || row.invoice_number || row.description || source
  })
  const vendorExpenses = [
    ...expenseRows.map(row => normalizeVendorExpense(row, 'expense')),
    ...invoiceRows.map(row => normalizeVendorExpense(row, 'invoice'))
  ].filter(row => row.amount)
  const vendorPaymentRows = vendorExpenses
    .sort((a, b) => a.date.localeCompare(b.date) || a.vendor.localeCompare(b.vendor))
    .map(row => [row.date, row.vendor, row.category, row.method, row.note, money(row.amount)])
  const vendorPaymentSubtotal = vendorPaymentRows.reduce((acc, row) => acc + num(row[5]), 0)

  const cashVendorRows = vendorExpenses.filter(row => row.method.toLowerCase() === 'cash')
    .map(row => [row.date, row.vendor, row.category, row.note, money(row.amount)])
  const checkVendorRows = vendorExpenses.filter(row => ['check','cheque'].includes(row.method.toLowerCase()))
    .map(row => [row.date, row.vendor, row.category, row.note, money(row.amount)])
  const cashVendorSubtotal = cashVendorRows.reduce((acc, row) => acc + num(row[4]), 0)
  const checkVendorSubtotal = checkVendorRows.reduce((acc, row) => acc + num(row[4]), 0)

  const categoryMap = new Map()
  vendorExpenses.forEach(row => {
    const key = row.category || 'Other'
    if (!categoryMap.has(key)) categoryMap.set(key, { category: key, cash: 0, check: 0, credit: 0, ach: 0, other: 0, total: 0 })
    const rec = categoryMap.get(key)
    const method = row.method.toLowerCase()
    if (method === 'cash') rec.cash += row.amount
    else if (method === 'check' || method === 'cheque') rec.check += row.amount
    else if (method === 'credit' || method === 'card') rec.credit += row.amount
    else if (method === 'ach') rec.ach += row.amount
    else rec.other += row.amount
    rec.total += row.amount
  })
  SPEND_CATEGORY_ORDER.forEach(category => { if (!categoryMap.has(category)) categoryMap.set(category, { category, cash: 0, check: 0, credit: 0, ach: 0, other: 0, total: 0 }) })
  const categoryRows = [...categoryMap.values()]
    .sort((a, b) => SPEND_CATEGORY_ORDER.indexOf(a.category) - SPEND_CATEGORY_ORDER.indexOf(b.category))
    .map(row => [row.category, money(row.cash), money(row.check), money(row.credit), money(row.ach), money(row.other), money(row.total)])

  const totalCashSpending = cashPayrollSubtotal + cashVendorSubtotal
  const remainingCashBalance = cashSales - totalCashSpending
  const netSales = salesRows.reduce((acc, row) => acc + num(row.net_sales), 0)
  const grossSales = salesRows.reduce((acc, row) => acc + num(row.gross_sales), 0)
  const creditSales = salesRows.reduce((acc, row) => acc + num(row.credit_sales), 0)
  const giftSales = salesRows.reduce((acc, row) => acc + num(row.gift_card_sales), 0)
  const totalTipsSales = salesRows.reduce((acc, row) => acc + num(row.tips), 0)
  const refunds = salesRows.reduce((acc, row) => acc + num(row.refunds), 0)
  const discounts = salesRows.reduce((acc, row) => acc + num(row.discounts), 0)
  const allPayrollSubtotal = payrollRows.reduce((acc, row) => acc + num(row.total_pay || row.total || row.amount), 0)
  const manualExpenseSubtotal = expenseRows.reduce((acc, row) => acc + num(row.amount || row.total), 0)
  const allVendorSpend = vendorPaymentSubtotal
  const totalSpending = allPayrollSubtotal + allVendorSpend
  const estimatedProfitLoss = netSales - totalSpending

  return {
    title: 'Custom Weekly Restaurant Report',
    sections: [
      { title: 'Weekly Sales Summary', tone: 'sales', headers: ['Metric', 'Amount'], rows: [['Gross Sales', money(grossSales)], ['Net Sales', money(netSales)], ['Cash Sales', money(cashSales)], ['Credit Sales', money(creditSales)], ['Gift Card Sales', money(giftSales)], ['Tips', money(totalTipsSales)], ['Refunds', money(refunds)], ['Discounts', money(discounts)]], subtotal: netSales },
      { title: 'Cash Payment Employees', tone: 'payroll', headers: ['Date', 'Employee', 'Pay', 'Extra Pay', 'Reason', 'Total'], rows: cashPayrollRows, subtotal: cashPayrollSubtotal },
      { title: 'Employees With Tips', tone: 'tips', headers: ['Date', 'Employee', 'Original Tips', 'Withheld', 'Tips After Withholding', 'Extra Pay', 'Reason', 'Total'], rows: tipsRows, footer: [['Subtotals', '', money(tipsOriginalSubtotal), money(tipsWithheldSubtotal), money(tipsAfterSubtotal), '', '', money(tipsAfterSubtotal)]], subtotal: tipsAfterSubtotal },
      { title: 'Vendor Payments / Spending Detail', tone: 'vendors', headers: ['Date', 'Vendor / Payee', 'Category', 'Payment Type', 'Details', 'Amount'], rows: vendorPaymentRows, subtotal: vendorPaymentSubtotal },
      { title: 'Vendor Cash Expenses', tone: 'cash', headers: ['Date', 'Vendor / Payee', 'Category', 'Note', 'Amount'], rows: cashVendorRows, subtotal: cashVendorSubtotal },
      { title: 'Vendor Check Expenses', tone: 'checks', headers: ['Date', 'Vendor / Payee', 'Category', 'Note', 'Amount'], rows: checkVendorRows, subtotal: checkVendorSubtotal },
      { title: 'Cash Balance Summary', tone: 'balance', headers: ['Metric', 'Amount'], rows: [['Cash Sales', money(cashSales)], ['Cash Employee Payments', money(cashPayrollSubtotal)], ['Cash Vendor Expenses', money(cashVendorSubtotal)], ['Total Cash Spending', money(totalCashSpending)], ['Remaining Cash Balance', money(remainingCashBalance)]], subtotal: remainingCashBalance },
      { title: 'Weekly Spending Summary By Category', tone: 'categories', headers: ['Category', 'Cash', 'Check', 'Credit', 'ACH', 'Other', 'Total'], rows: categoryRows, subtotal: categoryRows.reduce((acc,row)=>acc+num(row[6]),0) },
      { title: 'Weekly Profit / Loss Analysis', tone: 'profit', headers: ['Metric', 'Amount'], rows: [['Net Sales', money(netSales)], ['Employee Payroll Total', money(allPayrollSubtotal)], ['Vendor / Invoice / Expense Spending', money(allVendorSpend)], ['Manual Expenses Included', money(manualExpenseSubtotal)], ['Total Weekly Spending', money(totalSpending)], ['Estimated Profit / Loss', money(estimatedProfitLoss)]], subtotal: estimatedProfitLoss }
    ]
  }
}

function isCategoryMatch(category, words) {
  const value = String(category || '').toLowerCase()
  return words.some(word => value.includes(word))
}
function buildProfitLossReport(data, start, end) {
  const salesRows = getRawRows(data, 'sales', start, end)
  const payrollRows = getRawRows(data, 'payroll', start, end)
  const invoiceRows = getRawRows(data, 'invoices', start, end)
  const expenseRows = getRawRows(data, 'expenses', start, end)

  const grossSales = salesRows.reduce((acc, row) => acc + num(row.gross_sales), 0)
  const netSales = salesRows.reduce((acc, row) => acc + num(row.net_sales), 0)
  const cashSales = salesRows.reduce((acc, row) => acc + num(row.cash_sales), 0)
  const creditSales = salesRows.reduce((acc, row) => acc + num(row.credit_sales), 0)
  const giftCards = salesRows.reduce((acc, row) => acc + num(row.gift_card_sales), 0)
  const refunds = salesRows.reduce((acc, row) => acc + num(row.refunds), 0)
  const discounts = salesRows.reduce((acc, row) => acc + num(row.discounts), 0)

  const cashPayroll = payrollRows.filter(row => employeePayType(row) === 'cash').reduce((acc, row) => acc + num(row.total_pay || row.total || row.amount), 0)
  const checkPayroll = payrollRows.filter(row => employeePayType(row) === 'check').reduce((acc, row) => acc + num(row.total_pay || row.total || row.amount), 0)
  const tipsPaid = payrollRows.reduce((acc, row) => acc + num(row.tips_after_withheld || (num(row.tips) - num(row.tip_deduction))), 0)
  const extraPay = payrollRows.reduce((acc, row) => acc + num(row.extra_pay), 0)
  const totalLabor = payrollRows.reduce((acc, row) => acc + num(row.total_pay || row.total || row.amount), 0)

  const cogsCategories = {
    Food: ['food', 'meat', 'produce', 'grocery', 'kitchen'],
    Beer: ['beer'],
    Beverages: ['beverage', 'soda', 'coffee', 'drink'],
    Liquor: ['liquor', 'wine', 'alcohol'],
    'Other Inventory': ['inventory', 'supplies']
  }
  const cogs = Object.fromEntries(Object.keys(cogsCategories).map(key => [key, 0]))
  const opExpenseMap = new Map()

  invoiceRows.forEach(row => {
    const category = normalizeSpendCategory(row.category || 'Other')
    const amount = invoiceAmount(row)
    const matched = Object.entries(cogsCategories).find(([, words]) => isCategoryMatch(category, words))
    if (matched) cogs[matched[0]] += amount
    else opExpenseMap.set(category, (opExpenseMap.get(category) || 0) + amount)
  })
  expenseRows.forEach(row => {
    const category = normalizeSpendCategory(row.category || 'Other')
    const amount = num(row.amount || row.total)
    opExpenseMap.set(category, (opExpenseMap.get(category) || 0) + amount)
  })

  const cogsRows = Object.entries(cogs).map(([name, amount]) => [name, money(amount)]).filter(row => num(row[1]) > 0)
  const totalCogs = Object.values(cogs).reduce((a, b) => a + b, 0)
  const operatingRows = [...opExpenseMap.entries()].sort((a,b)=>b[1]-a[1]).map(([name, amount]) => [name, money(amount)])
  const totalOperating = [...opExpenseMap.values()].reduce((a, b) => a + b, 0)
  const primeCost = totalLabor + totalCogs
  const netProfit = netSales - totalLabor - totalCogs - totalOperating
  const pct = value => netSales ? `${((value / netSales) * 100).toFixed(2)}%` : '0.00%'

  return {
    title: 'Profit & Loss Report',
    sections: [
      { title: 'Revenue', tone: 'sales', headers: ['Metric', 'Amount'], rows: [['Gross Sales', money(grossSales)], ['Net Sales', money(netSales)], ['Cash Sales', money(cashSales)], ['Credit Sales', money(creditSales)], ['Gift Cards', money(giftCards)], ['Refunds', money(refunds)], ['Discounts', money(discounts)]], subtotal: netSales },
      { title: 'Labor', tone: 'payroll', headers: ['Metric', 'Amount'], rows: [['Cash Payroll', money(cashPayroll)], ['Check Payroll', money(checkPayroll)], ['Tips Paid', money(tipsPaid)], ['Extra Pay', money(extraPay)], ['Total Labor', money(totalLabor)]], subtotal: totalLabor },
      { title: 'COGS / Vendor Purchases', tone: 'vendors', headers: ['Category', 'Amount'], rows: cogsRows.length ? cogsRows : [['No COGS Data', money(0)]], subtotal: totalCogs },
      { title: 'Operating Expenses', tone: 'expenses', headers: ['Category', 'Amount'], rows: operatingRows.length ? operatingRows : [['No Operating Expense Data', money(0)]], subtotal: totalOperating },
      { title: 'Financial Summary', tone: netProfit >= 0 ? 'balance' : 'profit', headers: ['Metric', 'Amount'], rows: [['Total Revenue', money(netSales)], ['Total Labor', money(totalLabor)], ['Total COGS', money(totalCogs)], ['Total Operating Expenses', money(totalOperating)], ['Prime Cost', money(primeCost)], ['Net Profit / Loss', money(netProfit)], ['Labor Cost %', pct(totalLabor)], ['Food Cost %', pct(cogs.Food || 0)], ['Total COGS %', pct(totalCogs)], ['Prime Cost %', pct(primeCost)], ['Profit Margin %', pct(netProfit)]], subtotal: netProfit }
    ]
  }
}

function flattenWeeklyReport(weekly) {
  const lines = []
  weekly.sections.forEach(section => {
    lines.push([section.title])
    lines.push(section.headers)
    section.rows.forEach(row => lines.push(row))
    ;(section.footer || []).forEach(row => lines.push(row))
    if (section.subtotal !== undefined) lines.push(['Subtotal', money(section.subtotal)])
    lines.push([])
  })
  return lines
}
function exportWeeklyPdf(weekly, rangeLabel) {
  const sectionHtml = weekly.sections.map(section => {
    const bodyRows = [...section.rows, ...(section.footer || [])]
      .map(row => `<tr>${row.map(cell => `<td>${String(cell ?? '')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${section.headers.length}">No data</td></tr>`
    return `<section class="report-section ${section.tone}"><h2>${section.title}</h2><table><thead><tr>${section.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table>${section.subtotal !== undefined ? `<div class="subtotal">Subtotal: $${money(section.subtotal)}</div>` : ''}</section>`
  }).join('')
  const win = window.open('', '_blank')
  win.document.write(`<!doctype html><html><head><title>${weekly.title}</title><style>
    body{font-family:Inter,Arial,sans-serif;color:#172033;padding:24px;background:#fff}h1{font-size:24px;margin:0 0 4px}p{margin:0 0 18px;color:#5d6b82;font-size:12px}.report-section{border:1px solid #cbd7e5;border-radius:12px;margin:0 0 16px;overflow:hidden}.report-section h2{margin:0;padding:10px 12px;background:#23344d;color:#fff;font-size:14px}.report-section.sales h2{background:#123c69}.report-section.payroll h2{background:#31572c}.report-section.tips h2{background:#674188}.report-section.vendors h2{background:#7c3f1d}.report-section.cash h2{background:#74512d}.report-section.checks h2{background:#293462}.report-section.profit h2{background:#1f4e5f}.report-section.balance h2{background:#0f5960}.report-section.categories h2{background:#4a5568}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border-bottom:1px solid #e1e8f0;padding:7px;text-align:left}th{background:#f4f7fb;font-weight:700}.subtotal{padding:9px 12px;background:#f8fafc;font-weight:700;text-align:right}
  </style></head><body><h1>${weekly.title}</h1><p>${rangeLabel}</p>${sectionHtml}<script>window.onload=()=>{window.print()}</script></body></html>`)
  win.document.close()
}

function moveItem(list, index, direction) {
  const next = [...list]
  const target = index + direction
  if (target < 0 || target >= next.length) return next
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export default function Reports({ data, setData }) {
  const [mode, setMode] = useState('standard')
  const [reportId, setReportId] = useState('sales')
  const [dateStart, setDateStart] = useState(() => readSavedDateRange().start)
  const [dateEnd, setDateEnd] = useState(() => readSavedDateRange().end)
  const [customName, setCustomName] = useState('Custom Sales Report')
  const [customSource, setCustomSource] = useState('sales')
  const [selectedFields, setSelectedFields] = useState(['business_date','net_sales','cash_sales','credit_sales','tips'])
  const [savedCustomId, setSavedCustomId] = useState('')

  const customReports = data.customReports || []
  const activeStandard = standardReports.find(r => r.id === reportId) || standardReports[0]
  const selectedCustom = customReports.find(r => r.id === savedCustomId)
  const activeReport = mode === 'custom' ? { label: customName || 'Custom Report', source: customSource, fields: selectedFields } : activeStandard
  const rangeLabel = `${dateStart || 'All'} to ${dateEnd || 'Latest'}`
  function applyReportPreset(preset) {
    const now = new Date()
    let start = '', end = ''
    if (preset === 'today') start = end = today()
    if (preset === 'thisMonth') { start = startOfMonthISO(); end = today() }
    if (preset === 'lastMonth') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10); end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10) }
    if (preset === 'lastWeek') {
      const day = now.getDay() || 7
      const thisMonday = new Date(now)
      thisMonday.setDate(now.getDate() - day + 1)
      const lastMonday = new Date(thisMonday)
      lastMonday.setDate(thisMonday.getDate() - 7)
      const lastSunday = new Date(lastMonday)
      lastSunday.setDate(lastMonday.getDate() + 6)
      start = lastMonday.toISOString().slice(0, 10)
      end = lastSunday.toISOString().slice(0, 10)
    }
    setDateStart(start)
    setDateEnd(end)
    saveGlobalDateRange(start, end)
  }


  const summary = useMemo(() => {
    const salesRows = getRawRows(data, 'sales', dateStart, dateEnd)
    const payrollRows = getRawRows(data, 'payroll', dateStart, dateEnd)
    const invoiceRows = getRawRows(data, 'invoices', dateStart, dateEnd)
    const expenseRows = getRawRows(data, 'expenses', dateStart, dateEnd)
    const sales = salesRows.reduce((acc, row) => acc + num(row.net_sales), 0)
    const cash = salesRows.reduce((acc, row) => acc + num(row.cash_sales), 0)
    const credit = salesRows.reduce((acc, row) => acc + num(row.credit_sales), 0)
    const tips = salesRows.reduce((acc, row) => acc + num(row.tips), 0)
    const payroll = payrollRows.reduce((acc, row) => acc + num(row.total_pay || row.total || row.amount), 0)
    const invoices = invoiceRows.reduce((acc, row) => acc + num(row.total || row.amount || row.invoice_total), 0)
    const expenses = expenseRows.reduce((acc, row) => acc + num(row.amount), 0)
    return { sales, cash, credit, tips, payroll, invoices, expenses, profit: sales - payroll - invoices - expenses }
  }, [data, dateStart, dateEnd])

  const weeklyRestaurant = useMemo(() => buildWeeklyRestaurantReport(data, dateStart, dateEnd), [data, dateStart, dateEnd])
  const profitLossReport = useMemo(() => buildProfitLossReport(data, dateStart, dateEnd), [data, dateStart, dateEnd])

  const { headers, rows } = useMemo(() => {
    if (activeReport.source === 'weeklyRestaurant' || activeReport.source === 'profitLoss') {
      return { headers: [], rows: [] }
    }
    if (activeReport.source === 'profit') {
      return { headers: ['Metric', 'Amount'], rows: [
        ['Net Sales', money(summary.sales)], ['Payroll', money(summary.payroll)], ['Invoices / Vendor Spend', money(summary.invoices)], ['Expenses', money(summary.expenses)], ['Estimated Profit', money(summary.profit)]
      ] }
    }
    const fields = activeReport.fields || []
    const labels = Object.fromEntries((fieldCatalog[activeReport.source] || []).map(([key, label]) => [key, label]))
    const raw = getRawRows(data, activeReport.source, dateStart, dateEnd)
    return { headers: fields.map(key => labels[key] || key), rows: raw.map(row => fields.map(key => readValue(row, key))) }
  }, [activeReport, data, dateStart, dateEnd, summary])

  function exportCsv() {
    if (activeReport.source === 'weeklyRestaurant') {
      downloadCsv(`restapay-custom-weekly-restaurant-report-${dateStart || 'all'}-${dateEnd || 'latest'}.csv`, flattenWeeklyReport(weeklyRestaurant))
      return
    }
    if (activeReport.source === 'profitLoss') {
      downloadCsv(`restapay-profit-loss-report-${dateStart || 'all'}-${dateEnd || 'latest'}.csv`, flattenWeeklyReport(profitLossReport))
      return
    }
    downloadCsv(`restapay-${(activeReport.label || 'report').toLowerCase().replace(/\s+/g, '-')}-${dateStart || 'all'}-${dateEnd || 'latest'}.csv`, [headers, ...rows])
  }
  function exportPdfReport() {
    if (activeReport.source === 'weeklyRestaurant') {
      exportWeeklyPdf(weeklyRestaurant, rangeLabel)
      return
    }
    if (activeReport.source === 'profitLoss') {
      exportWeeklyPdf(profitLossReport, rangeLabel)
      return
    }
    exportPdf(activeReport.label || 'RestaPay Report', headers, rows, rangeLabel)
  }

  function exportExcelReport() {
    const reportObject = activeReport.source === 'weeklyRestaurant' ? weeklyRestaurant : activeReport.source === 'profitLoss' ? profitLossReport : null
    if (reportObject) {
      const rowsForExport = flattenWeeklyReport(reportObject)
      downloadCsv(`restapay-${reportObject.title.toLowerCase().replace(/\s+/g, '-')}-${dateStart || 'all'}-${dateEnd || 'latest'}.csv`, rowsForExport)
      return
    }
    downloadCsv(`restapay-${(activeReport.label || 'report').toLowerCase().replace(/\s+/g, '-')}-${dateStart || 'all'}-${dateEnd || 'latest'}.csv`, [headers, ...rows])
  }

  function toggleField(field) {
    setSelectedFields(prev => prev.includes(field) ? prev.filter(item => item !== field) : [...prev, field])
  }
  function saveCustomReport() {
    const report = { id: savedCustomId || createId('report'), name: customName || 'Custom Report', source: customSource, fields: selectedFields, created_at: new Date().toISOString() }
    setData(prev => ({ ...prev, customReports: savedCustomId ? (prev.customReports || []).map(r => r.id === savedCustomId ? report : r) : [...(prev.customReports || []), report] }))
    setSavedCustomId(report.id)
  }
  function loadCustom(id) {
    const report = customReports.find(r => r.id === id)
    setSavedCustomId(id)
    if (!report) return
    setCustomName(report.name)
    setCustomSource(report.source)
    setSelectedFields(report.fields || [])
    setMode('custom')
  }
  function deleteCustom() {
    if (!savedCustomId) return
    setData(prev => ({ ...prev, customReports: (prev.customReports || []).filter(r => r.id !== savedCustomId) }))
    setSavedCustomId('')
  }

  return <>
    <div className="page-head employee-head">
      <div><h1>Reports</h1><p>Run standard reports or build custom reports with manual column order and date ranges.</p></div>
      <div className="employee-head-actions">
        <button className="btn ghost" onClick={exportPdfReport} type="button"><Icon name="download" /> Export PDF</button>
        <button className="btn ghost" onClick={exportExcelReport} type="button"><Icon name="spreadsheet" /> Export Excel</button>
        <button className="btn primary" onClick={exportCsv} type="button"><Icon name="download" /> Export CSV</button>
      </div>
    </div>

    <div className="reports-mode-tabs">
      <button className={mode === 'standard' ? 'active' : ''} type="button" onClick={() => setMode('standard')}>Standard Reports</button>
      <button className={mode === 'custom' ? 'active' : ''} type="button" onClick={() => setMode('custom')}>Custom Report Builder</button>
    </div>

    <div className="sales-filter-bar report-filter-bar enhanced-report-filter">
      {mode === 'standard' ? <select className="filter-select" value={reportId} onChange={e => setReportId(e.target.value)}>
        {standardReports.map(report => <option key={report.id} value={report.id}>{report.label}</option>)}
      </select> : <select className="filter-select" value={savedCustomId} onChange={e => loadCustom(e.target.value)}>
        <option value="">New / Unsaved Custom Report</option>
        {customReports.map(report => <option key={report.id} value={report.id}>{report.name}</option>)}
      </select>}
      <DateControls start={dateStart} end={dateEnd} onStartChange={value => { setDateStart(value); saveGlobalDateRange(value, dateEnd) }} onEndChange={value => { setDateEnd(value); saveGlobalDateRange(dateStart, value) }} onApply={() => saveGlobalDateRange(dateStart, dateEnd)} onPreset={applyReportPreset} />
    </div>

    {mode === 'custom' && <section className="report-builder-card">
      <div className="report-builder-grid">
        <label><span>Report Name</span><input value={customName} onChange={e => setCustomName(e.target.value)} /></label>
        <label><span>Data Source</span><select value={customSource} onChange={e => { setCustomSource(e.target.value); setSelectedFields((fieldCatalog[e.target.value] || []).slice(0, 5).map(([key]) => key)) }}>
          <option value="sales">Sales</option><option value="payroll">Payroll</option><option value="vendors">Vendors</option><option value="invoices">Invoices</option><option value="priceInflation">Price Inflation</option><option value="expenses">Expenses</option>
        </select></label>
        <div className="report-builder-actions"><button className="btn primary" onClick={saveCustomReport} type="button"><Icon name="save" /> Save Template</button>{savedCustomId && <button className="btn ghost delete-link" onClick={deleteCustom} type="button">Delete Template</button>}</div>
      </div>
      <div className="report-fields-wrap">
        <div><h3>Available Fields</h3><div className="report-field-list">
          {(fieldCatalog[customSource] || []).map(([key, label]) => <button key={key} className={selectedFields.includes(key) ? 'selected' : ''} type="button" onClick={() => toggleField(key)}>{label}</button>)}
        </div></div>
        <div><h3>Manual Column Order</h3><div className="report-order-list">
          {selectedFields.map((field, index) => {
            const label = Object.fromEntries((fieldCatalog[customSource] || []).map(([k, v]) => [k, v]))[field] || field
            return <div className="report-order-row" key={field}><span>{index + 1}. {label}</span><button type="button" onClick={() => setSelectedFields(prev => moveItem(prev, index, -1))}>↑</button><button type="button" onClick={() => setSelectedFields(prev => moveItem(prev, index, 1))}>↓</button><button type="button" onClick={() => setSelectedFields(prev => prev.filter(item => item !== field))}>Remove</button></div>
          })}
          {selectedFields.length === 0 && <small>No columns selected.</small>}
        </div></div>
      </div>
    </section>}

    <div className="payroll-summary-row sales-summary-row clickable-summary-row">
      <button type="button" className="summary-click-card tone-blue" onClick={() => { setMode('standard'); setReportId('sales') }}><span>Net Sales</span><b>${money(summary.sales)}</b><small>Open sales detail report</small></button>
      <button type="button" className="summary-click-card tone-green" onClick={() => { setMode('standard'); setReportId('payroll') }}><span>Payroll</span><b>${money(summary.payroll)}</b><small>Open payroll detail report</small></button>
      <button type="button" className="summary-click-card tone-orange" onClick={() => { setMode('standard'); setReportId('invoices') }}><span>Vendor / Invoice Spend</span><b>${money(summary.invoices)}</b><small>Open invoice detail report</small></button>
      <button type="button" className="summary-click-card tone-purple" onClick={() => { setMode('standard'); setReportId('profitLoss') }}><span>Estimated Profit</span><b>${money(summary.profit)}</b><small>Open profit & loss report</small></button>
    </div>

    {(activeReport.source === 'weeklyRestaurant' || activeReport.source === 'profitLoss') ? <section className="weekly-report-wrap">
      <div className="weekly-report-title"><h2>{activeReport.source === 'profitLoss' ? 'Profit & Loss Report' : 'Custom Weekly Restaurant Report'}</h2><span>{rangeLabel}</span></div>
      {(activeReport.source === 'profitLoss' ? profitLossReport : weeklyRestaurant).sections.map(section => <section className={`weekly-report-section ${section.tone}`} key={section.title}>
        <header><h3>{section.title}</h3>{section.subtotal !== undefined && <b>${money(section.subtotal)}</b>}</header>
        <table className="sales-table"><thead><tr>{section.headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>
          {section.rows.map((row, index) => <tr key={index}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}
          {(section.footer || []).map((row, index) => <tr className="weekly-subtotal-row" key={`footer-${index}`}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}
          {section.rows.length === 0 && !(section.footer || []).length && <tr><td colSpan={section.headers.length}><small>No data for this section.</small></td></tr>}
        </tbody></table>
      </section>)}
    </section> : <section className="table-card compact-table-card sales-history-card">
      <header><h2>{activeReport.label || selectedCustom?.name || 'Custom'} Report</h2><span>{rows.length} rows • {rangeLabel}</span></header>
      {activeReport.source === 'priceInflation' && <p className="report-note">Compares matching invoice line items by vendor/item name. Highest percentage increases show first. Add more invoices with line items to improve accuracy.</p>}
      <table className="sales-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>
        {rows.map((row, index) => <tr key={index}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}
        {rows.length === 0 && <tr><td colSpan={headers.length || 1}><small>No report data found for this selection.</small></td></tr>}
      </tbody></table>
    </section>}
  </>
}
