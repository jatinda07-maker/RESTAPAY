function norm(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  const negative = /^\(.*\)$/.test(raw) || /credit|rebate|refund|return/i.test(raw)
  const cleaned = raw.replace(/[$,%(),]/g, '').trim()
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return 0
  return negative || n < 0 ? -Math.abs(n) : n
}
function fmt(value) { return Number(value || 0).toFixed(2) }
function round2(value) { return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100 }
function findValue(row, labels) {
  const mapped = Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [norm(key), value]))
  for (const label of labels) {
    const value = mapped[norm(label)]
    if (value !== undefined && value !== '') return value
  }
  return ''
}
function cleanRows(rows) { return rows.filter(row => Object.values(row || {}).some(value => String(value ?? '').trim() !== '')) }
function sheetObjects(XLSX, workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  return cleanRows(XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }))
}
function parseDate(value, fallback = '') {
  if (!value) return fallback
  const text = String(value).trim()
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  const d = new Date(text)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  const m = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
  return fallback
}
function fileRange(name) {
  const match = String(name || '').match(/(\d{4})[-_ ]?(\d{2})[-_ ]?(\d{2}).*?(\d{4})[-_ ]?(\d{2})[-_ ]?(\d{2})/)
  return match ? { start: `${match[1]}-${match[2]}-${match[3]}`, end: `${match[4]}-${match[5]}-${match[6]}` } : { start: '', end: '' }
}
function cents(value) { return Math.round(Number(value || 0) * 100) }
function distributeMoney(total, weights) {
  const totalCents = cents(total)
  const sumWeights = weights.reduce((acc, value) => acc + Math.max(Number(value || 0), 0), 0)
  if (!sumWeights || !weights.length) return weights.map(() => 0)
  let used = 0
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return round2((totalCents - used) / 100)
    const share = Math.round((Math.max(Number(weight || 0), 0) / sumWeights) * totalCents)
    used += share
    return round2(share / 100)
  })
}
function distributeCategoryRows(rows, weights) {
  return weights.map((_, index) => rows.map(row => ({
    ...row,
    itemCount: distributeMoney(row.itemCount, weights)[index],
    salesAmount: distributeMoney(row.salesAmount, weights)[index]
  })))
}

const ALCOHOL_KEYS = new Set(['bottledbeer', 'cocktailsshots', 'cocktailsandshots', 'draftbeer', 'margaritas', 'wine'])
const EXCLUDED_KEYS = new Set(['nongratsvccharges', 'nongratservicecharges', 'servicecharges', 'tips', 'tax', 'taxes', 'discounts', 'giftcards', 'giftcard'])

export function parseToastSalesCategoryTotals(XLSX, workbook) {
  const rows = sheetObjects(XLSX, workbook, 'Sales category summary')
  const groups = { food: [], alcohol: [], excluded: [], other: [] }
  rows.forEach(row => {
    const category = String(findValue(row, ['Sales category', 'Category']) || '').trim()
    if (!category || /^total$/i.test(category)) return
    const entry = {
      category,
      itemCount: round2(numeric(findValue(row, ['Items', 'Item count']))),
      salesAmount: round2(numeric(findValue(row, ['Net sales', 'Net Sales'])))
    }
    const key = norm(category)
    if (key === 'food') groups.food.push(entry)
    else if (ALCOHOL_KEYS.has(key)) groups.alcohol.push(entry)
    else if (key === 'nosalescategoryassigned') groups.other.push(entry)
    else if (EXCLUDED_KEYS.has(key)) groups.excluded.push(entry)
    else groups.other.push(entry)
  })
  const total = key => round2(groups[key].reduce((sum, row) => sum + row.salesAmount, 0))
  return {
    ...groups,
    foodTotal: total('food'),
    alcoholTotal: total('alcohol'),
    excludedTotal: total('excluded'),
    otherTotal: total('other')
  }
}

export function parseToastSalesRows(XLSX, workbook, fileName, createId) {
  const categories = parseToastSalesCategoryTotals(XLSX, workbook)
  if (!workbook.SheetNames.includes('Sales category summary') || (!categories.food.length && !categories.alcohol.length)) return []

  const dayRows = sheetObjects(XLSX, workbook, 'Sales by day').filter(row => numeric(findValue(row, ['Net sales', 'Net Sales'])))
  const range = fileRange(fileName)
  const totalNet = round2(categories.foodTotal + categories.alcoholTotal + categories.excludedTotal + categories.otherTotal)
  const base = {
    gross_sales: fmt(totalNet), net_sales: fmt(totalNet), cash_sales: '0.00', credit_sales: '0.00',
    gift_card_sales: '0.00', online_orders: '0.00', delivery_orders: '0.00', pickup_orders: '0.00',
    tips: '0.00', tips_collected: '0.00', tips_withheld: '0.00', tips_after_withholding: '0.00',
    refunds: '0.00', voids: '0.00', discounts: '0.00', tax: '0.00', guest_count: '0.00',
    source_file: fileName
  }

  if (!dayRows.length) {
    return [{
      id: createId('sale'), ...base, business_date: range.start || new Date().toISOString().slice(0, 10),
      food_sales: fmt(categories.foodTotal), alcohol_sales: fmt(categories.alcoholTotal),
      other_sales: fmt(categories.otherTotal), excluded_sales: fmt(categories.excludedTotal),
      food_sales_categories: categories.food, alcohol_sales_categories: categories.alcohol,
      other_sales_categories: categories.other, excluded_sales_categories: categories.excluded,
      import_note: 'Toast Sales Category Summary'
    }]
  }

  const weights = dayRows.map(row => numeric(findValue(row, ['Net sales', 'Net Sales'])))
  const foodParts = distributeMoney(categories.foodTotal, weights)
  const alcoholParts = distributeMoney(categories.alcoholTotal, weights)
  const otherParts = distributeMoney(categories.otherTotal, weights)
  const excludedParts = distributeMoney(categories.excludedTotal, weights)
  const foodCategoryParts = distributeCategoryRows(categories.food, weights)
  const alcoholCategoryParts = distributeCategoryRows(categories.alcohol, weights)
  const otherCategoryParts = distributeCategoryRows(categories.other, weights)
  const excludedCategoryParts = distributeCategoryRows(categories.excluded, weights)

  return dayRows.map((row, index) => {
    const dayNet = round2(numeric(findValue(row, ['Net sales', 'Net Sales'])))
    return {
      id: createId('sale'), ...base,
      business_date: parseDate(findValue(row, ['yyyyMMdd', 'Date', 'Business Date']), range.start),
      gross_sales: fmt(dayNet), net_sales: fmt(dayNet),
      guest_count: fmt(numeric(findValue(row, ['Total guests', 'Guests', 'Guest Count']))),
      food_sales: fmt(foodParts[index]), alcohol_sales: fmt(alcoholParts[index]),
      other_sales: fmt(otherParts[index]), excluded_sales: fmt(excludedParts[index]),
      food_sales_categories: foodCategoryParts[index], alcohol_sales_categories: alcoholCategoryParts[index],
      other_sales_categories: otherCategoryParts[index], excluded_sales_categories: excludedCategoryParts[index],
      import_note: `Toast Sales Category Summary distributed across ${dayRows.length} daily rows`
    }
  })
}
