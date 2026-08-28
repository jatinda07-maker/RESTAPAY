import fs from 'node:fs'
import assert from 'node:assert/strict'
import {propagateInvoiceItemMaster} from '../src/core/engines/InvoiceEngine.js'
const invoices=[
 {id:'a',lines:[{id:'1',description:'AVOCADO HASS 60 EA',category:'Food',unit_price:36.99}]},
 {id:'b',lines:[{id:'2',description:'Avocado Hass 60EA',category:'Produce',unit_price:35.50}]},
 {id:'c',lines:[{id:'3',description:'TOMATO 25 LB',category:'Produce',unit_price:20}]},
]
const changed=propagateInvoiceItemMaster(invoices,{matchDescription:'AVOCADO HASS 60 EA',description:'AVOCADO, HASS RIPE',category:'Produce'})
assert.equal(changed.changedLines,2)
assert.equal(changed.rows[0].lines[0].description,'AVOCADO, HASS RIPE')
assert.equal(changed.rows[0].lines[0].category,'Produce')
assert.equal(changed.rows[0].lines[0].original_description,'AVOCADO HASS 60 EA')
assert.equal(changed.rows[2].lines[0].description,'TOMATO 25 LB')
const page=fs.readFileSync(new URL('../src/pages/VendorComparison.jsx',import.meta.url),'utf8')
assert.match(page,/Add Category/)
assert.match(page,/Apply to Saved Entries/)
assert.match(page,/Save & Apply Everywhere/)
assert.match(page,/allInvoices/)
console.log('RC3.9.27 invoice-driven Price Book master checks passed.')
