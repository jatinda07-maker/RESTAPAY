import assert from 'node:assert/strict'
import { buildPriceHistory, calculateInvoice, comparePrices, normalizeInvoice } from '../src/core/engines/InvoiceEngine.js'
const first = normalizeInvoice({id:'i1',vendor:'US Foods',number:'1',date:'2026-07-01',category:'Food',tax:5,lines:[{description:'Chicken Breast',quantity:2,package_size:'2/10 LB',unit_price:40,line_total:80,category:'Food'}]})
assert.equal(calculateInvoice(first.lines,5,0).total,85)
const second = normalizeInvoice({id:'i2',vendor:'Sysco',number:'2',date:'2026-08-01',category:'Food',lines:[{description:'Chicken Breast',quantity:2,package_size:'2/10 LB',unit_price:44,line_total:88,category:'Food'}]})
const history=buildPriceHistory([first,second]); assert.equal(history.length,2)
const comparison=comparePrices(history); assert.equal(comparison.length,1); assert.ok(comparison[0].change_percent>0)
console.log('Invoice engine tests passed')
