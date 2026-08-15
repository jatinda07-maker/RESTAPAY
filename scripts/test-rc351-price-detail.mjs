import fs from 'node:fs'
import assert from 'node:assert/strict'
import { comparePrices } from '../src/core/engines/InvoiceEngine.js'

const rows=comparePrices([
  {item_number:'GM',item:'Grand Marnier',date:'2026-08-07',vendor:'Alabama ABC',invoice_number:'SINV-11876641',comparison_basis:'each',unit_cost:64.49,effective_each_cost:64.49,case_price:386.94,purchase_unit:'case',pack_count:6,package_size:'6/750 ML'},
  {item_number:'GM',item:'Grand Marnier',date:'2026-08-12',vendor:'Alabama ABC',invoice_number:'SINV-11890000',comparison_basis:'each',unit_cost:74.99,effective_each_cost:74.99,case_price:74.99,purchase_unit:'bottle',pack_count:1,package_size:'750 ML'}
])
assert.equal(rows.length,1)
assert.equal(rows[0].comparison_rows.length,2)
assert.equal(rows[0].comparison_rows[0].comparison_role,'Previous')
assert.equal(rows[0].comparison_rows[0].date,'2026-08-07')
assert.equal(rows[0].comparison_rows[1].comparison_role,'Current')
assert.equal(rows[0].comparison_rows[1].date,'2026-08-12')
assert.equal(rows[0].comparison_rows[0].purchase_unit,'case')
assert.equal(rows[0].comparison_rows[1].purchase_unit,'bottle')

const pricePage=fs.readFileSync(new URL('../src/pages/PriceIncrease.jsx',import.meta.url),'utf8')
assert.match(pricePage,/comparison_rows\|\|r\.history/)
assert.match(pricePage,/initialTab=\{typeof drawer==='string'\?'Overview':'Entries'\}/)
const drawer=fs.readFileSync(new URL('../src/components/DetailDrawer.jsx',import.meta.url),'utf8')
assert.match(drawer,/comparison_role/)
assert.match(drawer,/original .*case_price/)
assert.match(drawer,/basis .*comparison_basis/)
console.log('RC3.5.1 price increase exact comparison detail regression passed')
