export const SYSTEM_CATEGORIES = [
  'Food', 'Beverage', 'Beer', 'Liquor', 'Supplies', 'Cleaning', 'Paper Goods',
  'Utilities', 'Maintenance', 'Repairs', 'Insurance', 'Accounting Fees',
  'Professional Services', 'Marketing', 'Equipment', 'Smallwares', 'Rent / Lease',
  'Property Expenses', 'Credit Cards', 'Bank Fees', 'Taxes & Licenses',
  'POS / Software', 'Delivery Fees', 'Vehicle Expenses', 'Loans',
  'Cash Expenses', 'Restaurant Expenses', 'Other'
]

export function normalizeCategory(value) {
  const raw = String(value || '').trim()
  const text = raw.toLowerCase()
  if (!raw) return 'Other'
  if (text.includes('paper') || text.includes('napkin') || text.includes('straw')) return 'Paper Goods'
  if (text.includes('clean') || text.includes('chemical') || text.includes('soap') || text.includes('degreaser')) return 'Cleaning'
  if (text.includes('food') || text.includes('meat') || text.includes('produce') || text.includes('grocery') || text.includes('chicken') || text.includes('beef') || text.includes('fish') || text.includes('rice') || text.includes('oil') || text.includes('flour') || text.includes('cheese') || text.includes('sauce')) return 'Food'
  if (text.includes('beer')) return 'Beer'
  if (text.includes('liquor') || text.includes('wine') || text.includes('vodka') || text.includes('tequila') || text.includes('whiskey') || text.includes('rum')) return 'Liquor'
  if (text.includes('beverage') || text.includes('soda') || text.includes('drink') || text.includes('coffee') || text.includes('tea') || text.includes('juice') || text.includes('coke') || text.includes('pepsi')) return 'Beverage'
  if (text.includes('suppl') || text.includes('glove') || text.includes('bag') || text.includes('container')) return 'Supplies'
  if (text.includes('util') || text.includes('electric') || text.includes('gas') || text.includes('water')) return 'Utilities'
  if (text.includes('maint')) return 'Maintenance'
  if (text.includes('repair')) return 'Repairs'
  if (text.includes('insurance')) return 'Insurance'
  if (text.includes('account')) return 'Accounting Fees'
  if (text.includes('professional')) return 'Professional Services'
  if (text.includes('marketing')) return 'Marketing'
  if (text.includes('equipment')) return 'Equipment'
  if (text.includes('smallware')) return 'Smallwares'
  if (text.includes('rent') || text.includes('lease')) return 'Rent / Lease'
  if (text.includes('property')) return 'Property Expenses'
  if (text.includes('credit card')) return 'Credit Cards'
  if (text.includes('bank')) return 'Bank Fees'
  if (text.includes('tax') || text.includes('license')) return 'Taxes & Licenses'
  if (text.includes('pos') || text.includes('software')) return 'POS / Software'
  if (text.includes('delivery')) return 'Delivery Fees'
  if (text.includes('vehicle') || text.includes('auto')) return 'Vehicle Expenses'
  if (text.includes('loan') || text.includes('mortgage')) return 'Loans'
  if (text.includes('cash')) return 'Cash Expenses'
  if (text.includes('restaurant')) return 'Restaurant Expenses'
  return raw
}

export function buildCategoryList(data = {}) {
  const values = [
    ...SYSTEM_CATEGORIES,
    ...(data.vendorCategories || []),
    ...(data.expenseCategories || []),
    ...(data.vendors || []).map(row => row.category),
    ...(data.expenses || []).map(row => row.category || row.expense_category || row.type),
    ...(data.invoices || []).map(row => row.category || row.invoice_category || row.type),
    ...(data.invoiceItems || []).map(row => row.category || row.expense_category || row.type)
  ]
  const seen = new Set()
  return values
    .map(normalizeCategory)
    .filter(Boolean)
    .filter(category => {
      const key = category.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => {
      const ai = SYSTEM_CATEGORIES.indexOf(a)
      const bi = SYSTEM_CATEGORIES.indexOf(b)
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      return a.localeCompare(b)
    })
}

export function sumByCategory(rows = [], categories = []) {
  const map = new Map(categories.map(category => [normalizeCategory(category), 0]))
  rows.forEach(row => {
    const category = normalizeCategory(row.category || row.expense_category || row.invoice_category || row.type || 'Other')
    const amount = Number(String(row.amount ?? row.total ?? 0).replace(/[$,%(),]/g, '').trim()) || 0
    map.set(category, (map.get(category) || 0) + amount)
  })
  return [...map.entries()].map(([category, amount]) => ({ id: `cat-${category}`, category, label: category, amount }))
}
