function number(value) {
  const parsed = Number(String(value ?? '').replace(/[$,]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeVendorName(value) {
  let normalized = String(value || '')
    .toLowerCase()
    .replace(/u[.\s]*s[.\s]*/g, 'us ')
    .replace(/p[.\s]*f[.\s]*g[.\s]*/g, 'pfg ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(incorporated|inc|llc|ltd|company|co|corporation|corp|distribution|distributing|services?)\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  normalized = normalized
    .replace(/\bperformance foodservice\b/g, 'performance foods')
    .replace(/\bpfg\b/g, 'performance foods')
    .replace(/\bus foodservice\b/g, 'us foods')
  return normalized
}

export function vendorSimilarity(a, b) {
  const left = normalizeVendorName(a)
  const right = normalizeVendorName(b)
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.includes(right) || right.includes(left)) return 0.94
  const l = new Set(left.split(' '))
  const r = new Set(right.split(' '))
  const intersection = [...l].filter(token => r.has(token)).length
  const union = new Set([...l, ...r]).size || 1
  return intersection / union
}

const UNIT_ALIASES = {
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  kg: 'kg', g: 'g', gram: 'g', grams: 'g',
  gal: 'gal', gallon: 'gal', gallons: 'gal',
  qt: 'qt', quart: 'qt', quarts: 'qt',
  pt: 'pt', pint: 'pt', pints: 'pt',
  l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l',
  ml: 'ml',
  ct: 'each', count: 'each', ea: 'each', each: 'each', pc: 'each', pcs: 'each',
  cs: 'case', case: 'case', box: 'case', bag: 'case', pkg: 'case', pack: 'case'
}

function canonicalUnit(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z]/g, '')
  return UNIT_ALIASES[key] || key || ''
}

function parseFraction(value) {
  const raw = String(value || '').trim()
  if (/^\d+\/\d+$/.test(raw)) {
    const [a, b] = raw.split('/').map(Number)
    return b ? a / b : 0
  }
  return number(raw)
}

export function parsePackageDetails(input = {}) {
  const description = String(input.description || input.item_name || input.name || '')
  const explicitPack = number(input.pack_count || input.case_pack || input.pack_qty)
  const explicitSize = number(input.unit_size_value || input.pack_size_value || input.size_value)
  const explicitUnit = canonicalUnit(input.unit_size_unit || input.pack_size_unit || input.size_unit || input.unit || input.uom)
  const combined = `${description} ${input.package_size || ''} ${input.pack_size || ''} ${input.size || ''} ${input.unit || ''}`
    .toLowerCase().replace(/×/g, 'x')

  let packCount = explicitPack || 1
  let unitSizeValue = explicitSize || 0
  let unitSizeUnit = explicitUnit
  let match = combined.match(/\b(\d+(?:\.\d+)?)\s*(?:\/|x)\s*(\d+(?:\.\d+)?|\d+\/\d+)\s*(lb|lbs|oz|kg|g|gal|qt|pt|l|lt|liter|litre|ml|ct|count|ea|each)\b/i)
  if (match) {
    packCount = number(match[1]) || 1
    unitSizeValue = parseFraction(match[2])
    unitSizeUnit = canonicalUnit(match[3])
  } else {
    match = combined.match(/\b(\d+(?:\.\d+)?)\s*(?:ct|count|ea|each)\b/i)
    if (match) {
      packCount = 1
      unitSizeValue = number(match[1])
      unitSizeUnit = 'each'
    } else {
      match = combined.match(/\b(\d+(?:\.\d+)?|\d+\/\d+)\s*(lb|lbs|oz|kg|g|gal|qt|pt|l|lt|liter|litre|ml)\b/i)
      if (match) {
        unitSizeValue = parseFraction(match[1])
        unitSizeUnit = canonicalUnit(match[2])
      }
    }
  }

  const quantity = number(input.quantity ?? input.qty) || 1
  const casePrice = number(input.line_total ?? input.total ?? input.amount) / quantity || number(input.unit_price)
  const totalMeasure = packCount * unitSizeValue
  let normalizedUnit = unitSizeUnit
  let normalizedMeasure = totalMeasure
  if (unitSizeUnit === 'oz') { normalizedUnit = 'lb'; normalizedMeasure = totalMeasure / 16 }
  if (unitSizeUnit === 'g') { normalizedUnit = 'kg'; normalizedMeasure = totalMeasure / 1000 }
  if (unitSizeUnit === 'ml') { normalizedUnit = 'l'; normalizedMeasure = totalMeasure / 1000 }
  if (unitSizeUnit === 'qt') { normalizedUnit = 'gal'; normalizedMeasure = totalMeasure / 4 }
  if (unitSizeUnit === 'pt') { normalizedUnit = 'gal'; normalizedMeasure = totalMeasure / 8 }
  const normalizedUnitCost = normalizedMeasure > 0 ? casePrice / normalizedMeasure : 0
  const packageLabel = unitSizeValue && unitSizeUnit
    ? `${packCount > 1 ? `${packCount} x ` : ''}${unitSizeValue} ${unitSizeUnit}`
    : String(input.package_size || input.pack_size || input.size || input.unit || '').trim()

  return {
    pack_count: packCount,
    unit_size_value: unitSizeValue,
    unit_size_unit: unitSizeUnit,
    package_label: packageLabel,
    total_measure: Number(totalMeasure.toFixed(4)),
    normalized_unit: normalizedUnit,
    normalized_unit_cost: Number(normalizedUnitCost.toFixed(6)),
    case_price: Number(casePrice.toFixed(2))
  }
}

export function enrichInvoiceItem(item = {}) {
  return { ...item, ...parsePackageDetails(item) }
}
