import fs from 'node:fs'
import assert from 'node:assert/strict'
import { parsePackageDetails } from '../src/core/engines/InvoiceProductEngine.js'
import { comparePrices } from '../src/core/engines/InvoiceEngine.js'
const caseItem=parsePackageDetails({quantity:1,unit:'CS',package_size:'6/750 ML',line_total:386.94,unit_price:449.94})
assert.equal(caseItem.purchase_unit,'case')
assert.equal(caseItem.pack_count,6)
assert.equal(Number(caseItem.effective_each_cost.toFixed(2)),64.49)
const bottle=parsePackageDetails({quantity:3,unit:'BTL',line_total:224.97,unit_price:74.99})
assert.equal(bottle.purchase_unit,'bottle')
assert.equal(Number(bottle.effective_each_cost.toFixed(2)),74.99)
const rows=comparePrices([{item_number:'GM',item:'Grand Marnier',date:'2026-08-07',vendor:'ABC',comparison_basis:'each',unit_cost:caseItem.effective_each_cost,purchase_unit:'case',pack_count:6},{item_number:'GM',item:'Grand Marnier',date:'2026-08-12',vendor:'ABC',comparison_basis:'each',unit_cost:bottle.effective_each_cost,purchase_unit:'bottle',pack_count:1}])
assert.equal(rows.length,1)
assert.ok(rows[0].change_percent>16 && rows[0].change_percent<17)
const css=fs.readFileSync(new URL('../src/styles/records.css',import.meta.url),'utf8')
assert.match(css,/invoice-line-grid input.*border-radius:11px/s)
const invoice=fs.readFileSync(new URL('../src/pages/Invoices.jsx',import.meta.url),'utf8')
assert.match(invoice,/Purchase Unit/)
console.log('RC3.5 invoice unit normalization and rounded UI regression passed')
