const n = value => Number(String(value ?? 0).replace(/[$,%(),]/g, '').replaceAll(',', '')) || 0
const text = value => String(value ?? '').trim().toLowerCase()

const categoryName = row => text(row?.category || row?.department || row?.type)
export const isAlcoholCategory = row => /alcohol|beer|wine|liquor|margarita|cocktail|shot/.test(categoryName(row))
export const isFoodCategory = row => /food|meat|seafood|produce|dairy|dry goods|frozen|bakery/.test(categoryName(row)) && !isAlcoholCategory(row)

const invoiceAmount = row => n(row?.amount ?? row?.total)
const lineAmount = row => n(row?.line_total ?? row?.amount ?? row?.total)

/**
 * Split invoice spend into food/alcohol/uncategorized while preserving each invoice total.
 * Line categories are preferred when present. Header category is the fallback.
 */
export function classifyInvoiceSpend(invoices = []) {
  let food = 0, alcohol = 0, uncategorized = 0
  let foodInvoiceCount = 0, alcoholInvoiceCount = 0

  for (const invoice of Array.isArray(invoices) ? invoices : []) {
    if (!invoice) continue
    const total = invoiceAmount(invoice)
    const lines = Array.isArray(invoice.lines) ? invoice.lines.filter(Boolean) : []
    const foodLines = lines.filter(isFoodCategory).reduce((sum, row) => sum + lineAmount(row), 0)
    const alcoholLines = lines.filter(isAlcoholCategory).reduce((sum, row) => sum + lineAmount(row), 0)
    const categorizedLines = foodLines + alcoholLines

    if (categorizedLines > 0) {
      // Preserve the invoice header total (tax/discount included) by allocating it
      // proportionally to the categorized line mix.
      const scale = total > 0 ? total / categorizedLines : 1
      if (foodLines > 0) { food += foodLines * scale; foodInvoiceCount += 1 }
      if (alcoholLines > 0) { alcohol += alcoholLines * scale; alcoholInvoiceCount += 1 }
      continue
    }

    if (isAlcoholCategory(invoice)) { alcohol += total; alcoholInvoiceCount += 1 }
    else if (isFoodCategory(invoice)) { food += total; foodInvoiceCount += 1 }
    else uncategorized += total
  }

  return { food:Number(food.toFixed(2)), alcohol:Number(alcohol.toFixed(2)), uncategorized:Number(uncategorized.toFixed(2)), foodInvoiceCount, alcoholInvoiceCount }
}

export function buildFinancialMetrics({ sales = [], payrollSummary = {}, primeCostLabor = null, invoices = [], expenses = [] } = {}) {
  const salesTotal = sales.reduce((sum, row) => sum + n(row?.net_sales ?? row?.amount ?? row?.sales), 0)
  const foodSales = sales.reduce((sum, row) => sum + n(row?.food_sales ?? (isFoodCategory(row) ? (row?.amount ?? row?.net_sales ?? row?.sales) : 0)), 0)
  const alcoholSales = sales.reduce((sum, row) => sum + n(row?.alcohol_sales ?? (isAlcoholCategory(row) ? (row?.amount ?? row?.net_sales ?? row?.sales) : 0)), 0)
  const explicitOtherSales = sales.reduce((sum, row) => sum + n(row?.other_sales), 0)
  const otherSales = explicitOtherSales || Math.max(0, salesTotal - foodSales - alcoholSales)
  const tips = sales.reduce((sum, row) => sum + n(row?.tips_collected ?? row?.tips), 0)
  const cashSales = sales.reduce((sum, row) => sum + n(row?.cash_sales ?? (text(row?.payment || row?.payment_type) === 'cash' ? (row?.amount ?? row?.net_sales ?? row?.sales) : 0)), 0)
  const creditSales = sales.reduce((sum, row) => sum + n(row?.credit_sales ?? (/credit|card/.test(text(row?.payment || row?.payment_type)) ? (row?.amount ?? row?.net_sales ?? row?.sales) : 0)), 0)

  const invoiceSplit = classifyInvoiceSpend(invoices)
  const invoiceTotal = invoices.reduce((sum, row) => sum + invoiceAmount(row), 0)
  const expenseText = row => [row?.category,row?.type,row?.expense_type,row?.name,row?.vendor,row?.payee,row?.notes].map(value=>text(value)).join(' ')
  const isCashWithdrawal = row => /cash withdrawal|owner withdrawal|cash draw/.test(expenseText(row))
  const isPayrollOrTipExpense = row => /(^|\b)(payroll|employee payroll|wages?|salary|labor|tips?|gratuity)(\b|$)/.test(expenseText(row)) && !/payroll tax/.test(expenseText(row))
  const isFoodAlcoholExpense = row => isFoodCategory(row) || isAlcoholCategory(row) || /food cost|food purchase|inventory food|alcohol cost|alcohol purchase|beer purchase|wine purchase|liquor purchase/.test(expenseText(row))
  const withdrawalRows = expenses.filter(isCashWithdrawal)
  const excludedFoodAlcoholExpenses = expenses.filter(row => !isCashWithdrawal(row) && isFoodAlcoholExpense(row))
  const excludedPayrollTipExpenses = expenses.filter(row => !isCashWithdrawal(row) && !isFoodAlcoholExpense(row) && isPayrollOrTipExpense(row))
  // Restaurant P&L rule: Operating Expenses must contain only costs not already
  // represented by Food/Alcohol COGS or Employee Payroll. This prevents the same
  // transaction from reducing Operating Profit twice. Payroll tax remains an
  // operating expense because it is an employer tax, not employee wage payroll.
  const operatingExpenses = expenses.filter(row => !isCashWithdrawal(row) && !isFoodAlcoholExpense(row) && !isPayrollOrTipExpense(row))
  const cashWithdrawals = withdrawalRows.reduce((sum, row) => sum + n(row?.amount ?? row?.total), 0)
  const expenseTotal = operatingExpenses.reduce((sum, row) => sum + n(row?.amount ?? row?.total), 0)
  const cashExpenses = operatingExpenses.filter(row => text(row?.method || row?.payment_type) === 'cash')
    .reduce((sum, row) => sum + n(row?.amount ?? row?.total), 0)
  const cashInvoiceSpend = invoices.filter(row => text(row?.payment_type || row?.method) === 'cash')
    .reduce((sum, row) => sum + invoiceAmount(row), 0)

  const payrollTotal = n(payrollSummary.total)
  const operatingLabor = payrollSummary.operatingLabor === undefined ? payrollTotal : n(payrollSummary.operatingLabor)
  const managementPayroll = n(payrollSummary.managementPayroll)
  const frontOfHousePayroll = n(payrollSummary.frontOfHousePayroll)
  const reviewPayroll = n(payrollSummary.reviewPayroll)
  const employerLabor = payrollSummary.managementPayroll === undefined && payrollSummary.frontOfHousePayroll === undefined && payrollSummary.reviewPayroll === undefined
    ? payrollTotal
    : operatingLabor + managementPayroll + frontOfHousePayroll + reviewPayroll
  const tipsEarned = n(payrollSummary.tipsEarned)
  const tipsWithheld = n(payrollSummary.tipsWithheld)
  const netTipsPaid = n(payrollSummary.netTipsPaid)
  const cashPayroll = n(payrollSummary.cash)
  const checkPayroll = n(payrollSummary.check)
  const payrollHours = n(payrollSummary.hours)
  const cogs = invoiceSplit.food + invoiceSplit.alcohol
  // Prime Cost may use daily allocated labor for exact partial-week date ranges.
  // Official payroll/payment totals remain unchanged.
  const primeOperatingLabor = primeCostLabor ? n(primeCostLabor.operatingLabor) : operatingLabor
  const primeManagementPayroll = primeCostLabor ? n(primeCostLabor.managementPayroll) : managementPayroll
  const primeLabor = primeOperatingLabor + primeManagementPayroll
  const primeCostAmount = cogs + primeLabor
  const cashRemaining = cashSales - cashPayroll - cashExpenses - cashInvoiceSpend - cashWithdrawals
  const operatingProfit = salesTotal - cogs - employerLabor - expenseTotal
  const percent = (value, base) => base > 0 ? (value / base) * 100 : 0

  const salesCategoryVariance = salesTotal - (foodSales + alcoholSales + otherSales)
  const cashEquationVariance = cashRemaining - (cashSales - cashPayroll - cashExpenses - cashInvoiceSpend - cashWithdrawals)
  const profitEquationVariance = operatingProfit - (salesTotal - cogs - employerLabor - expenseTotal)

  return {
    salesTotal, foodSales, alcoholSales, otherSales, tips, cashSales, creditSales,
    foodCost: invoiceSplit.food, alcoholCost: invoiceSplit.alcohol, uncategorizedInvoiceCost: invoiceSplit.uncategorized,
    invoiceTotal, expenseTotal, operatingExpenses, excludedFoodAlcoholExpenses, excludedPayrollTipExpenses, cashExpenses, cashInvoiceSpend, cashWithdrawals, withdrawalRows,
    payrollTotal, operatingLabor, managementPayroll, frontOfHousePayroll, reviewPayroll, employerLabor, tipsEarned, tipsWithheld, netTipsPaid, cashPayroll, checkPayroll, payrollHours,
    cashRemaining, cogs, primeLabor, primeOperatingLabor, primeManagementPayroll, primeCostAmount, operatingProfit,
    foodCostPercent: percent(invoiceSplit.food, foodSales),
    alcoholCostPercent: percent(invoiceSplit.alcohol, alcoholSales),
    primeCostPercent: percent(primeCostAmount, salesTotal),
    laborMixPercent: percent(primeLabor, salesTotal),
    operatingMargin: percent(operatingProfit, salesTotal),
    foodInvoiceCount: invoiceSplit.foodInvoiceCount,
    alcoholInvoiceCount: invoiceSplit.alcoholInvoiceCount,
    reconciliation: {
      salesCategoryVariance,
      cashEquationVariance,
      profitEquationVariance,
      balanced: [salesCategoryVariance, cashEquationVariance, profitEquationVariance].every(value => Math.abs(value) < 0.01),
    },
  }
}
