import { enrichInvoiceItem, normalizeVendorName } from './InvoiceProductEngine.js'

const n = value => Number(String(value ?? 0).replace(/[$,%(),]/g, '').replaceAll(',', '')) || 0
const text = value => String(value ?? '').trim()
const isoDate = value => {
  const raw=text(value); if(!raw)return ''
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if(!m)return ''
  return `${m[3]}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`
}
export const PAYMENT_TERMS=['Due on Receipt','Net 7','Net 14','Net 15','Net 30','Net 45','Net 60','Custom']
export function normalizePaymentTerms(value=''){const v=text(value).toLowerCase().replace(/\s+/g,' ');if(!v)return '';if(/due\s*(on\s*)?receipt|cod/.test(v))return 'Due on Receipt';const m=v.match(/net\s*(7|14|15|30|45|60)\s*(day|days)?/);return m?`Net ${m[1]}`:text(value)}
export function dueDateFromTerms(invoiceDate,terms){const date=isoDate(invoiceDate);const normalized=normalizePaymentTerms(terms);if(!date||!normalized)return '';const days=normalized==='Due on Receipt'?0:Number((normalized.match(/Net (\d+)/)||[])[1]);if(!Number.isFinite(days))return '';const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function authoritativeInvoiceDate(data={}){return isoDate(data.invoice_date||data.date)||''}

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
  const taxAmount = Number(n(tax).toFixed(2))
  const chargeAmount = Number(n(charges).toFixed(2))
  const tolerance = 0.02
  const inferredProductTotal = total ? Number((total - chargeAmount - taxAmount + discount).toFixed(2)) : 0
  const extractedMathTotal = Number(((subtotal || lineSubtotal) + chargeAmount + taxAmount - discount).toFixed(2))
  const extractedSubtotalConflictsWithFinal = Boolean(total && subtotal && inferredProductTotal > 0 && Math.abs(extractedMathTotal - total) > tolerance)
  // When the invoice final total, tax and invoice-level charges reconcile cleanly, derive
  // the printed Product Total from that authoritative summary. This prevents a bad AI
  // Product Total extraction from being presented as authoritative (US Foods case).
  const productTotal = extractedSubtotalConflictsWithFinal ? inferredProductTotal : (subtotal || inferredProductTotal || lineSubtotal)
  const calculatedTotal = Number((productTotal + chargeAmount + taxAmount - discount).toFixed(2))
  const mismatches = []
  const warnings = []
  const lineVariance = Number((lineSubtotal-productTotal).toFixed(2))

  // A line-item sum can differ slightly from the vendor's printed Product Total because
  // of printed credits/allowances or extraction precision. Report that variance separately.
  // It must not make a correctly reconciled invoice-summary total look invalid.
  if (Math.abs(lineVariance) > tolerance) {
    warnings.push(`line items total ${lineSubtotal.toFixed(2)} differs from printed Product Total ${productTotal.toFixed(2)} by ${lineVariance.toFixed(2)}`)
  }
  if (total && Math.abs(calculatedTotal - total) > tolerance) {
    mismatches.push(`invoice math ${calculatedTotal.toFixed(2)} does not match printed final total ${total.toFixed(2)} (difference ${(calculatedTotal-total).toFixed(2)})`)
  }
  if (net && total && Math.abs(net-total) > tolerance && !subtotal) {
    mismatches.push(`printed net/delivered amount ${net.toFixed(2)} does not match printed final total ${total.toFixed(2)}`)
  }

  return {
    lines: normalized,
    line_subtotal: lineSubtotal,
    printed_subtotal: productTotal,
    extracted_printed_subtotal: subtotal,
    inferred_product_total: inferredProductTotal,
    product_total_inferred: extractedSubtotalConflictsWithFinal,
    product_total: productTotal,
    printed_net: net,
    printed_total: total,
    summary_discount: discount,
    tax: taxAmount,
    charges: chargeAmount,
    calculated_total: calculatedTotal,
    reconciled: mismatches.length === 0,
    needs_review: mismatches.length > 0,
    line_variance: lineVariance,
    line_variance_needs_review: Math.abs(lineVariance) > tolerance,
    warnings,
    mismatches,
    authoritative_total: total || (mismatches.length === 0 ? calculatedTotal : 0) || net || productTotal,
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
    date: authoritativeInvoiceDate(invoice),
    payment_terms: normalizePaymentTerms(invoice.payment_terms || invoice.terms || ''),
    due_date: isoDate(invoice.due_date) || dueDateFromTerms(invoice.date || invoice.invoice_date, invoice.payment_terms || invoice.terms),
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

export function invoiceItemIdentity(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\b\d+(?:\.\d+)?\s*(lb|lbs|oz|kg|g|gal|qt|pt|ml|l|ct|count|ea|each|pk|pack|case|cs)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|and|of|size|case|pack|each)\b/g, ' ')
    .trim().replace(/\s+/g, ' ')
}


export function applyLearnedInvoiceCategories(lines = [], invoices = []) {
  const memory = new Map()
  ;(Array.isArray(invoices) ? invoices : []).forEach(invoice => {
    ;(invoice?.lines || invoice?.items || []).forEach(line => {
      const key = invoiceItemIdentity(line?.description || line?.item_name || line?.name)
      const category = String(line?.category || '').trim()
      if (key && category && !/^other$/i.test(category)) memory.set(key, category)
    })
  })
  return (Array.isArray(lines) ? lines : []).map(line => {
    const key = invoiceItemIdentity(line?.description || line?.item_name || line?.name)
    const learned = key ? memory.get(key) : ''
    return learned ? { ...line, category: learned, category_source: 'history' } : line
  })
}

export function propagateInvoiceCategories(invoices = [], referenceLines = []) {
  const rules = new Map()
  ;(Array.isArray(referenceLines) ? referenceLines : []).forEach(line => {
    const key = invoiceItemIdentity(line?.description || line?.item_name || line?.name)
    const category = String(line?.category || '').trim()
    if (key && category) rules.set(key, category)
  })
  let changedLines = 0
  const rows = (Array.isArray(invoices) ? invoices : []).map(invoice => {
    let changed = false
    const lines = (invoice?.lines || invoice?.items || []).map(line => {
      const key = invoiceItemIdentity(line?.description || line?.item_name || line?.name)
      const category = rules.get(key)
      if (!category || String(line?.category || '') === category) return line
      changed = true; changedLines += 1
      return { ...line, category, category_source: 'learned-correction' }
    })
    return changed ? { ...invoice, lines, items: invoice.items ? lines : invoice.items, category_learning_updated_at: new Date().toISOString() } : invoice
  })
  return { rows, changedLines, ruleCount: rules.size }
}


export function propagateInvoiceItemMaster(invoices = [], { matchDescription = '', description = '', category = '' } = {}) {
  const matchKey = invoiceItemIdentity(matchDescription)
  const nextDescription = String(description || '').trim()
  const nextCategory = String(category || '').trim()
  if (!matchKey || (!nextDescription && !nextCategory)) return { rows: Array.isArray(invoices) ? invoices : [], changedLines: 0 }
  let changedLines = 0
  const rows = (Array.isArray(invoices) ? invoices : []).map(invoice => {
    let changed = false
    const lines = (invoice?.lines || invoice?.items || []).map(line => {
      const currentDescription = line?.description || line?.item_name || line?.name || ''
      if (invoiceItemIdentity(currentDescription) !== matchKey) return line
      const patch = {}
      if (nextDescription && String(currentDescription).trim() !== nextDescription) {
        patch.original_description = line?.original_description || String(currentDescription).trim()
        patch.description = nextDescription
      }
      if (nextCategory && String(line?.category || '').trim() !== nextCategory) {
        patch.category = nextCategory
        patch.category_source = 'price-book-master'
      }
      if (!Object.keys(patch).length) return line
      changed = true
      changedLines += 1
      return { ...line, ...patch, price_book_updated_at: new Date().toISOString() }
    })
    return changed ? { ...invoice, lines, items: invoice.items ? lines : invoice.items, price_book_updated_at: new Date().toISOString() } : invoice
  })
  return { rows, changedLines }
}

export function buildPriceHistory(invoices = []) {
  const history = []
  invoices.forEach(invoice => {
    const normalized = normalizeInvoice(invoice)
    normalized.lines.forEach(line => {
      if (!line.description) return
      const normalizedCost = n(line.effective_each_cost || line.normalized_unit_cost || line.unit_price || line.case_price)
      const comparableQuantity = n(line.total_measure) || (n(line.pack_count) > 1 ? n(line.pack_count) : 1)
      history.push({
        id: `${invoice.id}-${line.id}`,
        invoice_id: invoice.id,
        invoice_number: normalized.number,
        date: normalized.date,
        vendor: normalized.vendor,
        vendor_key: normalized.vendor_key,
        item_number: line.item_number,
        item: line.description,
        item_key: invoiceItemIdentity(line.description),
        category: line.category || normalized.category,
        package_size: line.package_size,
        quantity: line.quantity,
        comparable_quantity: comparableQuantity,
        case_price: line.case_price || (line.quantity ? line.line_total / line.quantity : line.line_total),
        unit_cost: normalizedCost,
        effective_each_cost: line.effective_each_cost || 0,
        normalized_unit_cost: line.normalized_unit_cost || 0,
        purchase_unit: line.purchase_unit || 'each',
        pack_count: line.pack_count || 0,
        comparison_basis: line.comparison_basis || line.normalized_unit || line.purchase_unit || '',
        normalized_unit: line.normalized_unit,
      })
    })
  })
  return history.sort((a,b) => String(a.date).localeCompare(String(b.date)))
}

export function invoiceItemSimilarity(a={},b={}){
  const basisA=String(a.comparison_basis||a.normalized_unit||a.purchase_unit||'').toLowerCase()
  const basisB=String(b.comparison_basis||b.normalized_unit||b.purchase_unit||'').toLowerCase()
  if(basisA&&basisB&&basisA!==basisB)return 0
  if(a.item_number&&b.item_number&&String(a.item_number)===String(b.item_number))return 1
  const stop=new Set(['fresh','raw','ref','shlf','bulk','case','cs','ea','each','pack','food','foods'])
  const tokens=v=>new Set(invoiceItemIdentity(v).split(' ').filter(x=>x.length>1&&!stop.has(x)))
  const A=tokens(a.item||a.description),B=tokens(b.item||b.description);if(!A.size||!B.size)return 0
  let shared=0;A.forEach(x=>{if(B.has(x))shared++});return shared/Math.max(A.size,B.size)
}
export function buildVendorPriceBook(history=[]){
  const rows=(Array.isArray(history)?history:[]).filter(r=>n(r.unit_cost||r.case_price)>0)
  return rows.map(row=>{
    const family=rows.filter(candidate=>candidate===row||invoiceItemSimilarity(row,candidate)>=0.72)
    const byVendor=new Map();family.forEach(candidate=>{const key=String(candidate.vendor_key||candidate.vendor||'').toLowerCase();const prev=byVendor.get(key);if(!prev||String(candidate.date||'')>String(prev.date||''))byVendor.set(key,candidate)})
    const latest=[...byVendor.values()].sort((a,b)=>n(a.unit_cost||a.case_price)-n(b.unit_cost||b.case_price))
    const best=latest[0]||row
    return {...row,family_key:invoiceItemIdentity(row.item),vendor_options:latest,best_vendor:best.vendor,best_price:n(best.unit_cost||best.case_price),match_confidence:latest.length>1?'AI matched':'History only'}
  })
}

export function comparePrices(history = []) {
  const groups = new Map()
  const representatives=[]
  history.forEach(row => {
    const identity = row.item_key || invoiceItemIdentity(row.item)
    const basis = String(row.comparison_basis || row.normalized_unit || row.purchase_unit || '').toLowerCase()
    if (!identity || !basis) return
    let rep=representatives.find(x=>x.basis===basis && invoiceItemSimilarity(x.row,row)>=0.72)
    if(!rep){rep={key:`${identity}|${basis}`,basis,row};representatives.push(rep)}
    if (!groups.has(rep.key)) groups.set(rep.key, [])
    groups.get(rep.key).push(row)
  })
  return [...groups.values()].map(rows => {
    const sorted = [...rows].sort((a,b)=>String(a.date).localeCompare(String(b.date)))
    const latest = sorted[sorted.length-1]
    const previous = sorted.length > 1 ? sorted[sorted.length-2] : latest
    const currentPrice = n(latest.unit_cost || latest.case_price)
    const previousPrice = n(previous.unit_cost || previous.case_price)
    const comparableRows = sorted.filter(r=>n(r.unit_cost || r.case_price)>0)
    const best = [...comparableRows].sort((a,b)=>n(a.unit_cost||a.case_price)-n(b.unit_cost||b.case_price))[0] || latest
    const high = [...comparableRows].sort((a,b)=>n(b.unit_cost||b.case_price)-n(a.unit_cost||a.case_price))[0] || latest
    const vendorCount = new Set(comparableRows.map(r=>String(r.vendor_key||r.vendor||'').toLowerCase()).filter(Boolean)).size
    const change = currentPrice - previousPrice
    const changePercent = previousPrice ? change / previousPrice * 100 : 0
    const savingsPerUnit = Math.max(0,currentPrice - n(best.unit_cost||best.case_price))
    const comparableQuantity = Math.max(1,n(latest.comparable_quantity)||1)
    const potentialSavings = savingsPerUnit * comparableQuantity
    return {
      key: `${latest.item_key || latest.item}-${latest.comparison_basis || latest.normalized_unit || ''}`,
      item: latest.item,
      item_key: latest.item_key,
      item_number: latest.item_number,
      category: latest.category,
      package_size: latest.package_size,
      purchase_unit: latest.purchase_unit,
      pack_count: latest.pack_count,
      comparison_basis: latest.comparison_basis || latest.normalized_unit || '',
      comparable_quantity: comparableQuantity,
      previous_price: previousPrice,
      current_price: currentPrice,
      change: Number(change.toFixed(4)),
      change_percent: Number(changePercent.toFixed(2)),
      vendor: latest.vendor,
      best_vendor: best.vendor,
      best_price: n(best.unit_cost || best.case_price),
      highest_vendor: high.vendor,
      highest_price: n(high.unit_cost || high.case_price),
      vendor_count: vendorCount,
      savings_per_unit: Number(savingsPerUnit.toFixed(4)),
      savings: Number(potentialSavings.toFixed(2)),
      potential_savings: Number(potentialSavings.toFixed(2)),
      match_confidence: vendorCount > 1 ? (new Set(comparableRows.map(r=>r.item_key||invoiceItemIdentity(r.item))).size>1 ? 'AI similar' : 'Exact') : 'History only',
      previous_row: previous,
      current_row: latest,
      comparison_rows: [
        { ...previous, comparison_role: 'Previous' },
        { ...latest, comparison_role: 'Current' },
      ],
      history: sorted,
    }
  }).sort((a,b)=>b.change_percent-a.change_percent)
}
