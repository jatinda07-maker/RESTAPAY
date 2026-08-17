import fs from 'node:fs'
import assert from 'node:assert/strict'
import { reconcileInvoiceExtraction } from '../src/core/engines/InvoiceEngine.js'

const usFoods = reconcileInvoiceExtraction({
  lines:[{description:'Extracted merchandise',quantity:1,unit_price:3797.52,line_total:3797.52}],
  printedSubtotal:3775.54,
  charges:9,
  tax:2.54,
  printedTotal:3787.08,
})
assert.equal(usFoods.product_total,3775.54)
assert.equal(usFoods.calculated_total,3787.08)
assert.equal(usFoods.authoritative_total,3787.08)
assert.equal(usFoods.needs_review,true,'wrong extracted line sum must require review')
assert.ok(usFoods.mismatches.some(x=>x.includes('line items total')))
assert.ok(!usFoods.mismatches.some(x=>x.includes('invoice math')),'printed invoice summary math should reconcile')

const reconciled = reconcileInvoiceExtraction({
  lines:[{description:'Product',quantity:1,unit_price:3775.54,line_total:3775.54}],
  printedSubtotal:3775.54,charges:9,tax:2.54,printedTotal:3787.08
})
assert.equal(reconciled.needs_review,false)
assert.equal(reconciled.authoritative_total,3787.08)

const drawer=fs.readFileSync('src/components/DetailDrawer.jsx','utf8')
assert.match(drawer,/\['Business Expenses','Total Expenses'\]\.includes\(title\) \? \['Expense Categories'\]/)
assert.match(drawer,/'Total Expenses': \['Operating expenses grouped by accounting category/)
assert.match(drawer,/'Total Expenses':[\s\S]{0,500}title:'Expense Categories',rows:expenseGroups/)
assert.match(drawer,/'Profit Summary':[\s\S]{0,1000}\['Operating Labor'/)
assert.match(drawer,/'Profit Summary':[\s\S]{0,1200}\['Management Payroll'/)
assert.match(drawer,/'Profit Summary':[\s\S]{0,1400}\['Front of House Payroll'/)
assert.match(drawer,/Vendor price intelligence and normalized invoice history/)

const invoices=fs.readFileSync('src/pages/Invoices.jsx','utf8')
assert.match(invoices,/Invoice Charges/)
assert.match(invoices,/Line Items Total/)
assert.match(invoices,/Printed Product Total/)
assert.match(invoices,/Invoice does not reconcile — Save blocked/)
assert.match(invoices,/if\(currentReconciliation\?\.needs_review\)return notify/)

const prompt=fs.readFileSync('supabase/functions/gemini-invoice/index.ts','utf8')
assert.match(prompt,/product_total/)
assert.match(prompt,/fuel_surcharge/)
assert.match(prompt,/never copy a package size from a neighboring line/i)

const vendor=fs.readFileSync('src/pages/VendorComparison.jsx','utf8')
assert.match(vendor,/headerAction=/)
assert.match(vendor,/Check Sam's/)

const css=fs.readFileSync('src/styles/records.css','utf8')
assert.match(css,/\.smart-ai-upload-action\{/)
assert.match(css,/\.smart-ai-upload-action:hover/)

console.log('RC3.9.2 invoice reconciliation + semantic KPI audit passed')
