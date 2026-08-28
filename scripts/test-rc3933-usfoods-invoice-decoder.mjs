import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeInvoiceLine, reconcileInvoiceExtraction } from '../src/core/engines/InvoiceEngine.js'

const tortilla = normalizeInvoiceLine({
  item_number:'59147', description:'TORTILLA, FLOUR 6" PRSSD SHLF', brand:'LA BNDRITA',
  ordered_qty:3, shipped_qty:3, adjusted_qty:0, quantity:3, sales_unit:'CS', purchase_unit:'Case',
  package_size:'12/24 EA', pricing_unit:'CS', unit_price:26.65, line_total:79.95
})
assert.equal(tortilla.quantity, 3)
assert.equal(tortilla.purchase_unit, 'case')
assert.equal(tortilla.package_size, '12/24 EA')
assert.equal(tortilla.unit_price, 26.65)
assert.equal(tortilla.line_total, 79.95)

const weighted = normalizeInvoiceLine({
  item_number:'5075743', description:'BEEF, TOP INS RND CAB 168 RAW', brand:'GRTR OMAHA',
  ordered_qty:2, shipped_qty:2, adjusted_qty:0, quantity:2, sales_unit:'CS', purchase_unit:'Case',
  package_size:'3/23.3 LBA', pricing_unit:'LB', weight:161, unit_price:5.14, line_total:827.54
})
assert.equal(weighted.quantity, 2)
assert.equal(weighted.pricing_unit, 'lb')
assert.equal(weighted.actual_weight, 161)
assert.equal(weighted.unit_price, 5.14)
assert.equal(weighted.line_total, 827.54)
assert.equal(weighted.normalized_unit_cost, 5.14)

const adjusted = normalizeInvoiceLine({
  item_number:'6512399', description:'CILANTRO, BNCH FRESH HERB BULK',
  ordered_qty:1, shipped_qty:1, adjusted_qty:-1, quantity:1, sales_unit:'CS', purchase_unit:'Case',
  package_size:'60 EA', pricing_unit:'CS', unit_price:30.79, line_total:0
})
assert.equal(adjusted.line_total, 0, 'printed $0.00 adjustment line must remain zero')

const recon = reconcileInvoiceExtraction({
  lines:[
    {quantity:3, purchase_unit:'Case', package_size:'12/24 EA', unit_price:26.65, line_total:79.95},
    {quantity:1, purchase_unit:'Case', package_size:'50 LB', unit_price:47.23, line_total:47.23}
  ],
  printedSubtotal:127.18,
  printedTotal:127.18
})
assert.equal(recon.line_subtotal,127.18)

const edge=fs.readFileSync(new URL('../supabase/functions/gemini-invoice/index.ts', import.meta.url),'utf8')
for (const required of [
  'STRICT TRANSCRIPTION RULE',
  'US FOODS RULES',
  'ordered_qty=ORD',
  'shipped_qty=SHP',
  'package_size=PACK SIZE exactly as printed',
  'pricing_unit=PRICING UNIT',
  'weight=WEIGHT',
  'qty * unit_price is NOT expected to equal total',
  'Do not infer liquor-style sizes on food invoices'
]) assert.ok(edge.includes(required), `missing extraction rule: ${required}`)

const invoices=fs.readFileSync(new URL('../src/pages/Invoices.jsx', import.meta.url),'utf8')
assert.ok(invoices.includes("line.shipped_qty??line.qty"),'review must use shipped quantity')
assert.ok(invoices.includes("line.sales_unit||line.unit"),'review must preserve printed sales unit')
assert.ok(invoices.includes("line.pricing_unit||''"),'review must preserve pricing unit')
assert.ok(invoices.includes("line.weight||0"),'review must preserve catch weight')
assert.ok(invoices.includes('Printed pack / size'),'review must not suggest liquor pack sizes')

console.log('RC3.9.33 US Foods invoice decoder checks passed.')
