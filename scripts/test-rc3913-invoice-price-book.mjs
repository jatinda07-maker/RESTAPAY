import assert from 'node:assert/strict'
import {authoritativeInvoiceDate,dueDateFromTerms,normalizePaymentTerms,reconcileInvoiceExtraction,buildPriceHistory,comparePrices} from '../core/engines/InvoiceEngine.js'

assert.equal(authoritativeInvoiceDate({invoice_date:'08/18/2026',date_ordered:'08/17/2026'}),'2026-08-18')
assert.equal(normalizePaymentTerms('NET 14 DAYS'),'Net 14')
assert.equal(dueDateFromTerms('2026-08-18','NET 14 DAYS'),'2026-09-01')

const recon=reconcileInvoiceExtraction({
 lines:[{description:'A',quantity:1,unit_price:3370.01,line_total:3370.01,purchase_unit:'Case'}],
 printedSubtotal:3369.81,printedTotal:3356.35,summaryDiscount:25,charges:9,tax:2.54
})
assert.equal(recon.calculated_total,3356.35)
assert.equal(recon.needs_review,false)
assert.equal(recon.reconciled,true)
assert.equal(recon.line_variance,0.20)
assert.equal(recon.line_variance_needs_review,true)

const invoices=[
 {id:'i1',vendor:'Vendor A',date:'2026-08-17',lines:[{id:'a',description:'AVOCADO HASS RIPE STG 4-5 #2',category:'Food',quantity:1,purchase_unit:'Case',package_size:'60 EA',unit_price:36.99,line_total:36.99,comparison_basis:'each',effective_each_cost:.6165}]},
 {id:'i2',vendor:'Vendor B',date:'2026-08-18',lines:[{id:'b',description:'AVOCADO HASS RIPE STAGE 4-5 #2',category:'Food',quantity:1,purchase_unit:'Case',package_size:'60 EA',unit_price:33,line_total:33,comparison_basis:'each',effective_each_cost:.55}]}
]
const comparisons=comparePrices(buildPriceHistory(invoices))
const multi=comparisons.find(x=>x.vendor_count===2)
assert.ok(multi,'AI-similar item descriptions should share a comparable price family')
assert.equal(multi.best_vendor,'Vendor B')
assert.equal(multi.best_price,.55)

console.log('RC3.9.13 invoice terms, discount reconciliation, and vendor price book regression passed')
