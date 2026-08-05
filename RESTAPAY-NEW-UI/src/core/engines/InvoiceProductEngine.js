function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-')
  const parsed = Number(raw.replace(/[$,%(),]/g, '').replaceAll(',', ''))
  return Number.isFinite(parsed) ? (negative ? -Math.abs(parsed) : parsed) : 0
}

function text(value) { return String(value ?? '').trim() }

export function normalizeVendorName(value) {
  let normalized = String(value || '')
    .toLowerCase()
    .replace(/u[.\s]*s[.\s]*/g, 'us ')
    .replace(/p[.\s]*f[.\s]*g[.\s]*/g, 'pfg ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(incorporated|inc|llc|ltd|company|co|corporation|corp|distribution|distributing|services?)\b/g, ' ')
    .trim().replace(/\s+/g, ' ')
  return normalized
    .replace(/\bperformance foodservice(?: alabama)?\b/g, 'performance foods')
    .replace(/\bpfg\b/g, 'performance foods')
    .replace(/\bus foodservice\b/g, 'us foods')
}

export function vendorSimilarity(a, b) {
  const left = normalizeVendorName(a)
  const right = normalizeVendorName(b)
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.includes(right) || right.includes(left)) return 0.94
  const l = new Set(left.split(' ')); const r = new Set(right.split(' '))
  const intersection = [...l].filter(token => r.has(token)).length
  return intersection / (new Set([...l, ...r]).size || 1)
}

export function detectInvoiceVendor(input = {}) {
  const source = normalizeVendorName(input.vendor_name || input.vendor || input.supplier || input.source_vendor || '')
  const body = `${source} ${text(input.description)} ${text(input.raw_text)}`.toLowerCase()
  if (body.includes('us foods')) return 'us_foods'
  if (body.includes('performance foods')) return 'performance_foodservice'
  return 'generic'
}

const UNIT_ALIASES = {
  lb: 'lb', lbs: 'lb', lba: 'lb', pound: 'lb', pounds: 'lb',
  oz: 'oz', ounce: 'oz', ounces: 'oz', kg: 'kg', g: 'g', gram: 'g', grams: 'g',
  gal: 'gal', ga: 'gal', gallon: 'gal', gallons: 'gal', qt: 'qt', quart: 'qt', quarts: 'qt',
  pt: 'pt', pint: 'pt', pints: 'pt', l: 'l', lt: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l', ml: 'ml',
  ct: 'each', count: 'each', ea: 'each', each: 'each', pc: 'each', pcs: 'each', cn: 'each', can: 'each', cans: 'each',
  cs: 'case', case: 'case', box: 'case', bag: 'case', pkg: 'case', pack: 'case', bu: 'bushel'
}
function canonicalUnit(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z]/g, '')
  return UNIT_ALIASES[key] || key || ''
}
function parseFraction(value) {
  const raw = String(value || '').trim()
  if (/^\d+\/\d+$/.test(raw)) { const [a,b] = raw.split('/').map(Number); return b ? a/b : 0 }
  return number(raw)
}
function normalizeToBase(total, unit) {
  if (unit === 'oz') return { unit: 'lb', amount: total / 16 }
  if (unit === 'g') return { unit: 'kg', amount: total / 1000 }
  if (unit === 'ml') return { unit: 'l', amount: total / 1000 }
  if (unit === 'qt') return { unit: 'gal', amount: total / 4 }
  if (unit === 'pt') return { unit: 'gal', amount: total / 8 }
  return { unit, amount: total }
}

function parsePackText(value = '') {
  const raw = String(value || '').toUpperCase().replace(/×/g, 'X').replace(/\s+/g, ' ').trim()
  if (!raw) return null
  // 6/#10 CAN, 12/24 EA, 4/1 GA, 2/17.5 LB, 6/10 LBA, 1/50 LB
  let m = raw.match(/(\d+(?:\.\d+)?)\s*[\/]\s*(#?\d+(?:\.\d+)?|\d+\/\d+)\s*(LBA?|LBS?|OZ|KG|G|GA|GAL|QT|PT|ML|LT|L|CT|EA|CN|CAN|BU)\b/)
  if (m) {
    const pack = number(m[1]) || 1
    const sizeToken = m[2]
    // #10 CAN is a can designation, not ten pounds/ounces.
    if (sizeToken.startsWith('#')) return { pack_count: pack, unit_size_value: number(sizeToken.slice(1)), unit_size_unit: 'each', package_kind: 'numbered_can', package_label: `${pack}/#${number(sizeToken.slice(1))} CAN` }
    return { pack_count: pack, unit_size_value: parseFraction(sizeToken), unit_size_unit: canonicalUnit(m[3]), package_kind: /LBA/.test(m[3]) ? 'catch_weight_nominal' : 'standard', package_label: raw }
  }
  m = raw.match(/(\d+(?:\.\d+)?)\s*(LBA?|LBS?|OZ|KG|G|GA|GAL|QT|PT|ML|LT|L|CT|EA|CN|CAN|BU)\b/)
  if (m) return { pack_count: 1, unit_size_value: number(m[1]), unit_size_unit: canonicalUnit(m[2]), package_kind: /LBA/.test(m[2]) ? 'catch_weight_nominal' : 'standard', package_label: raw }
  return null
}

export function parsePackageDetails(input = {}) {
  const description = text(input.description || input.item_name || input.name)
  const packageSource = text(input.package_size || input.pack_size || input.size || input.package_description)
  const parsed = parsePackText(packageSource) || parsePackText(description) || {}
  const packCount = number(input.pack_count || input.case_pack || input.pack_qty) || parsed.pack_count || 1
  const unitSizeValue = number(input.unit_size_value || input.pack_size_value || input.size_value) || parsed.unit_size_value || 0
  const unitSizeUnit = canonicalUnit(input.unit_size_unit || input.pack_size_unit || input.size_unit) || parsed.unit_size_unit || canonicalUnit(input.unit || input.uom)
  const quantity = number(input.quantity ?? input.qty ?? input.shipped_quantity ?? input.ship_qty) || 1
  const actualWeight = number(input.actual_weight ?? input.weight ?? input.catch_weight)
  const pricingUnit = canonicalUnit(input.pricing_unit || input.price_unit)
  const unitPrice = number(input.unit_price ?? input.price ?? input.case_price)
  const lineTotal = number(input.line_total ?? input.extended_price ?? input.extension ?? input.total ?? input.amount)
  const isCatchWeight = Boolean(actualWeight > 0 && (pricingUnit === 'lb' || parsed.package_kind === 'catch_weight_nominal' || /\bLBA\b/i.test(packageSource)))
  const casePrice = isCatchWeight ? (actualWeight ? lineTotal / Math.max(quantity,1) : unitPrice) : (lineTotal ? lineTotal / Math.max(quantity,1) : unitPrice)
  const totalMeasure = isCatchWeight ? actualWeight / Math.max(quantity,1) : packCount * unitSizeValue
  const normalized = normalizeToBase(totalMeasure, isCatchWeight ? 'lb' : unitSizeUnit)
  const normalizedUnitCost = isCatchWeight && unitPrice ? unitPrice : (normalized.amount > 0 ? casePrice / normalized.amount : 0)
  const packageLabel = parsed.package_label || (unitSizeValue && unitSizeUnit ? `${packCount > 1 ? `${packCount} x ` : ''}${unitSizeValue} ${unitSizeUnit}` : packageSource || text(input.unit))

  return {
    pack_count: packCount,
    unit_size_value: unitSizeValue,
    unit_size_unit: unitSizeUnit,
    package_label: packageLabel,
    package_kind: parsed.package_kind || 'standard',
    actual_weight: actualWeight || 0,
    pricing_unit: pricingUnit || (isCatchWeight ? 'lb' : canonicalUnit(input.sales_unit || input.unit)),
    is_catch_weight: isCatchWeight,
    total_measure: Number((totalMeasure || 0).toFixed(4)),
    normalized_unit: normalized.unit,
    normalized_unit_cost: Number((normalizedUnitCost || 0).toFixed(6)),
    case_price: Number((casePrice || 0).toFixed(2)),
    calculated_extension: Number(((isCatchWeight ? actualWeight * (unitPrice || normalizedUnitCost) : quantity * (unitPrice || casePrice)) || 0).toFixed(2)),
  }
}

export function parseVendorInvoiceItem(input = {}) {
  const vendor_format = detectInvoiceVendor(input)
  const shipped = number(input.shipped_quantity ?? input.ship_qty ?? input.quantity_shipped ?? input.quantity ?? input.qty)
  const ordered = number(input.ordered_quantity ?? input.order_qty ?? input.quantity_ordered)
  const adjusted = number(input.adjusted_quantity ?? input.adjustment_qty)
  const description = text(input.description || input.item_name || input.name)
  const itemNumber = text(input.vendor_item_number || input.item_number || input.product_number || input.sku)
  const packageSize = text(input.package_size || input.pack_size || input.size)
  const lineTotal = number(input.line_total ?? input.extended_price ?? input.extension ?? input.total ?? input.amount)
  const unitPrice = number(input.unit_price ?? input.price)
  const isSubstitution = Boolean(input.is_substitution || /^\*?SUB\*?/i.test(text(input.order_marker || input.status || input.raw_prefix)) || /\bsubstitut/i.test(description))
  const notShipped = shipped === 0 && ordered > 0
  const packageData = parsePackageDetails({ ...input, description, package_size: packageSize, quantity: shipped || input.quantity || 1, line_total: lineTotal, unit_price: unitPrice })
  const variance = lineTotal && packageData.calculated_extension ? Math.abs(lineTotal - packageData.calculated_extension) : 0
  return {
    ...input,
    vendor_format,
    item_number: itemNumber,
    vendor_item_number: itemNumber,
    description,
    quantity_ordered: ordered,
    quantity_shipped: shipped,
    quantity_adjusted: adjusted,
    quantity: shipped || number(input.quantity) || 0,
    sales_unit: text(input.sales_unit || input.unit || input.uom),
    brand: text(input.brand || input.label || input.manufacturer),
    package_size: packageSize || packageData.package_label,
    unit_price: unitPrice,
    line_total: lineTotal,
    is_substitution: isSubstitution,
    excluded_from_purchase: notShipped,
    storage_section: text(input.storage_section || input.section || input.temperature_zone),
    reconciliation_variance: Number(variance.toFixed(2)),
    needs_review: variance > 0.05 || (!itemNumber && !description) || (!lineTotal && shipped > 0),
    ...packageData,
  }
}

export function enrichInvoiceItem(item = {}) { return parseVendorInvoiceItem(item) }
