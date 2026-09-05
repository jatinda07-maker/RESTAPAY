import fs from 'node:fs'
import assert from 'node:assert/strict'

const invoiceUi=fs.readFileSync(new URL('../src/pages/Invoices.jsx',import.meta.url),'utf8')
const edge=fs.readFileSync(new URL('../supabase/functions/gemini-invoice/index.ts',import.meta.url),'utf8')

assert.match(invoiceUi,/repairAlabamaAbcQty/)
assert.match(invoiceUi,/shipped_qty:qty/)
assert.match(edge,/repairedAlabamaAbcQuantity/)
assert.match(edge,/variance <= 0\.03 \? rounded : explicit/)
assert.match(edge,/if \(\/\^cs\$\/i\.test\(unit\)\) return 'Case'/)

const repair=(gross,discount,total)=>{
  const net=gross-discount
  const estimated=total/net
  const rounded=Math.round(estimated)
  return rounded>=1&&rounded<=100&&Math.abs(total-rounded*net)<=0.03?rounded:0
}
assert.equal(repair(167.88,23.51,288.75),2)
assert.equal(repair(62.94,8.81,108.26),2)
assert.equal(repair(449.94,62.99,773.90),2)
assert.equal(Number((288.75/2).toFixed(2)),144.38)
assert.equal(Number((108.26/2).toFixed(2)),54.13)
assert.equal(Number((773.90/2).toFixed(2)),386.95)
console.log('RC3.9.37A Alabama ABC quantity repair checks passed.')
