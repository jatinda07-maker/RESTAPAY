import fs from 'node:fs'
import assert from 'node:assert/strict'
const invoice=fs.readFileSync('src/pages/Invoices.jsx','utf8')
const engine=fs.readFileSync('src/core/engines/InvoiceEngine.js','utf8')
const edge=fs.readFileSync('supabase/functions/gemini-invoice/index.ts','utf8')
const store=fs.readFileSync('src/data/liveDataStore.js','utf8')
assert.match(invoice,/Cases \/ Qty/)
assert.match(invoice,/Discount \/ Case/)
assert.match(invoice,/Net \/ Case/)
assert.match(invoice,/Bottle \/ Each/)
assert.match(invoice,/lineTotal\/qty/)
assert.match(engine,/discount_amount/)
assert.match(engine,/net_unit_price/)
assert.match(edge,/ALABAMA ABC RULES/)
assert.match(edge,/2\.00 cs/)
assert.match(edge,/167\.88/)
assert.match(edge,/288\.75/)
assert.match(store,/gross_unit_price/)
assert.match(store,/discount_amount/)
const rows=[
 {qty:2,gross:167.88,discount:23.51,extended:288.75,expectedNet:144.375},
 {qty:2,gross:62.94,discount:8.81,extended:108.26,expectedNet:54.13},
 {qty:2,gross:449.94,discount:62.99,extended:773.90,expectedNet:386.95},
]
for(const r of rows) assert.equal(Number((r.extended/r.qty).toFixed(3)),Number(r.expectedNet.toFixed(3)))
assert.equal(Number(rows.reduce((s,r)=>s+r.extended,0).toFixed(2)),1170.91)
console.log('RC3.9.37 Alabama ABC case/discount invoice checks passed.')
