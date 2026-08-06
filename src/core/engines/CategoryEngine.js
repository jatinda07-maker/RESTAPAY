const SYSTEM_CATEGORIES = [
  'Food', 'Beverage', 'Beer', 'Liquor', 'Supplies', 'Cleaning', 'Paper Goods',
  'Utilities', 'Maintenance', 'Repairs', 'Insurance', 'Accounting Fees', 'Loans',
  'Rent / Lease', 'Equipment', 'Smallwares', 'Marketing', 'Taxes & Licenses',
  'Bank Fees', 'Credit Cards', 'POS / Software', 'Delivery Fees', 'Vehicle Expenses',
  'Cash Expenses', 'Restaurant Expenses', 'Property Expenses', 'Other'
]

const CANONICAL_RULES = [
  ['Food', ['food', 'meat', 'produce', 'grocery', 'chicken', 'beef', 'pork', 'fish', 'shrimp', 'seafood', 'rice', 'oil', 'flour', 'cheese', 'sauce', 'fries', 'vegetable', 'dairy']],
  ['Beer', ['beer', 'keg', 'lager', 'ipa', 'ale']],
  ['Liquor', ['liquor', 'wine', 'alcohol', 'vodka', 'tequila', 'whiskey', 'bourbon', 'rum', 'gin']],
  ['Beverage', ['beverage', 'soda', 'drink', 'coffee', 'tea', 'juice', 'coke', 'pepsi', 'syrup']],
  ['Cleaning', ['clean', 'sanitizer', 'degreaser', 'detergent', 'soap', 'chemical']],
  ['Paper Goods', ['paper', 'napkin', 'straw', 'bag', 'container', 'to-go', 'cup', 'plate', 'lid']],
  ['Supplies', ['suppl', 'glove', 'smallware', 'utensil', 'uniform']],
  ['Utilities', ['util', 'electric', 'power', 'gas', 'water', 'sewer', 'internet', 'phone']],
  ['Maintenance', ['maint', 'repair', 'service', 'hvac', 'plumb', 'electrician']],
  ['Insurance', ['insurance', 'auto owners']],
  ['Accounting Fees', ['account', 'bookkeep', 'payroll service', 'cpa']],
  ['Loans', ['loan', 'mortgage', 'ascentium', 'capital payment']],
  ['Rent / Lease', ['rent', 'lease']],
  ['Equipment', ['equipment', 'appliance', 'machine', 'oven', 'cooler', 'freezer']],
  ['Marketing', ['marketing', 'advertis', 'facebook', 'google ads']],
  ['Taxes & Licenses', ['tax', 'license', 'permit']],
  ['Bank Fees', ['bank fee', 'service charge', 'merchant fee']],
  ['Credit Cards', ['credit card', 'visa', 'mastercard', 'amex', 'discover']],
  ['POS / Software', ['pos', 'software', 'toast', 'subscription']],
  ['Delivery Fees', ['delivery', 'doordash', 'uber', 'grubhub']],
  ['Vehicle Expenses', ['vehicle', 'fuel', 'auto', 'truck']],
  ['Cash Expenses', ['cash expense', 'cash']],
  ['Property Expenses', ['property']],
  ['Restaurant Expenses', ['restaurant expense', 'restaurant']]
]

function clean(value) {
  return String(value || '').trim()
}

function titleCase(value) {
  return clean(value).replace(/\s+/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

export function normalizeCategory(value, fallback = 'Other') {
  const raw = clean(value)
  if (!raw) return fallback
  const text = raw.toLowerCase()
  for (const [canonical, terms] of CANONICAL_RULES) {
    if (terms.some(term => text.includes(term))) return canonical
  }
  const exact = SYSTEM_CATEGORIES.find(cat => cat.toLowerCase() === text)
  return exact || titleCase(raw)
}

export function getAllCategories(data = {}) {
  const values = [
    ...SYSTEM_CATEGORIES,
    ...(data.vendorCategories || []),
    ...(data.expenseCategories || []),
    ...(data.vendor_categories || []),
    ...(data.expense_categories || []),
    ...(data.vendors || []).map(row => row.category),
    ...(data.expenses || []).map(row => row.category || row.expense_category),
    ...(data.invoices || []).map(row => row.category || row.invoice_category),
    ...(data.invoiceItems || []).map(row => row.category || row.expense_category),
    ...(data.invoice_items || []).map(row => row.category || row.expense_category)
  ].filter(Boolean)

  const seen = new Map()
  values.forEach(value => {
    const normalized = normalizeCategory(value)
    if (!seen.has(normalized.toLowerCase())) seen.set(normalized.toLowerCase(), normalized)
  })
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

export function inferCategory(row = {}, fallback = 'Other') {
  const text = [
    row.category,
    row.expense_category,
    row.invoice_category,
    row.type,
    row.description,
    row.item_name,
    row.item,
    row.name,
    row.vendor,
    row.vendor_name
  ].filter(Boolean).join(' ')
  return normalizeCategory(text || fallback, fallback)
}


export const CATEGORY_GROUPS = {
  vendor: [
    'Food', 'Beverage', 'Beer', 'Liquor', 'Supplies', 'Cleaning', 'Paper Goods',
    'Equipment', 'Smallwares', 'Packaging', 'Produce', 'Meat', 'Dairy', 'Frozen Foods', 'Other Vendor Purchases'
  ],
  business: [
    'Utilities', 'Maintenance', 'Repairs', 'Insurance', 'Accounting Fees', 'Loans',
    'Rent / Lease', 'Marketing', 'Taxes & Licenses', 'Bank Fees', 'Credit Cards',
    'POS / Software', 'Delivery Fees', 'Vehicle Expenses', 'Cash Expenses',
    'Restaurant Expenses', 'Property Expenses', 'Office Supplies', 'Professional Fees', 'Other Business Expenses', 'Other'
  ]
}

export function categoryGroup(category) {
  const normalized = normalizeCategory(category)
  const text = String(category || normalized || '').toLowerCase()
  if (text.includes('lease') || text.includes('rent')) return 'business'
  if (text.includes('pos') || text.includes('software')) return 'business'
  if (text.includes('loan') || text.includes('insurance') || text.includes('utility') || text.includes('utilities')) return 'business'
  if (text.includes('account') || text.includes('tax') || text.includes('license') || text.includes('bank') || text.includes('marketing')) return 'business'
  if (text.includes('property') || text.includes('maintenance') || text.includes('repair') || text.includes('vehicle')) return 'business'
  if (CATEGORY_GROUPS.vendor.some(cat => normalizeCategory(cat).toLowerCase() === normalized.toLowerCase())) return 'vendor'
  if (CATEGORY_GROUPS.business.some(cat => normalizeCategory(cat).toLowerCase() === normalized.toLowerCase())) return 'business'
  return 'business'
}

export function categoryGroupLabel(group) {
  return group === 'vendor' ? 'Vendor Purchases' : 'Business Expenses'
}

export function categoriesForGroup(data = {}, group = 'business') {
  const all = getAllCategories(data)
  const base = CATEGORY_GROUPS[group] || []
  const combined = [...base, ...all.filter(category => categoryGroup(category) === group)]
  const seen = new Map()
  combined.filter(Boolean).forEach(category => {
    const normalized = normalizeCategory(category)
    if (!seen.has(normalized.toLowerCase())) seen.set(normalized.toLowerCase(), normalized)
  })
  return [...seen.values()]
}

export function rollupCategoryRows(rows = [], group = 'business', maxVisible = 8) {
  const filtered = rows
    .filter(row => categoryGroup(row.category || row.label) === group)
    .map(row => ({ ...row, label: row.label || row.category, category: row.category || row.label, amount: Number(row.amount || 0) }))

  const total = filtered.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const nonZero = filtered.filter(row => Number(row.amount || 0) !== 0).sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
  const zero = filtered.filter(row => Number(row.amount || 0) === 0).sort((a, b) => String(a.label || a.category).localeCompare(String(b.label || b.category)))
  const ordered = [...nonZero, ...zero]

  if (ordered.length <= maxVisible) return ordered

  const visibleCount = Math.max(1, maxVisible - 1)
  const visible = ordered.slice(0, visibleCount)
  const rest = ordered.slice(visibleCount)
  const restTotal = rest.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  return [
    ...visible,
    {
      id: `cat-other-${group}`,
      category: group === 'vendor' ? 'Other Vendor Purchases' : 'Other Business Expenses',
      label: group === 'vendor' ? 'Other Vendor Purchases' : 'Other Business Expenses',
      amount: restTotal,
      rolledUp: rest
    }
  ]
}

export function sumRowsByCategory(rows = [], dataOrCategories = {}) {
  const categories = Array.isArray(dataOrCategories) ? dataOrCategories : getAllCategories(dataOrCategories)
  const map = new Map()
  categories.forEach(category => map.set(normalizeCategory(category), 0))

  rows.forEach(row => {
    const category = normalizeCategory(row.category || row.expense_category || row.invoice_category || inferCategory(row))
    const amount = Number(String(row.amount ?? row.total ?? row.line_total ?? row.invoice_total ?? 0).replace(/[$,]/g, '')) || 0
    map.set(category, (map.get(category) || 0) + amount)
  })

  return [...map.entries()]
    .map(([category, amount]) => ({ id: `cat-${category}`, category, label: category, amount }))
    .sort((a, b) => {
      const aValue = Number(a.amount || 0)
      const bValue = Number(b.amount || 0)
      if (aValue !== 0 || bValue !== 0) return bValue - aValue
      return a.category.localeCompare(b.category)
    })
}
