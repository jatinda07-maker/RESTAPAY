export const alphaSort = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base', numeric: true })

export const DEFAULT_EXPENSE_TYPES = [
  'Accounting & Professional Fees','Advertising & Marketing','Alcohol License / Liquor License','Alcohol Purchase','Bank Charges','Business License','Cleaning','Credit Card / Processing Fees','Employee Benefits','Equipment','Fire / Safety Permit','Food Purchase','Food Service Permit','Health Permit','Insurance','Interest / Finance Charges','Maintenance','Marketing','Music / Entertainment License','Office Supplies','Other','Other Licenses & Permits','Payroll / Employee Wages','Payroll Tax','Pest Control','Professional Services','Property Tax','Rent','Rent / Lease','Repairs & Maintenance','Restaurant Supplies','Sales Tax','Security','Service Charges','Smallwares','Software / Technology','Supplies','Telephone / Internet','Uniforms & Linen','Utilities','Vehicle / Delivery','Waste / Garbage','Workers Compensation'
].sort(alphaSort)

export const DEFAULT_CATEGORIES = [
  'Alcohol','Beer','Beverage','Cocktails & Shots','Dairy','Dry Goods','Food','Frozen','Liquor','Maintenance','Margaritas','Meat','Other','Produce','Seafood','Supplies','Utilities','Wine'
].sort(alphaSort)

export const normalizeClassificationList = (value, defaults = []) => {
  const incoming = Array.isArray(value) ? value : []
  const seen = new Map()
  defaults.forEach(item => {
    const name = String(typeof item === 'string' ? item : item?.name || '').trim()
    if (name) seen.set(name.toLowerCase(), { name, active: typeof item === 'object' ? item.active !== false : true })
  })
  incoming.forEach(item => {
    const name = String(typeof item === 'string' ? item : item?.name || '').trim()
    if (!name) return
    const active = typeof item === 'object' ? item.active !== false : true
    seen.set(name.toLowerCase(), { name, active })
  })
  return [...seen.values()].sort((a,b)=>alphaSort(a.name,b.name))
}

export const activeClassificationNames = (items = []) => normalizeClassificationList(items).filter(item => item.active !== false).map(item => item.name)
export const classificationName = value => String(value || '').trim()
export const sameClassification = (a,b) => classificationName(a).localeCompare(classificationName(b), undefined, { sensitivity:'base' }) === 0
