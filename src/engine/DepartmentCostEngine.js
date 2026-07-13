const DEFAULT_RULES = {
  managerPayroll: { food: 50, alcohol: 50 },
  kitchenPayroll: { food: 100, alcohol: 0 },
  bartenderPayroll: { food: 0, alcohol: 100 },
  supplies: { food: 50, alcohol: 50 },
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
  return [row.category, row.expense_category, row.invoice_category, row.vendor, row.vendor_name, row.name, row.description, row.item_name, row.item, row.sku, row.product_code, row.notes, row.source]
    .map(value => String(value || '').toLowerCase()).join(' ')
}

function vendorTextOf(row = {}) {
  return [row.vendor, row.vendor_name, row.payee, row.name]
    .map(value => String(value || '').toLowerCase()).join(' ')
}

function isGovernmentOrTaxSpend(row = {}) {
  const vendor = vendorTextOf(row)
  const text = textOf(row)
  return /\bal[- ]?(?:dept|department)\s+of\s+rev(?:enue)?\b|\balabama\s+department\s+of\s+revenue\b|\bal[- ]?onespot\b|\bone\s*spot\b/.test(vendor) ||
    /\b(sales tax|use tax|withholding tax|department of revenue|tax payment|business license|liquor license|alcohol license|permit fee)\b/.test(text)
}

function payrollText(row = {}) {
  return [row.payroll_classification, row.classification, row.employee_type, row.job_type, row.position, row.role, row.department, row.group_name, row.employee_name, row.name]
    .map(value => String(value || '').toLowerCase()).join(' ')
}

function isTips(row = {}) {
  const text = payrollText(row)
  return /customer tip|server tip|tips only|front house tip|waiter|waitress|server|foh/.test(text)
}

function payrollAmount(row = {}) { return num(row.total_pay || row.total || row.amount || row.regular_pay) }

export function classifySpend(row = {}) {
  const text = textOf(row)
  // Government tax and licensing payments are operating expenses, never inventory purchases.
  // This prevents vendors such as AL-DEPT OF REV and AL ONESPOT from being pulled into Alcohol Cost
  // even when legacy data carries an incorrect Liquor/Alcohol category.
  if (isGovernmentOrTaxSpend(row)) return { bucket: 'other', rule: 'governmentTax', label: 'Taxes & Licenses' }
  if (/margarita\s*(mix|base|concentrate)|marg(?:arita)?\s*(mix|base|mx)|sweet\s*(?:&|and|n)?\s*sour|sour\s*mix|bar\s*mix|margarita\s*syrup/.test(text)) return { bucket: 'alcohol', rule: 'margaritaMix', label: 'Margarita Mix' }
  if (/\bbeer\b|lager|ale|ipa|modelo|corona|bud light|michelob|coors|miller|dos equis|pacifico|tecate|keg/.test(text)) return { bucket: 'alcohol', rule: 'beer', label: 'Beer' }
  if (/liquor|tequila|mezcal|vodka|rum|whiskey|whisky|bourbon|scotch|gin|brandy|cognac|wine|champagne|prosecco|abc store|texana/.test(text)) return { bucket: 'alcohol', rule: 'liquor', label: 'Liquor / Wine' }
  if (/cintas|aramark|unifirst|uniform service|linen service|floor mat|shop towel|apron service/.test(text)) return { bucket: 'shared', rule: 'cintas', label: 'Cintas / Linen Service' }
  if (/clean|chemical|sanitizer|soap|detergent|janitorial|ecolab|auto[- ]?chlor|pest control|terminix|orkin/.test(text)) return { bucket: 'shared', rule: 'cleaningSupplies', label: 'Cleaning Supplies' }
  if (/suppl|paper|foil|film|glove|container|to-go|takeout|straw|napkin|packag|smallware|utensil|disposable|office depot|staples|webstaurant|restaurant supply/.test(text)) return { bucket: 'shared', rule: 'supplies', label: 'Restaurant / Kitchen Supplies' }
  if (/util|electric|power|water|natural gas|sewer|internet|telephone|phone service|alabama power|utility board/.test(text)) return { bucket: 'shared', rule: 'utilities', label: 'Utilities' }
  if (/insurance/.test(text)) return { bucket: 'shared', rule: 'insurance', label: 'Insurance' }
  if (/food|meat|produce|grocery|chicken|beef|fish|shrimp|cheese|tortilla|rice|bean|us foods/.test(text)) return { bucket: 'food', rule: 'foodPurchases', label: 'Food Purchases' }
  if (/beverage|soda|coke|sprite|tea|lemonade|buffalo rock|mixer/.test(text)) return { bucket: 'food', rule: 'foodPurchases', label: 'Food / Non-alcohol Beverage Purchases' }
  return { bucket: 'other', rule: 'other', label: 'Other' }
}

export function classifyPayroll(row = {}) {
  const text = payrollText(row)
  if (isTips(row)) return { bucket: 'excluded', rule: 'tips', label: 'Server Tips' }
  // Assistant managers are regular operating payroll and are intentionally not split
  // between Food and Alcohol. Only actual manager roles use the manager allocation rule.
  if (/assistant manager|assistant mgr|asst\.? manager|asistente manager|assistant general manager/.test(text)) return { bucket: 'other', rule: 'otherPayroll', label: 'Assistant Manager Payroll' }
  if (/bartender|barback|bar manager/.test(text)) return { bucket: 'alcohol', rule: 'bartenderPayroll', label: 'Bar Payroll' }
  if (/general manager|restaurant manager|store manager|\bmanager\b|management/.test(text)) return { bucket: 'shared', rule: 'managerPayroll', label: 'Manager Payroll' }
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

const TOAST_ALCOHOL_DEPARTMENTS = [
  'bottled beer',
  'cocktails & shots',
  'cocktails and shots',
  'draft beer',
  'margaritas',
  'wine'
]
const TOAST_FOOD_DEPARTMENTS = ['food', 'no sales category assigned']
const TOAST_EXCLUDED_DEPARTMENTS = [
  'non-grat svc charges',
  'non grat svc charges',
  'non-grat service charges',
  'non grat service charges',
  'service charges',
  'tips',
  'tax',
  'taxes',
  'discounts',
  'gift cards',
  'gift card'
]

function normalizeDepartment(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function classifyToastDepartment(value = '') {
  const department = normalizeDepartment(value)
  if (TOAST_ALCOHOL_DEPARTMENTS.includes(department)) return 'alcohol'
  if (TOAST_FOOD_DEPARTMENTS.includes(department)) return 'food'
  if (TOAST_EXCLUDED_DEPARTMENTS.includes(department)) return 'excluded'
  return 'other'
}

export function classifyMenuSale(item = {}) {
  const category = normalizeDepartment(item.department || item.department_name || item.sales_department || item.category || item.menu_category || item.sales_category || item.type || '')
  const department = classifyToastDepartment(category)
  if (department === 'alcohol' || department === 'food' || department === 'excluded') return department
  const name = String(item.name || item.item_name || item.description || item.menu_item || '').trim().toLowerCase()
  return ALCOHOL_MENU_PATTERN.test(`${category} ${name}`) ? 'alcohol' : 'food'
}

export function menuSaleCategoryLabel(item = {}) {
  const department = classifyMenuSale(item)
  if (department === 'excluded') return 'Excluded'
  if (department !== 'alcohol') return 'Food'
  const category = String(item.category || item.menu_category || item.sales_category || '').toLowerCase()
  const name = String(item.name || item.item_name || item.description || item.menu_item || '').toLowerCase()
  const text = `${category} ${name}`
  if (/beer|lager|ale|ipa|draft|draught|cerveza|modelo|corona|michelob|bud(?:weiser| light)?|budlight|dos equis|pacifico|tecate|coors|miller|keg/.test(text)) return 'Beer'
  if (/wine|sangria|champagne|prosecco/.test(text)) return 'Wine'
  if (/margarita|cocktail|martini|mojito|paloma|daiquiri|old fashioned|mule|bloody mary|long island|pi[ñn]a colada|mixed drink/.test(text)) return 'Cocktail / Margarita'
  if (/shot|shooter/.test(text)) return 'Shot'
  return 'Liquor'
}

function menuSalesAmount(item = {}) {
  return num(item.netSales ?? item.net_sales ?? item.grossSales ?? item.gross_sales ?? item.sales ?? item.amount)
}

export function calculateDepartmentCosts({ salesRows = [], toastSalesCategories = [], payrollRows = [], employees = [], spendRows = [], menuItems = [], settings = {} } = {}) {
  // A corrected Toast report may be imported after an older partial report for the
  // same business dates. Keep one row per date and prefer rows carrying the full
  // Sales Category Summary arrays. This prevents stale alcohol totals from being
  // added to or selected ahead of the corrected import.
  const salesRowScore = row => {
    let score = 0
    if (Array.isArray(row.alcohol_sales_categories) && row.alcohol_sales_categories.length) score += 100
    if (Array.isArray(row.food_sales_categories) && row.food_sales_categories.length) score += 100
    if (/toast sales category summary/i.test(String(row.import_note || ''))) score += 50
    if (num(row.alcohol_sales) || num(row.food_sales)) score += 10
    return score
  }
  const dedupedByDate = new Map()
  ;(salesRows || []).forEach((row, index) => {
    const date = String(row.business_date || row.date || '').trim()
    const key = date || `undated-${index}`
    const current = dedupedByDate.get(key)
    if (!current || salesRowScore(row) >= salesRowScore(current)) dedupedByDate.set(key, row)
  })
  salesRows = [...dedupedByDate.values()]
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

  const employeeById = new Map((employees || []).filter(employee => employee?.id).map(employee => [String(employee.id), employee]))
  const employeeByName = new Map((employees || []).filter(employee => employee?.name).map(employee => [String(employee.name).trim().toLowerCase(), employee]))

  payrollRows.forEach(row => {
    const matchedEmployee = employeeById.get(String(row.employee_id || '')) || employeeByName.get(String(row.employee_name || row.name || '').trim().toLowerCase()) || null
    const classifiedRow = matchedEmployee ? {
      ...row,
      employee_type: matchedEmployee.employee_type || row.employee_type,
      job_type: matchedEmployee.job_type || row.job_type,
      position: matchedEmployee.position || row.position,
      role: matchedEmployee.role || row.role,
      department: matchedEmployee.department || row.department,
      pay_type: matchedEmployee.pay_type || row.pay_type,
      payroll_classification: matchedEmployee.payroll_classification || row.payroll_classification
    } : row
    const amount = payrollAmount(classifiedRow)
    const cls = classifyPayroll(classifiedRow)
    const detailRow = { ...classifiedRow, amount, payrollLabel: cls.label, employeeRecord: matchedEmployee }
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

  const netSales = salesRows.reduce((sum, row) => sum + rowSales(row, ['net_sales', 'netSales', 'total_sales']), 0)

  const isAggregateSalesRow = (item = {}) => {
    const name = String(item.name || item.item_name || item.description || item.menu_item || '').trim().toLowerCase()
    const category = String(item.department || item.department_name || item.sales_department || item.category || item.menu_category || item.sales_category || item.type || '').trim().toLowerCase()
    const text = `${category} ${name}`.replace(/\s+/g, ' ').trim()
    return /^(total|grand total|subtotal|net sales|gross sales|total sales|sales total|all sales|food total|alcohol total|bar total)$/i.test(name) ||
      /^(total|grand total|subtotal)$/i.test(category) ||
      /\b(summary total|report total)\b/i.test(text)
  }

  // Product Mix must contain individual menu items only. Aggregate rows such as
  // "Net Sales" or "Total" are excluded so Toast Total Sales is never added into
  // Food or Alcohol Sales a second time.
  const menuSalesRows = menuItems.filter(item => !isAggregateSalesRow(item)).map(item => ({
    ...item,
    department: classifyMenuSale(item),
    normalizedCategory: menuSaleCategoryLabel(item),
    toastDepartment: String(item.department || item.department_name || item.sales_department || item.category || item.menu_category || item.sales_category || item.type || 'No Sales Category Assigned').trim() || 'No Sales Category Assigned',
    salesAmount: menuSalesAmount(item)
  })).filter(item => item.salesAmount !== 0)

  const categoryMap = new Map()
  menuSalesRows.forEach(item => {
    const key = item.toastDepartment || 'No Sales Category Assigned'
    const current = categoryMap.get(key) || { id: `toast-dept-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, category: key, department: item.department, salesAmount: 0, itemCount: 0, items: [] }
    current.salesAmount += item.salesAmount
    current.itemCount += 1
    current.items.push(item)
    if (current.department !== item.department && item.department === 'alcohol') current.department = 'alcohol'
    categoryMap.set(key, current)
  })

  const toastDepartmentRows = [...categoryMap.values()]
  // Product Mix fallback must use each item's normalized department, not only the raw
  // Toast category. Toast sometimes labels beer/margaritas as Food or Beverage.
  // Grouping by normalized department prevents Alcohol from becoming $0 and keeps
  // the same item out of both Food and Alcohol.
  const buildFallbackRows = (department) => {
    const map = new Map()
    menuSalesRows.filter(item => item.department === department).forEach(item => {
      const label = department === 'alcohol'
        ? (item.normalizedCategory || item.toastDepartment || 'Alcohol')
        : (item.toastDepartment || 'Food')
      const key = `${department}|${label}`
      const current = map.get(key) || {
        id: `fallback-${department}-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        category: label,
        department,
        salesAmount: 0,
        itemCount: 0,
        items: [],
        source: 'Toast Product Mix fallback'
      }
      current.salesAmount += item.salesAmount
      current.itemCount += 1
      current.items.push(item)
      map.set(key, current)
    })
    return [...map.values()]
  }
  const foodDepartmentRows = buildFallbackRows('food')
  const alcoholDepartmentRows = buildFallbackRows('alcohol')
  const excludedDepartmentRows = buildFallbackRows('excluded')
  const otherDepartmentRows = buildFallbackRows('other')

  // Sales Summary category fields are the primary source because they reconcile
  // exactly to Toast. Product Mix is used only when category totals were not imported.
  const explicitFoodSales = salesRows.reduce((sum, row) => sum + rowSales(row, ['food_sales', 'foodSales', 'restaurant_food_sales']), 0)
  // Do not add Toast's overall alcohol total to its component totals. Some imports
  // contain both alcohol_sales and beer/liquor/wine/margarita fields, and adding all
  // of them double-counts alcohol. Prefer the overall field; otherwise sum components.
  const explicitAlcoholOverall = salesRows.reduce((sum, row) => sum + rowSales(row, ['alcohol_sales', 'alcoholSales', 'bar_sales']), 0)
  const explicitBeerSales = salesRows.reduce((sum, row) => sum + rowSales(row, ['beer_sales', 'beerSales']), 0)
  const explicitLiquorSales = salesRows.reduce((sum, row) => sum + rowSales(row, ['liquor_sales', 'liquorSales', 'spirits_sales']), 0)
  const explicitWineSales = salesRows.reduce((sum, row) => sum + rowSales(row, ['wine_sales', 'wineSales']), 0)
  const explicitMargaritaSales = salesRows.reduce((sum, row) => sum + rowSales(row, ['margarita_sales', 'margaritaSales', 'cocktail_sales', 'cocktailSales']), 0)
  const explicitAlcoholComponents = explicitBeerSales + explicitLiquorSales + explicitWineSales + explicitMargaritaSales

  const aggregateCategoryRows = (field, department) => {
    const map = new Map()
    salesRows.forEach(row => {
      const values = Array.isArray(row[field]) ? row[field] : []
      values.forEach(entry => {
        const category = String(entry.category || entry.name || '').trim() || 'Unclassified'
        const current = map.get(category) || { id: `sales-summary-${department}-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, category, department, salesAmount: 0, itemCount: 0, source: 'Toast Sales Summary' }
        current.salesAmount += num(entry.salesAmount ?? entry.netSales ?? entry.amount)
        current.itemCount += num(entry.itemCount ?? entry.items ?? 0)
        map.set(category, current)
      })
    })
    return [...map.values()]
  }

  const normalizedTableRows = (toastSalesCategories || []).map((entry, index) => ({
    id: entry.id || `toast-category-${index}`,
    category: String(entry.category || entry.sales_category || entry.name || 'Unclassified'),
    department: String(entry.department || entry.department_type || '').toLowerCase(),
    salesAmount: num(entry.salesAmount ?? entry.sales_amount ?? entry.net_sales ?? entry.amount),
    itemCount: num(entry.itemCount ?? entry.item_count ?? entry.items),
    source: 'Toast Sales Category Summary'
  }))
  const rowsForDepartment = department => normalizedTableRows.filter(row => row.department === department)

  const explicitFoodRows = rowsForDepartment('food').length ? rowsForDepartment('food') : aggregateCategoryRows('food_sales_categories', 'food')
  const explicitAlcoholRows = rowsForDepartment('alcohol').length ? rowsForDepartment('alcohol') : aggregateCategoryRows('alcohol_sales_categories', 'alcohol')
  const explicitOtherRows = rowsForDepartment('other').length ? rowsForDepartment('other') : aggregateCategoryRows('other_sales_categories', 'other')
  const explicitExcludedRows = rowsForDepartment('excluded').length ? rowsForDepartment('excluded') : aggregateCategoryRows('excluded_sales_categories', 'excluded')
  const explicitFoodRowsTotal = explicitFoodRows.reduce((sum, row) => sum + row.salesAmount, 0)
  const explicitAlcoholRowsTotal = explicitAlcoholRows.reduce((sum, row) => sum + row.salesAmount, 0)
  const hasExplicitDepartmentTotals = explicitFoodSales !== 0 || explicitAlcoholRowsTotal !== 0 || explicitAlcoholOverall !== 0 || explicitAlcoholComponents !== 0 || explicitFoodRows.length > 0 || explicitAlcoholRows.length > 0

  // Prefer the scalar Toast totals when present. If an older/imported row only
  // contains the category arrays, calculate the department total from those rows.
  // This prevents Food from falling back to the combined Product Mix total while
  // Alcohol remains zero.
  // Category arrays are the most complete Toast department source when present.
  // Older scalar imports can be partial (for example only one alcohol bucket), so
  // prefer the reconciled category-row total before scalar/component fallbacks.
  let foodSales = hasExplicitDepartmentTotals ? (explicitFoodRowsTotal || explicitFoodSales) : foodDepartmentRows.reduce((sum, row) => sum + row.salesAmount, 0)
  let alcoholSales = hasExplicitDepartmentTotals ? (explicitAlcoholRowsTotal || explicitAlcoholOverall || explicitAlcoholComponents) : alcoholDepartmentRows.reduce((sum, row) => sum + row.salesAmount, 0)

  const hasToastDepartmentTotals = hasExplicitDepartmentTotals || foodDepartmentRows.length > 0 || alcoholDepartmentRows.length > 0
  const alcoholSalesRows = menuSalesRows.filter(item => item.department === 'alcohol')
  const foodSalesRows = menuSalesRows.filter(item => item.department === 'food')
  if (!hasToastDepartmentTotals) {
    alcoholSales = alcoholSalesRows.reduce((sum, item) => sum + item.salesAmount, 0)
    foodSales = foodSalesRows.reduce((sum, item) => sum + item.salesAmount, 0)
  }

  if (!foodSales && !alcoholSales && netSales > 0) {
    const alcoholShare = Number(settings.defaultAlcoholSalesPercent ?? 25) / 100
    alcoholSales = netSales * alcoholShare
    foodSales = netSales - alcoholSales
  }

  const finalFoodDepartmentRows = hasExplicitDepartmentTotals ? explicitFoodRows : foodDepartmentRows
  const finalAlcoholDepartmentRows = hasExplicitDepartmentTotals ? explicitAlcoholRows : alcoholDepartmentRows
  const finalOtherDepartmentRows = hasExplicitDepartmentTotals ? explicitOtherRows : otherDepartmentRows
  const finalExcludedDepartmentRows = hasExplicitDepartmentTotals ? explicitExcludedRows : excludedDepartmentRows
  const classifiedDepartmentSales = foodSales + alcoholSales
  const otherDepartmentSales = finalOtherDepartmentRows.reduce((sum, row) => sum + row.salesAmount, 0)
  const excludedDepartmentSales = finalExcludedDepartmentRows.reduce((sum, row) => sum + row.salesAmount, 0)
  // Keep revenue and cost completely separate. Direct department cost is inventory
  // purchasing only; payroll and shared overhead remain separate operating expenses.
  const directFoodCost = totals.foodPurchases
  const directAlcoholCost = totals.alcoholPurchases
  const trueFoodCost = directFoodCost + totals.kitchenPayroll + totals.managerFood + totals.foodSupplies + totals.foodShared
  const trueAlcoholCost = directAlcoholCost + totals.barPayroll + totals.managerAlcohol + totals.alcoholShared
  const foodGrossProfit = foodSales - directFoodCost
  const alcoholGrossProfit = alcoholSales - directAlcoholCost
  const foodProfit = foodSales - trueFoodCost
  const alcoholProfit = alcoholSales - trueAlcoholCost
  const allocatedCost = trueFoodCost + trueAlcoholCost
  // Operating profit must not depend on department allocation percentages. Use the
  // direct accounting formula from raw source totals: Toast net sales less all
  // non-tip operating payroll and all vendor/business spend.
  const operatingPayrollTotal = totals.kitchenPayroll + totals.barPayroll + totals.managerPayroll + totals.otherPayroll
  const totalOperatingSpend = spendRows.reduce((sum, row) => sum + num(row.amount || row.total || row.line_total), 0)
  const overallOperatingProfit = netSales - operatingPayrollTotal - totalOperatingSpend

  return {
    ...totals,
    foodSales,
    alcoholSales,
    directFoodCost,
    directAlcoholCost,
    foodGrossProfit,
    alcoholGrossProfit,
    beerSales: explicitBeerSales || finalAlcoholDepartmentRows.filter(row => /beer|draft/i.test(String(row.category || ''))).reduce((sum, row) => sum + num(row.salesAmount), 0),
    wineSales: explicitWineSales || finalAlcoholDepartmentRows.filter(row => /wine|sangria|champagne|prosecco/i.test(String(row.category || ''))).reduce((sum, row) => sum + num(row.salesAmount), 0),
    liquorSales: explicitLiquorSales || finalAlcoholDepartmentRows.filter(row => /liquor|spirits|shot/i.test(String(row.category || ''))).reduce((sum, row) => sum + num(row.salesAmount), 0),
    margaritaSales: explicitMargaritaSales || finalAlcoholDepartmentRows.filter(row => /margarita|cocktail/i.test(String(row.category || ''))).reduce((sum, row) => sum + num(row.salesAmount), 0),
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
    classifiedMenuSales: classifiedDepartmentSales,
    menuSalesDifference: netSales > 0 && classifiedDepartmentSales > 0 ? netSales - classifiedDepartmentSales : 0,
    departmentSalesDifference: netSales > 0 ? netSales - classifiedDepartmentSales : 0,
    toastDepartmentRows,
    foodDepartmentRows: finalFoodDepartmentRows,
    alcoholDepartmentRows: finalAlcoholDepartmentRows,
    otherDepartmentRows: finalOtherDepartmentRows,
    excludedDepartmentRows: finalExcludedDepartmentRows,
    otherDepartmentSales,
    excludedDepartmentSales,
    salesSource: hasExplicitDepartmentTotals ? 'Toast Sales Category Summary' : hasToastDepartmentTotals ? 'Toast Product Mix Departments' : 'Product Mix Fallback',
    spendDetails,
    payrollDetails,
    rules
  }
}

export const DEFAULT_ALLOCATION_RULES = DEFAULT_RULES
