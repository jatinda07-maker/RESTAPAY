const DEFAULT_RULES = {
  managerPayroll: { food: 50, alcohol: 50 },
  kitchenPayroll: { food: 100, alcohol: 0 },
  bartenderPayroll: { food: 0, alcohol: 100 },
  supplies: { food: 100, alcohol: 0 },
  cleaningSupplies: { food: 50, alcohol: 50 },
  cintas: { food: 50, alcohol: 50 },
  utilities: { food: 50, alcohol: 50 },
  insurance: { food: 50, alcohol: 50 }
}

export function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  const negative = /^\s*\(.*\)\s*$/.test(raw) || /\b(credit|rebate|refund|return)\b/i.test(raw) || raw.startsWith('-')
  const parsed = Number(raw.replace(/[$,%(),]/g, '').trim())
  if (!Number.isFinite(parsed)) return 0
  return negative ? -Math.abs(parsed) : parsed
}

export function allocationRules(settings = {}) {
  const custom = settings.departmentAllocations || {}
  return Object.fromEntries(Object.entries(DEFAULT_RULES).map(([key, defaults]) => [key, {
    food: Number(custom[key]?.food ?? defaults.food),
    alcohol: Number(custom[key]?.alcohol ?? defaults.alcohol)
  }]))
}

function textOf(row = {}) {
  return [row.category, row.expense_category, row.vendor, row.vendor_name, row.name, row.description, row.item_name, row.notes, row.source]
    .map(value => String(value || '').toLowerCase()).join(' ')
}

function payrollText(row = {}) {
  return [row.payroll_classification, row.classification, row.employee_type, row.job_type, row.group_name, row.employee_name, row.name]
    .map(value => String(value || '').toLowerCase()).join(' ')
}

function isTips(row = {}) {
  const text = payrollText(row)
  return /customer tip|server tip|tips only|front house tip|waiter|waitress|server|foh/.test(text)
}

function payrollAmount(row = {}) { return num(row.total_pay || row.total || row.amount || row.regular_pay) }

export function classifySpend(row = {}) {
  const text = textOf(row)
  if (/margarita\s*(mix|base)|sweet\s*&?\s*sour|sour mix/.test(text)) return { bucket: 'alcohol', rule: 'margaritaMix', label: 'Margarita Mix' }
  if (/beer|lager|ale|ipa|modelo|corona|bud light|michelob|coors|miller|dos equis/.test(text)) return { bucket: 'alcohol', rule: 'beer', label: 'Beer' }
  if (/liquor|tequila|vodka|rum|whiskey|bourbon|gin|wine|abc store|texana/.test(text)) return { bucket: 'alcohol', rule: 'liquor', label: 'Liquor / Wine' }
  if (/cintas/.test(text)) return { bucket: 'shared', rule: 'cintas', label: 'Cintas' }
  if (/clean|chemical|sanitizer|soap|detergent|janitorial/.test(text)) return { bucket: 'shared', rule: 'cleaningSupplies', label: 'Cleaning Supplies' }
  if (/suppl|paper|foil|film|glove|container|to-go|takeout|straw|napkin/.test(text)) return { bucket: 'food', rule: 'supplies', label: 'Kitchen / Restaurant Supplies' }
  if (/util|electric|power|water|natural gas|sewer/.test(text)) return { bucket: 'shared', rule: 'utilities', label: 'Utilities' }
  if (/insurance/.test(text)) return { bucket: 'shared', rule: 'insurance', label: 'Insurance' }
  if (/food|meat|produce|grocery|chicken|beef|fish|shrimp|cheese|tortilla|rice|bean|us foods/.test(text)) return { bucket: 'food', rule: 'foodPurchases', label: 'Food Purchases' }
  if (/beverage|soda|coke|sprite|tea|lemonade|buffalo rock|mixer/.test(text)) return { bucket: 'other', rule: 'nonAlcoholBeverage', label: 'Non-alcohol Beverage' }
  return { bucket: 'other', rule: 'other', label: 'Other' }
}

export function classifyPayroll(row = {}) {
  const text = payrollText(row)
  if (isTips(row)) return { bucket: 'excluded', rule: 'tips', label: 'Server Tips' }
  if (/manager|management/.test(text)) return { bucket: 'shared', rule: 'managerPayroll', label: 'Manager Payroll' }
  if (/bartender|barback|bar manager/.test(text)) return { bucket: 'alcohol', rule: 'bartenderPayroll', label: 'Bar Payroll' }
  if (/kitchen|cook|chef|prep|dishwasher|dish washer|line cook|food prep/.test(text)) return { bucket: 'food', rule: 'kitchenPayroll', label: 'Kitchen Payroll' }
  return { bucket: 'other', rule: 'otherPayroll', label: 'Other Operating Payroll' }
}

function allocate(amount, rule, rules) {
  const config = rules[rule] || { food: 0, alcohol: 0 }
  return {
    food: amount * (Number(config.food || 0) / 100),
    alcohol: amount * (Number(config.alcohol || 0) / 100)
  }
}

function rowSales(row = {}, keys = []) {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== '') return num(row[key])
  return 0
}


const ALCOHOL_MENU_PATTERN = /beer|lager|ale|ipa|draft|draught|cerveza|modelo|corona|michelob|bud(?:weiser| light)?|dos equis|pacifico|tecate|coors|miller|negra modelo|liquor|alcohol|tequila|mezcal|vodka|rum|whiskey|whisky|bourbon|scotch|gin|brandy|cognac|wine|sangria|champagne|prosecco|shot|shooter|margarita|marg(?:arita)?\b|cocktail|martini|mojito|paloma|daiquiri|old fashioned|mule|bloody mary|long island|pi[ñn]a colada|mixed drink|well drink|house drink|premium drink/i
const NON_ALCOHOL_PATTERN = /virgin|mocktail|non[- ]?alcohol|alcohol[- ]?free|kids? drink|soft drink|soda|tea|coffee|lemonade|water|juice|coke|sprite|pepsi|dr pepper/i

export function classifyMenuSale(item = {}) {
  const category = String(item.category || item.menu_category || item.sales_category || item.type || '').toLowerCase()
  const name = String(item.name || item.item_name || item.description || item.menu_item || '').toLowerCase()
  const text = `${category} ${name}`
  if (NON_ALCOHOL_PATTERN.test(text) && !/margarita|cocktail|beer|wine|liquor|shot|tequila|vodka|rum|whiskey|mezcal/.test(text)) return 'other'
  if (/beer|liquor|wine|alcohol|bar|cocktail|margarita|spirits?/.test(category) || ALCOHOL_MENU_PATTERN.test(text)) return 'alcohol'
  return 'food'
}

function menuSalesAmount(item = {}) {
  return num(item.netSales ?? item.net_sales ?? item.grossSales ?? item.gross_sales ?? item.sales ?? item.amount)
}

export function calculateDepartmentCosts({ salesRows = [], payrollRows = [], spendRows = [], menuItems = [], settings = {} } = {}) {
  const rules = allocationRules(settings)
  const totals = {
    foodPurchases: 0, alcoholPurchases: 0, beerPurchases: 0, liquorPurchases: 0, margaritaMix: 0,
    foodSupplies: 0, foodShared: 0, alcoholShared: 0, kitchenPayroll: 0, managerPayroll: 0,
    managerFood: 0, managerAlcohol: 0, barPayroll: 0, otherPayroll: 0, otherSpend: 0, excludedTips: 0
  }
  const spendDetails = { food: [], beer: [], liquor: [], margaritaMix: [], sharedFood: [], sharedAlcohol: [], other: [] }
  const payrollDetails = { kitchen: [], manager: [], bar: [], other: [], tips: [] }

  spendRows.forEach(row => {
    const amount = num(row.amount || row.total || row.line_total)
    const cls = classifySpend(row)
    const detailRow = { ...row, amount, costLabel: cls.label, costRule: cls.rule }
    if (cls.rule === 'foodPurchases') { totals.foodPurchases += amount; spendDetails.food.push(detailRow) }
    else if (cls.rule === 'beer') { totals.alcoholPurchases += amount; totals.beerPurchases += amount; spendDetails.beer.push(detailRow) }
    else if (cls.rule === 'liquor') { totals.alcoholPurchases += amount; totals.liquorPurchases += amount; spendDetails.liquor.push(detailRow) }
    else if (cls.rule === 'margaritaMix') { totals.alcoholPurchases += amount; totals.margaritaMix += amount; spendDetails.margaritaMix.push(detailRow) }
    else if (cls.rule === 'supplies') {
      const a = allocate(amount, 'supplies', rules); totals.foodSupplies += a.food; totals.alcoholShared += a.alcohol
      if (a.food) spendDetails.sharedFood.push({ ...detailRow, allocatedAmount: a.food })
      if (a.alcohol) spendDetails.sharedAlcohol.push({ ...detailRow, allocatedAmount: a.alcohol })
    }
    else if (cls.bucket === 'shared') {
      const a = allocate(amount, cls.rule, rules); totals.foodShared += a.food; totals.alcoholShared += a.alcohol
      if (a.food) spendDetails.sharedFood.push({ ...detailRow, allocatedAmount: a.food })
      if (a.alcohol) spendDetails.sharedAlcohol.push({ ...detailRow, allocatedAmount: a.alcohol })
    }
    else { totals.otherSpend += amount; spendDetails.other.push(detailRow) }
  })

  payrollRows.forEach(row => {
    const amount = payrollAmount(row)
    const cls = classifyPayroll(row)
    const detailRow = { ...row, amount, payrollLabel: cls.label }
    if (cls.rule === 'tips') { totals.excludedTips += amount; payrollDetails.tips.push(detailRow) }
    else if (cls.rule === 'kitchenPayroll') { totals.kitchenPayroll += amount; payrollDetails.kitchen.push(detailRow) }
    else if (cls.rule === 'bartenderPayroll') { totals.barPayroll += amount; payrollDetails.bar.push(detailRow) }
    else if (cls.rule === 'managerPayroll') {
      totals.managerPayroll += amount
      const a = allocate(amount, 'managerPayroll', rules)
      totals.managerFood += a.food
      totals.managerAlcohol += a.alcohol
      payrollDetails.manager.push({ ...detailRow, foodAllocated: a.food, alcoholAllocated: a.alcohol })
    } else { totals.otherPayroll += amount; payrollDetails.other.push(detailRow) }
  })

  let foodSales = salesRows.reduce((sum, row) => sum + rowSales(row, ['food_sales', 'foodSales', 'restaurant_food_sales']), 0)
  let alcoholSales = salesRows.reduce((sum, row) => sum +
    rowSales(row, ['alcohol_sales', 'alcoholSales', 'bar_sales']) +
    rowSales(row, ['beer_sales', 'beerSales']) +
    rowSales(row, ['liquor_sales', 'liquorSales', 'spirits_sales']) +
    rowSales(row, ['wine_sales', 'wineSales']) +
    rowSales(row, ['cocktail_sales', 'cocktailSales', 'margarita_sales']), 0)
  const netSales = salesRows.reduce((sum, row) => sum + rowSales(row, ['net_sales', 'netSales', 'total_sales']), 0)

  const menuSalesRows = menuItems.map(item => ({
    ...item,
    department: classifyMenuSale(item),
    salesAmount: menuSalesAmount(item)
  })).filter(item => item.salesAmount !== 0)
  const alcoholSalesRows = menuSalesRows.filter(item => item.department === 'alcohol')
  const foodSalesRows = menuSalesRows.filter(item => item.department === 'food')
  const menuAlcoholSales = alcoholSalesRows.reduce((sum, item) => sum + item.salesAmount, 0)
  const menuFoodSales = foodSalesRows.reduce((sum, item) => sum + item.salesAmount, 0)

  // Product Mix is the most accurate source for department sales because it
  // identifies margaritas, cocktails, shots, beer, wine and liquor by item name.
  if (menuAlcoholSales > 0) alcoholSales = menuAlcoholSales
  if (menuFoodSales > 0) foodSales = menuFoodSales

  // Some Toast summaries put all net sales into food_sales while omitting bar sales.
  // When Product Mix found alcohol, remove it from that catch-all food figure.
  if (netSales > 0 && alcoholSales > 0 && (!menuFoodSales || foodSales >= netSales * 0.95)) {
    foodSales = Math.max(0, netSales - alcoholSales)
  }

  if (!foodSales && !alcoholSales && netSales > 0) {
    const alcoholShare = Number(settings.defaultAlcoholSalesPercent ?? 25) / 100
    alcoholSales = netSales * alcoholShare
    foodSales = netSales - alcoholSales
  }

  const trueFoodCost = totals.foodPurchases + totals.kitchenPayroll + totals.managerFood + totals.foodSupplies + totals.foodShared
  const trueAlcoholCost = totals.alcoholPurchases + totals.barPayroll + totals.managerAlcohol + totals.alcoholShared
  const foodProfit = foodSales - trueFoodCost
  const alcoholProfit = alcoholSales - trueAlcoholCost
  const allocatedCost = trueFoodCost + trueAlcoholCost
  const overallOperatingProfit = netSales - allocatedCost - totals.otherPayroll - totals.otherSpend

  return {
    ...totals,
    foodSales,
    alcoholSales,
    netSales,
    trueFoodCost,
    trueAlcoholCost,
    foodCostPercent: foodSales > 0 ? trueFoodCost / foodSales * 100 : 0,
    alcoholCostPercent: alcoholSales > 0 ? trueAlcoholCost / alcoholSales * 100 : 0,
    foodProfit,
    alcoholProfit,
    foodProfitMargin: foodSales > 0 ? foodProfit / foodSales * 100 : 0,
    alcoholProfitMargin: alcoholSales > 0 ? alcoholProfit / alcoholSales * 100 : 0,
    allocatedCost,
    overallOperatingProfit,
    overallProfitMargin: netSales > 0 ? overallOperatingProfit / netSales * 100 : 0,
    foodSalesRows,
    alcoholSalesRows,
    spendDetails,
    payrollDetails,
    rules
  }
}

export const DEFAULT_ALLOCATION_RULES = DEFAULT_RULES
