import {
  inferCategory,
  sumRowsByCategory,
  categoriesForGroup,
  rollupCategoryRows,
  categoryGroup
} from './CategoryEngine'

export function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  const negativeByParens = /^\s*\(.*\)\s*$/.test(raw)
  const negativeByCredit = /\b(credit|rebate|refund|return)\b/i.test(raw)
  const cleaned = raw.replace(/[$,%(),]/g, '').trim()
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return 0
  const valueAbs = Math.abs(n)
  return negativeByParens || negativeByCredit || n < 0 ? -valueAbs : valueAbs
}

export function invoiceType(row = {}) {
  const text = [row.invoice_type, row.status, row.notes, row.source_file, row.file_name, row.invoice_number, row.vendor_name, row.category]
    .map(value => String(value || '').toLowerCase())
    .join(' ')
  if (text.includes('rebate')) return 'Rebate'
  if (text.includes('credit memo') || text.includes('credit')) return 'Credit Memo'
  if (text.includes('return')) return 'Return Credit'
  if (text.includes('adjustment')) return 'Vendor Adjustment'
  return row.invoice_type || (num(row.total || row.amount) < 0 ? 'Credit Memo' : 'Regular Invoice')
}

export function signedInvoiceTotal(row = {}) {
  const amount = num(row.total || row.amount || row.invoice_total || row.grand_total)
  if (['Rebate', 'Credit Memo', 'Return Credit', 'Vendor Adjustment'].includes(invoiceType(row))) return -Math.abs(amount)
  return amount
}

export function rowDate(row, keys = []) {
  for (const key of keys) if (row?.[key]) return String(row[key]).slice(0, 10)
  return String(row?.business_date || row?.pay_date || row?.invoice_date || row?.date || row?.expense_date || row?.created_at || '').slice(0, 10)
}

export function invoiceTotal(row) {
  return signedInvoiceTotal(row)
}

export function itemUnit(row) {
  return num(row.unit_price || row.price || row.cost || row.item_price || row.rate)
}

export function itemAmount(row) {
  return num(row.line_total || row.total || row.amount || row.extended_price || (num(row.qty || row.quantity) * itemUnit(row)))
}


export function payrollClassification(row = {}) {
  const text = [row.payroll_classification, row.classification, row.pay_type, row.employee_type, row.job_type, row.group_name, row.employee_name]
    .map(value => String(value || '').toLowerCase())
    .join(' ')
  if (text.includes('customer tip') || text.includes('server tip') || text.includes('tips only') || text.includes('front house tip')) return 'Customer Tips'
  if (text.includes('server') || text.includes('waiter') || text.includes('waitress') || text.includes('front house') || text.includes('foh') || text.includes('bartender') || text.includes('tip')) return 'Customer Tips'
  return 'Operating Labor'
}

export function isCustomerTips(row = {}) {
  return payrollClassification(row) === 'Customer Tips'
}

export function isOperatingLabor(row = {}) {
  return !isCustomerTips(row)
}

export function rowTipsPaid(row = {}) {
  return Math.max(0, num(row.tips || row.tips_after_withheld || row.tips_after_withholding || row.final_tips) - num(row.tip_deduction || row.tips_withheld || row.tips_withholding))
}
export function payrollType(row) {
  return String(row.payment_method || row.payroll_type || row.type || row.pay_method || '').toLowerCase()
}

export function isCashPayroll(row) {
  return payrollType(row).includes('cash')
}

export function isCheckPayroll(row) {
  return payrollType(row).includes('check')
}

export function isDateInRange(dateText, start, end) {
  const d = String(dateText || '').slice(0, 10)
  if (!d) return false
  if (start && d < start) return false
  if (end && d > end) return false
  return true
}

export function isThisWeek(dateText) {
  if (!dateText) return false
  const d = new Date(dateText)
  if (Number.isNaN(d.getTime())) return false
  const n = new Date()
  const start = new Date(n)
  start.setDate(n.getDate() - n.getDay())
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return d >= start && d < end
}

export function rowsTotal(rows = []) {
  return rows.reduce((sum, row) => sum + num(row.amount), 0)
}

export function filterRowsByFinancialGroup(rows = [], group = 'all') {
  if (group === 'all') return rows
  return rows.filter(row => categoryGroup(row.category) === group)
}

function buildSpendRows({ invoices, invoiceItems, expenses, start, end, data }) {
  const invoiceById = Object.fromEntries((invoices || []).map(inv => [inv.id, inv]))
  const monthInvoices = (invoices || []).filter(row => isDateInRange(rowDate(row, ['invoice_date', 'date']), start, end))
  const monthInvoiceItems = (invoiceItems || []).filter(row => {
    const inv = invoiceById[row.invoice_id] || {}
    const itemDate = rowDate(row, ['invoice_date', 'date', 'created_at']) || rowDate(inv, ['invoice_date', 'date'])
    return isDateInRange(itemDate, start, end)
  })
  const monthExpenses = (expenses || []).filter(row => isDateInRange(rowDate(row, ['date', 'expense_date']), start, end))

  const invoicesWithLineItems = new Set(monthInvoiceItems.map(item => item.invoice_id).filter(Boolean))

  const invoiceItemCategorySpend = monthInvoiceItems.map(row => {
    const inv = invoiceById[row.invoice_id] || {}
    const vendorName = inv.vendor || inv.vendor_name || row.vendor || row.vendor_name
    return {
      ...row,
      source: 'Invoice Item',
      vendor: vendorName,
      vendor_name: vendorName,
      amount: ['Rebate', 'Credit Memo', 'Return Credit', 'Vendor Adjustment'].includes(invoiceType(inv)) ? -Math.abs(itemAmount(row)) : itemAmount(row),
      category: inferCategory({
        ...row,
        vendor: vendorName,
        vendor_name: vendorName,
        category: row.category || inv.category
      }, 'Other'),
      date: rowDate(row, ['invoice_date', 'date']) || rowDate(inv, ['invoice_date', 'date'])
    }
  }).filter(row => num(row.amount) !== 0)

  const invoiceHeaderCategorySpend = monthInvoices
    .filter(row => !invoicesWithLineItems.has(row.id))
    .map(row => ({
      ...row,
      source: ['Rebate', 'Credit Memo', 'Return Credit', 'Vendor Adjustment'].includes(invoiceType(row)) ? invoiceType(row) : 'Invoice',
      amount: invoiceTotal(row),
      category: inferCategory(row, 'Other'),
      date: rowDate(row, ['invoice_date', 'date'])
    }))
    .filter(row => num(row.amount) !== 0)

  const expenseCategorySpend = monthExpenses
    .map(row => ({
      ...row,
      source: 'Expense',
      amount: num(row.amount),
      category: inferCategory(row, 'Other'),
      date: rowDate(row, ['date', 'expense_date'])
    }))
    .filter(row => num(row.amount) > 0)

  return {
    monthInvoices,
    monthInvoiceItems,
    monthExpenses,
    spendRows: [...invoiceItemCategorySpend, ...invoiceHeaderCategorySpend, ...expenseCategorySpend]
  }
}

export function calculateBusinessMetrics(data = {}, range = {}) {
  const start = range.start || range.dateStart || ''
  const end = range.end || range.dateEnd || ''

  const salesDays = data.salesDays || []
  const payroll = data.payrollEntries || []
  const invoices = data.invoices || []
  const invoiceItems = data.invoiceItems || []
  const expenses = data.expenses || []

  const today = new Date().toISOString().slice(0, 10)
  const todaySales = salesDays.filter(row => row.business_date === today)
  const weekSales = salesDays.filter(row => isThisWeek(row.business_date))
  const rangeSales = salesDays.filter(row => isDateInRange(rowDate(row, ['business_date', 'date']), start, end))
  const rangePayroll = payroll.filter(row => isDateInRange(rowDate(row, ['pay_date', 'date']), start, end))

  const cashPayrollRows = rangePayroll.filter(isCashPayroll)
  const checkPayrollRows = rangePayroll.filter(isCheckPayroll)
  const operatingLaborRows = rangePayroll.filter(isOperatingLabor)
  const customerTipRows = rangePayroll.filter(isCustomerTips)

  const {
    monthInvoices,
    monthInvoiceItems,
    monthExpenses,
    spendRows
  } = buildSpendRows({ invoices, invoiceItems, expenses, start, end, data })

  const salesToday = todaySales.reduce((sum, row) => sum + num(row.net_sales), 0)
  const salesWeek = weekSales.reduce((sum, row) => sum + num(row.net_sales), 0)
  const salesRange = rangeSales.reduce((sum, row) => sum + num(row.net_sales), 0)
  const grossSales = rangeSales.reduce((sum, row) => sum + num(row.gross_sales || row.total_sales || row.net_sales), 0)
  const cashSales = rangeSales.reduce((sum, row) => sum + num(row.cash_sales), 0)
  const creditSales = rangeSales.reduce((sum, row) => sum + num(row.credit_sales), 0)
  const giftSales = rangeSales.reduce((sum, row) => sum + num(row.gift_card_sales), 0)
  const onlineSales = rangeSales.reduce((sum, row) => sum + num(row.online_orders), 0)
  const salesTax = rangeSales.reduce((sum, row) => sum + num(row.tax), 0)
  const tipsBeforeWithholding = rangeSales.reduce((sum, row) => sum + num(row.tips), 0)
  const tipsWithheld = rangeSales.reduce((sum, row) => sum + num(row.tips_withheld || row.tip_deduction || row.tips_withholding), 0)
  const tipsAfterWithholding = Math.max(0, tipsBeforeWithholding - tipsWithheld)
  const netSalesAfterTaxTips = salesRange - salesTax - tipsAfterWithholding

  const cashPayroll = cashPayrollRows.reduce((sum, row) => sum + num(row.total_pay || row.amount), 0)
  const checkPayroll = checkPayrollRows.reduce((sum, row) => sum + num(row.total_pay || row.amount), 0)
  const totalPayroll = rangePayroll.reduce((sum, row) => sum + num(row.total_pay || row.amount), 0)
  const operatingPayroll = operatingLaborRows.reduce((sum, row) => sum + num(row.total_pay || row.amount), 0)
  const customerTipsPaid = customerTipRows.reduce((sum, row) => sum + rowTipsPaid(row), 0)
  const customerTipsChecks = customerTipRows.filter(isCheckPayroll).reduce((sum, row) => sum + rowTipsPaid(row), 0)
  const payrollTipsWithheld = rangePayroll.reduce((sum, row) => sum + num(row.tip_deduction), 0)

  const invoiceSpend = monthInvoices.reduce((sum, row) => sum + invoiceTotal(row), 0)
  const expenseSpend = monthExpenses.reduce((sum, row) => sum + num(row.amount), 0)
  const totalExpensesAll = spendRows.reduce((sum, row) => sum + num(row.amount), 0)

  const categoryRows = sumRowsByCategory(spendRows, data || {})
  const vendorPurchaseRowsRaw = filterRowsByFinancialGroup(spendRows, 'vendor')
  const businessExpenseRowsRaw = filterRowsByFinancialGroup(spendRows, 'business')
  const vendorPurchaseCategoryRowsAll = sumRowsByCategory(vendorPurchaseRowsRaw, categoriesForGroup(data || {}, 'vendor'))
  const businessExpenseCategoryRowsAll = sumRowsByCategory(businessExpenseRowsRaw, categoriesForGroup(data || {}, 'business'))

  const vendorPurchaseCategoryRows = rollupCategoryRows(vendorPurchaseCategoryRowsAll, 'vendor', 8)
  const businessExpenseCategoryRows = rollupCategoryRows(businessExpenseCategoryRowsAll, 'business', 8)

  const vendorPurchaseSpend = rowsTotal(vendorPurchaseRowsRaw)
  const businessExpenseSpend = rowsTotal(businessExpenseRowsRaw)
  const foodSpend = categoryRows.find(row => row.category === 'Food')?.amount || 0

  const profit = salesRange - operatingPayroll - totalExpensesAll
  const foodCostPercent = salesRange > 0 ? (foodSpend / salesRange) * 100 : 0
  const laborPercent = salesRange > 0 ? (operatingPayroll / salesRange) * 100 : 0
  const primeCost = foodSpend + operatingPayroll
  const primeCostPercent = salesRange > 0 ? (primeCost / salesRange) * 100 : 0
  const cashOperatingPayroll = operatingLaborRows.filter(isCashPayroll).reduce((sum, row) => sum + num(row.total_pay || row.amount), 0)
  const cashSpend = spendRows.filter(row => String(row.payment_method || row.payment_type || '').toLowerCase().includes('cash')).reduce((sum, row) => sum + num(row.amount), 0)
  const cashRemaining = cashSales - cashOperatingPayroll - cashSpend

  const vendorPurchaseRecentRows = [...vendorPurchaseRowsRaw].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  const businessExpenseRecentRows = [...businessExpenseRowsRaw].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

  return {
    todaySales,
    weekSales,
    monthSales: rangeSales,
    rangeSales,
    monthPayroll: rangePayroll,
    rangePayroll,
    cashPayrollRows,
    checkPayrollRows,
    monthInvoices,
    monthExpenses,
    monthInvoiceItems,

    salesToday,
    salesWeek,
    salesMonth: salesRange,
    salesRange,
    grossSales,
    creditSales,
    giftSales,
    onlineSales,
    cashMonth: cashSales,
    cashSales,
    taxMonth: salesTax,
    salesTax,
    tipsMonth: tipsBeforeWithholding,
    tipsBeforeWithholding,
    tipsWithheldMonth: tipsWithheld,
    tipsWithheld,
    tipsAfterWithholdingMonth: tipsAfterWithholding,
    tipsAfterWithholding,
    trueNetSalesMonth: netSalesAfterTaxTips,
    netSalesAfterTaxTips,

    cashPayroll,
    checkPayroll,
    operatingPayroll,
    customerTipsPaid,
    customerTipsChecks,
    operatingLaborRows,
    customerTipRows,
    payrollMonth: totalPayroll,
    totalPayroll,
    payrollTipsWithheld,

    invoiceSpend,
    expenseSpend,
    vendorPurchaseSpend,
    businessExpenseSpend,
    foodSpend,
    foodCostPercent,
    laborPercent,
    primeCost,
    primeCostPercent,
    cashRemaining,
    totalExpensesAll,
    profit,

    categoryRows,
    vendorPurchaseCategoryRows,
    vendorPurchaseCategoryRowsAll,
    businessExpenseCategoryRows,
    businessExpenseCategoryRowsAll,
    vendorPurchaseRecentRows,
    businessExpenseRecentRows,
    expensesFromInvoiceCategories: spendRows
  }
}
