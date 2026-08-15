import assert from 'node:assert/strict'
import {findDuplicateInvoices} from '../src/core/engines/InvoiceEngine.js'

const existing=[
  {id:'a',vendor:'US Foods',number:'INV-100',date:'2026-08-02',total:152.44,lines:[{description:'Fries'},{description:'Chicken'}]},
  {id:'b',vendor:'US Foods',number:'',date:'2026-07-27',total:89.10,lines:[{description:'Onions'}]},
  {id:'c',vendor:'Sysco',number:'S-9',date:'2026-08-02',total:152.44,lines:[{description:'Fries'}]},
]
let matches=findDuplicateInvoices({vendor:'US Foods',number:'inv 100',date:'2026-08-05',total:200},existing)
assert.equal(matches[0]?.id,'a')
assert.equal(matches[0]?.severity,'exact')

matches=findDuplicateInvoices({vendor:'US Foods',number:'',date:'2026-07-27',total:89.10},existing)
assert.equal(matches[0]?.id,'b')
assert.equal(matches[0]?.severity,'exact')

matches=findDuplicateInvoices({vendor:'US Foods',number:'',date:'2026-08-04',total:152.44},existing)
assert.equal(matches[0]?.id,'a')
assert.equal(matches[0]?.severity,'possible')

matches=findDuplicateInvoices({vendor:'Sysco',number:'',date:'2026-08-02',total:89.10},existing)
assert.equal(matches.length,0)

console.log('Invoice duplicate detection tests passed.')
