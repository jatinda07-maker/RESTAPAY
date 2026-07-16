import { num, rowDate, isDateInRange, isCustomerTips } from './BusinessEngine'

export const DEFAULT_ALLOCATION_RULES = {
  managerFoodPercent: 50,
  cleaningFoodPercent: 50,
  utilitiesFoodPercent: 50,
  rentFoodPercent: 50,
  insuranceFoodPercent: 50,
  accountingFoodPercent: 50,
  maintenanceFoodPercent: 50,
  sharedFoodPercent: 50
}

function textOf(row = {}) {
  return [
    row.category, row.expense_category, row.invoice_category, row.vendor, row.vendor_name,
    row.description, row.item_name, row.name, row.item, row.notes, row.job_type,
    row.employee_type, row.employee_name, row.group_name, row.pay_type
  ].map(value => String(value || '').toLowerCase()).join(' ')
}

function clampPercent(value, fallback = 50) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : fallback
}

export function allocationRules(settings = {}) {
  const stored = settings.financialAllocationRules || {}
  return Object.fromEntries(Object.entries(DEFAULT_ALLOCATION_RULES).map(([key, fallback]) => [key, clampPercent(stored[key], fallback)]))
}

export function classifySpendProfitCenter(row = {}) {
  const text = textOf(row)

  if (/margarita mix|sweet.?sour|sour mix|cocktail mix|bloody mary mix|bar syrup|grenadine/.test(text)) {
    return { center: 'alcohol', reason: 'Bar or cocktail mix' }
  }
  if (/beer|liquor|wine|tequila|vodka|whiskey|whisky|bourbon|rum|gin|mezcal|abc store|texana/.test(text)) {
    return { center: 'alcohol', reason: 'Alcohol product or vendor' }
  }
  if (/clean|sanitiz|chemical|detergent|dishwash|bleach|janitor/.test(text)) {
    return { center: 'shared-cleaning', reason: 'Cleaning supplies' }
  }
  if (/utilit|electric|power|natural gas|water|sewer|internet|trash|waste/.test(text)) {
    return { center: 'shared-utilities', reason: 'Utilities' }
  }
  if (/rent|lease/.test(text)) return { center: 'shared-rent', reason: 'Rent or lease' }
  if (/insurance/.test(text)) return { center: 'shared-insurance', reason: 'Insurance' }
  if (/accounting|bookkeep|payroll service/.test(text)) return { center: 'shared-accounting', reason: 'Accounting' }
  if (/repair|maintenance|service call/.test(text)) return { center: 'shared-maintenance', reason: 'Repairs or maintenance' }
  if (/food|meat|produce|grocery|chicken|beef|pork|seafood|fish|cheese|dairy|tortilla|rice|bean|vegetable|frozen|dry goods|kitchen/.test(text)) {
    return { center: 'food', reason: 'Food or kitchen item' }
  }
  return { center: 'shared', reason: 'Unclassified shared cost' }
}

export function classifyLaborProfitCenter(row = {}) {
  if (isCustomerTips(row)) return { center: 'excluded-tips', reason: 'Customer-paid pass-through tips' }
  const text = textOf(row)
  if (/manager|management|general manager|gm\b/.test(text)) return { center: 'shared-manager', reason: 'Manager payroll' }
  if (/bartender|barback|bar manager/.test(text)) return { center: 'alcohol', reason: 'Bar labor' }
  if (/kitchen|cook|chef|prep|dishwasher|dish washer|line cook/.test(text)) return { center: 'food', reason: 'Kitchen labor' }
  return { center: 'shared', reason: 'Unclassified operating labor' }
}

function splitAmount(amount, foodPercent) {
  const food = amount * (foodPercent / 100)
  return { food, alcohol: amount - food }
}

function addAllocated(target, row, amount, classification, rules) {
  const base = { ...row, amount, allocation_reason: classification.reason }
  if (classification.center === 'food') {
    target.food.push({ ...base, allocated_amount: amount, profit_center: 'Food' })
    return
  }
  if (classification.center === 'alcohol') {
    target.alcohol.push({ ...base, allocated_amount: amount, profit_center: 'Alcohol' })
    return
  }
  if (classification.center === 'excluded-tips') {
    target.excludedTips.push({ ...base, allocated_amount: amount, profit_center: 'Excluded Tips' })
    return
  }
  const map = {
    'shared-manager': rules.managerFoodPercent,
    'shared-cleaning': rules.cleaningFoodPercent,
    'shared-utilities': rules.utilitiesFoodPercent,
    'shared-rent': rules.rentFoodPercent,
    'shared-insurance': rules.insuranceFoodPercent,
    'shared-accounting': rules.accountingFoodPercent,
    'shared-maintenance': rules.maintenanceFoodPercent,
    shared: rules.sharedFoodPercent
  }
  const split = splitAmount(amount, map[classification.center] ?? rules.sharedFoodPercent)
  target.food.push({ ...base, allocated_amount: split.food, profit_center: 'Food' })
  target.alcohol.push({ ...base, allocated_amount: split.alcohol, profit_center: 'Alcohol' })
}

function salesBreakdown(rows = [], menuItems = [], start = '', end = '') {
  const inRange = row => isDateInRange(rowDate(row, ['business_date', 'date']), start, end)
  const selected = rows.filter(inRange)
  const explicitFood = selected.reduce((sum, row) => sum + num(row.food_sales || row.food_net_sales || row.net_food_sales), 0)
  const explicitAlcohol = selected.reduce((sum, row) => sum + num(row.alcohol_sales || row.alcohol_net_sales || row.net_alcohol_sales || row.beer_sales || row.liquor_sales || row.wine_sales), 0)
  const totalNet = selected.reduce((sum, row) => sum + num(row.net_sales), 0)

  if (explicitFood || explicitAlcohol) {
    return { foodSales: explicitFood, alcoholSales: explicitAlcohol, unallocatedSales: Math.max(0, totalNet - explicitFood - explicitAlcohol), source: 'Toast category totals' }
  }

  let foodSales = 0
  let alcoholSales = 0
  for (const item of menuItems || []) {
    const amount = num(item.net_sales || item.net_amount || item.gross_sales || item.gross_amount || item.total || item.avg_price * item.qty_sold)
    if (!amount) continue
    const center = classifySpendProfitCenter(item).center
    if (center === 'alcohol') alcoholSales += amount
    else foodSales += amount
  }
  const menuTotal = foodSales + alcoholSales
  if (menuTotal > 0) {
    const scale = totalNet > 0 ? totalNet / menuTotal : 1
    return { foodSales: foodSales * scale, alcoholSales: alcoholSales * scale, unallocatedSales: 0, source: 'Product Mix allocation' }
  }

  return { foodSales: 0, alcoholSales: 0, unallocatedSales: totalNet, source: 'Awaiting Toast category or Product Mix data' }
}

export function calculateProfitCenters({ salesRows = [], payrollRows = [], spendRows = [], menuItems = [], settings = {}, start = '', end = '' } = {}) {
  const rules = allocationRules(settings)
  const allocated = { food: [], alcohol: [], excludedTips: [] }

  for (const row of payrollRows) {
    const amount = num(row.total_pay || row.total || row.amount || row.regular_pay)
    if (!amount) continue
    addAllocated(allocated, { ...row, source: 'Payroll' }, amount, classifyLaborProfitCenter(row), rules)
  }
  for (const row of spendRows) {
    const amount = num(row.amount)
    if (!amount) continue
    addAllocated(allocated, row, amount, classifySpendProfitCenter(row), rules)
  }

  const sales = salesBreakdown(salesRows, menuItems, start, end)
  const foodCosts = allocated.food.reduce((sum, row) => sum + num(row.allocated_amount), 0)
  const alcoholCosts = allocated.alcohol.reduce((sum, row) => sum + num(row.allocated_amount), 0)
  const tipsExcluded = allocated.excludedTips.reduce((sum, row) => sum + num(row.allocated_amount), 0)
  const foodProfit = sales.foodSales - foodCosts
  const alcoholProfit = sales.alcoholSales - alcoholCosts

  return {
    rules,
    ...sales,
    foodCosts,
    alcoholCosts,
    tipsExcluded,
    foodProfit,
    alcoholProfit,
    foodMargin: sales.foodSales > 0 ? (foodProfit / sales.foodSales) * 100 : 0,
    alcoholMargin: sales.alcoholSales > 0 ? (alcoholProfit / sales.alcoholSales) * 100 : 0,
    allocatedFoodRows: allocated.food,
    allocatedAlcoholRows: allocated.alcohol,
    excludedTipRows: allocated.excludedTips
  }
}
