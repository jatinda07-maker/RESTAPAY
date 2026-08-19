import { enrichInvoiceItem, normalizeVendorName } from './InvoiceProductEngine.js'

const n = value => Number(String(value ?? 0).replace(/[$,%(),]/g, '').replaceAll(',', '')) || 0
const text = value => String(value ?? '').trim()

export const ALCOHOL_CATEGORIES = ['Beer','Wine','Liquor','Margaritas','Cocktails & Shots','Draft Beer','Bottled Beer','Alcohol']
export const FOOD_CATEGORIES = ['Food','Meat','Seafood','Produce','Dairy','Dry Goods','Frozen','Bakery']

const normalizeLooseText = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const centsEqual = (a, b, tolerance = 0.01) => Math.abs(n(a) - n(b)) <= tolerance
const dayDistance = (a, b) => {
  const da = new Date(`${a || ''}T00:00:00`)
  const db = new Date(`${b || ''}T00:00:00`)
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return Infinity
  return Math.abs(Math.round((da - db) / 86400000))
}
const lineKeys = invoice => new Set((invoice.lines || invoice.items || [])
  .map(line => normalizeLooseText(line.item_number || line.description || line.item_name || line.name))
  .filter(Boolean))
const lineSimilarity = (a, b) => {
  const left = lineKeys(a), right = lineKeys(b)
  if (!left.size || !right.size) return 0
  let shared = 0
  left.forEach(key => { if (right.has(key)) shared += 1 })
  return shared / Math.max(left.size, right.size)
}

export function findDuplicateInvoices(candidate = {}, invoices = [], options = {}) {
  const normalized = normalizeInvoice(candidate)
  const vendorKey = normalizeVendorName(normalized.vendor)
  if (!vendorKey) return []
  const currentId = options.excludeId == null ? null : String(options.excludeId)
  const invoiceNumber = normalizeLooseText(normalized.number)
  return (Array.isArray(invoices) ? invoices : []).filter(Boolean).flatMap(existing => {
    if (currentId && String(existing.id) === currentId) return []
    const row = normalizeInvoice(existing)
    if (normalizeVendorName(row.vendor) !== vendorKey) return []
    const existingNumber = normalizeLooseText(row.number)
    const sameNumber = Boolean(invoiceNumber && existingNumber && invoiceNumber === existingNumber)
    const sameDate = Boolean(normalized.date && row.date && normalized.date === row.date)
    const sameTotal = centsEqual(normalized.total, row.total)
    const dateGap = dayDistance(normalized.date, row.date)
    const similarity = lineSimilarity(normalized, row)
    let severity = null
    const reasons = []
    let score = 0

    if (sameNumber) { severity = 'exact'; reasons.push('same vendor and invoice number'); score += 100 }
    if (sameDate && sameTotal) { severity = 'exact'; reasons.push('same vendor, date and total'); score += 90 }
    if (!severity && sameDate && similarity >= 0.6) { severity = 'possible'; reasons.push('same vendor/date with similar line items'); score += 65 }
    if (!severity && sameTotal && dateGap <= 7) { severity = 'possible'; reasons.push(`same vendor and total within ${dateGap} day${dateGap === 1 ? '' : 's'}`); score += 55 }
    if (!severity && similarity >= 0.8 && dateGap <= 14) { severity = 'possible'; reasons.push('highly similar line items in a nearby date'); score += 45 }
    if (!severity) return []

    return [{
      id: existing.id,
      severity,
      score,
      reasons,
      vendor: row.vendor,
      number: row.number,
      date: row.date,
      total: row.total,
      line_similarity: Number((similarity * 100).toFixed(0)),
    }]
  }).sort((a, b) => (b.severity === 'exact') - (a.severity === 'exact') || b.score - a.score)
}

export function normalizeInvoiceLine(line = {}, index = 0) {
  const enriched = enrichInvoiceItem({
    ...line,
    description: line.description || line.item_name || line.name,
    quantity: line.quantity ?? line.qty ?? 1,
    unit_price: line.unit_price ?? line.price,
    line_total: line.line_total ?? line.total ?? line.amount,
    package_size: line.package_size || line.size,
  })
  const quantity = n(enriched.quantity || 1) || 1
  const lineTotal = n(enriched.line_total) || n(enriched.unit_price) * quantity
  return {
    id: line.id || `line-${Date.now()}-${index}`,
    item_number: text(enriched.item_number || enriched.vendor_item_number),
    description: text(enriched.description),
    category: text(line.category || line.department || 'Food'),
    quantity,
    package_size: text(enriched.package_size || enriched.package_label),
    purchase_unit: text(enriched.purchase_unit || line.purchase_unit || line.sales_unit || line.unit),
    pack_count: n(enriched.pack_count || line.pack_count),
    effective_each_cost: n(enriched.effective_each_cost),
    comparison_basis: text(enriched.comparison_basis),
    unit_price: n(enriched.unit_price),
    line_total: Number(lineTotal.toFixed(2)),
    normalized_unit: text(enriched.normalized_unit),
    normalized_unit_cost: n(enriched.normalized_unit_cost),
    case_price: n(enriched.case_price),
    needs_review: Boolean(enriched.needs_review),
  }
}

export function calculateInvoice(lines = [], tax = 0, discount = 0) {
  const normalized = lines.map(normalizeInvoiceLine)
  const subtotal = normalized.reduce((sum, line) => sum + n(line.line_total), 0)
  const total = subtotal + n(tax) - n(discount)
  return { lines: normalized, subtotal: Number(subtotal.toFixed(2)), tax: n(tax), discount: n(discount), total: Number(total.toFixed(2)) }
}


export function reconcileInvoiceExtraction({ lines = [], printedSubtotal = 0, printedNet = 0, printedTotal = 0, summaryDiscount = 0, tax = 0, charges = 0 } = {}) {
  const normalized = lines.map(normalizeInvoiceLine)
  const lineSubtotal = Number(normalized.reduce((sum, line) => sum + n(line.line_total), 0).toFixed(2))
  const subtotal = Number(n(printedSubtotal).toFixed(2))
  const net = Number(n(printedNet).toFixed(2))
  const total = Number(n(printedTotal).toFixed(2))
  const discount = Number(n(summaryDiscount).toFixed(2))
  const tolerance = 0.02
  const comparisons = [
    subtotal ? ['line subtotal', lineSubtotal, subtotal] : null,
    net && subtotal ? ['subtotal/net', subtotal, net] : null,
    total && net ? ['net/final total', Number((net + n(tax) + n(charges)).toFixed(2)), total] : null,
  ].filter(Boolean)
  const mismatches = comparisons.filter(([,a,b]) => Math.abs(a - b) > tolerance).map(([label,a,b]) => `${label}: ${a.toFixed(2)} vs ${b.toFixed(2)}`)
  return {
    lines: normalized,
    line_subtotal: lineSubtotal,
    printed_subtotal: subtotal,
    printed_net: net,
    printed_total: total,
    summary_discount: discount,
    reconciled: mismatches.length === 0,
    needs_review: mismatches.length > 0,
    mismatches,
    authoritative_total: total || net || subtotal || lineSubtotal,
  }
}

export function normalizeInvoice(invoice = {}) {
  const calc = calculateInvoice(invoice.lines || invoice.items || [], invoice.tax, invoice.discount)
  const amount = n(invoice.total ?? invoice.amount) || calc.total
  return {
    ...invoice,
    vendor: text(invoice.vendor || invoice.vendor_name),
    vendor_id: invoice.vendor_id || null,
    number: text(invoice.number || invoice.invoice_number),
    date: invoice.date || invoice.invoice_date || '',
    due_date: invoice.due_date || '',
    category: text(invoice.category || 'Food'),
    payment_type: text(invoice.payment_type || invoice.method || 'Check'),
    check_number: text(invoice.check_number || invoice.checkNumber),
    status: text(invoice.status || 'Due'),
    notes: text(invoice.notes),
    lines: calc.lines,
    subtotal: n(invoice.subtotal) || calc.subtotal,
    tax: n(invoice.tax),
    discount: n(invoice.discount),
    total: Number(amount.toFixed(2)),
    amount: Number(amount.toFixed(2)),
    source_file: text(invoice.source_file),
    vendor_key: normalizeVendorName(invoice.vendor || invoice.vendor_name),
  }
}

export function buildPriceHistory(invoices = []) {
  const history = []
  invoices.forEach(invoice => {
    const normalized = normalizeInvoice(invoice)
    normalized.lines.forEach(line => {
      if (!line.description) return
      history.push({
        id: `${invoice.id}-${line.id}`,
        invoice_id: invoice.id,
        invoice_number: normalized.number,
        date: normalized.date,
        vendor: normalized.vendor,
        vendor_key: normalized.vendor_key,
        item_number: line.item_number,
        item: line.description,
        category: line.category || normalized.category,
        package_size: line.package_size,
        quantity: line.quantity,
        case_price: line.case_price || (line.quantity ? line.line_total / line.quantity : line.line_total),
        unit_cost: line.effective_each_cost || line.normalized_unit_cost || line.unit_price,
        effective_each_cost: line.effective_each_cost || 0,
        purchase_unit: line.purchase_unit || 'each',
        pack_count: line.pack_count || 0,
        comparison_basis: line.comparison_basis || line.normalized_unit || line.purchase_unit || '',
        normalized_unit: line.normalized_unit,
      })
    })
  })
  return history.sort((a,b) => String(a.date).localeCompare(String(b.date)))
}

export function comparePrices(history = []) {
  const groups = new Map()
  history.forEach(row => {
    const key = `${String(row.item_number || '').toLowerCase()}|${String(row.item || '').toLowerCase()}|${String(row.comparison_basis || row.normalized_unit || '')}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  })
  return [...groups.values()].map(rows => {
    const sorted = [...rows].sort((a,b)=>String(a.date).localeCompare(String(b.date)))
    const first = sorted[0], latest = sorted[sorted.length-1]
    const previous = sorted.length > 1 ? sorted[sorted.length-2] : first
    const change = n(latest.unit_cost || latest.case_price) - n(previous.unit_cost || previous.case_price)
    const base = n(previous.unit_cost || previous.case_price)
    const changePercent = base ? change / base * 100 : 0
    const best = [...sorted].sort((a,b)=>n(a.unit_cost||a.case_price)-n(b.unit_cost||b.case_price))[0]
    return {
      key: `${latest.item_number || latest.item}-${latest.normalized_unit || ''}`,
      item: latest.item,
      item_number: latest.item_number,
      category: latest.category,
      package_size: latest.package_size,
      purchase_unit: latest.purchase_unit,
      pack_count: latest.pack_count,
      comparison_basis: latest.comparison_basis || latest.normalized_unit || '',
      previous_price: n(previous.unit_cost || previous.case_price),
      current_price: n(latest.unit_cost || latest.case_price),
      change: Number(change.toFixed(4)),
      change_percent: Number(changePercent.toFixed(2)),
      vendor: latest.vendor,
      best_vendor: best.vendor,
      best_price: n(best.unit_cost || best.case_price),
      history: sorted,
    }
  }).sort((a,b)=>b.change_percent-a.change_percent)
}
