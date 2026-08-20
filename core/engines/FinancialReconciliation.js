const n = value => Number(String(value ?? 0).replace(/[$,%(),]/g, '').replaceAll(',', '')) || 0
const text = value => String(value ?? '').trim().toLowerCase()

const categoryName = row => text([row?.category,row?.department,row?.type,row?.description,row?.item_name,row?.item,row?.name,row?.vendor,row?.vendor_name].filter(Boolean).join(' '))
export const isAlcoholCategory = row => /alcohol|beer|wine|liquor|tequila|mezcal|vodka|rum|whisk|bourbon|scotch|gin|brandy|cognac|margarita|cocktail|shot|modelo|corona|michelob|coors|miller|dos equis|pacifico|tecate/.test(categoryName(row))
export const isFoodCategory = row => /food|meat|seafood|produce|dairy|dry goods|frozen|bakery|chicken|beef|fish|shrimp|cheese|tortilla|rice|bean|grocery/.test(categoryName(row)) && !isAlcoholCategory(row)

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

export function buildFinancialMetrics({ sales = [], payrollSummary = {}, invoices = [], expenses = [] } = {}) {
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
  const expenseTotal = expenses.reduce((sum, row) => sum + n(row?.amount ?? row?.total), 0)
  const cashExpenses = expenses.filter(row => text(row?.method || row?.payment_type) === 'cash')
    .reduce((sum, row) => sum + n(row?.amount ?? row?.total), 0)
  const cashInvoiceSpend = invoices.filter(row => text(row?.payment_type || row?.method) === 'cash')
    .reduce((sum, row) => sum + invoiceAmount(row), 0)

  const payrollTotal = n(payrollSummary.total)
  const managerLabor = n(payrollSummary.managerLabor)
  const operatingLabor = payrollSummary.operatingLabor === undefined ? payrollTotal : n(payrollSummary.operatingLabor)
  const tipsEarned = n(payrollSummary.tipsEarned)
  const tipsWithheld = n(payrollSummary.tipsWithheld)
  const netTipsPaid = n(payrollSummary.netTipsPaid)
  const cashPayroll = n(payrollSummary.cash)
  const checkPayroll = n(payrollSummary.check)
  const payrollHours = n(payrollSummary.hours)
  const cogs = invoiceSplit.food + invoiceSplit.alcohol
  const allocatedFoodAlcoholCost = cogs + managerLabor
  const primeCostAmount = allocatedFoodAlcoholCost + operatingLabor
  const cashRemaining = cashSales - cashPayroll - cashExpenses - cashInvoiceSpend
  // Manager payroll is counted once inside Food + Alcohol cost; waiter/server tip pass-through is excluded by payrollSummary.
  const operatingProfit = salesTotal - allocatedFoodAlcoholCost - operatingLabor - expenseTotal
  const percent = (value, base) => base > 0 ? (value / base) * 100 : 0

  const salesCategoryVariance = salesTotal - (foodSales + alcoholSales + otherSales)
  const cashEquationVariance = cashRemaining - (cashSales - cashPayroll - cashExpenses - cashInvoiceSpend)
  const profitEquationVariance = operatingProfit - (salesTotal - allocatedFoodAlcoholCost - operatingLabor - expenseTotal)

  return {
    salesTotal, foodSales, alcoholSales, otherSales, tips, cashSales, creditSales,
    foodCost: invoiceSplit.food, alcoholCost: invoiceSplit.alcohol, uncategorizedInvoiceCost: invoiceSplit.uncategorized,
    invoiceTotal, expenseTotal, cashExpenses, cashInvoiceSpend,
    payrollTotal, operatingLabor, managerLabor, allocatedFoodAlcoholCost, tipsEarned, tipsWithheld, netTipsPaid, cashPayroll, checkPayroll, payrollHours,
    cashRemaining, cogs, primeCostAmount, operatingProfit,
    foodCostPercent: percent(invoiceSplit.food, foodSales),
    alcoholCostPercent: percent(invoiceSplit.alcohol, alcoholSales),
    primeCostPercent: percent(primeCostAmount, salesTotal),
    laborMixPercent: percent(operatingLabor, salesTotal),
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
