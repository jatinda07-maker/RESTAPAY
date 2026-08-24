import fs from 'node:fs'
import assert from 'node:assert/strict'
import { salePaymentAmount, salePaymentLabel } from '../src/core/engines/SalesViewEngine.js'
import { normalizeInvoice } from '../src/core/engines/InvoiceEngine.js'

const expense=fs.readFileSync('src/pages/Expenses.jsx','utf8')
const sales=fs.readFileSync('src/pages/Sales.jsx','utf8')
const invoices=fs.readFileSync('src/pages/Invoices.jsx','utf8')
const css=fs.readFileSync('src/styles/records.css','utf8')

assert.match(expense, /<option>ACH<\/option>/)
assert.match(expense, /<option>Check<\/option>/)
assert.match(css, /RC2\.6 modal control alignment/)
assert.match(css, /grid-template-columns:minmax\(0,1fr\) 38px/)
assert.match(css, /checkbox-field input\[type="checkbox"\]/)
assert.match(sales, /<option>Check<\/option><option>ACH<\/option>/)
assert.equal(salePaymentAmount({payment:'Check',amount:125},'Check'),125)
assert.equal(salePaymentAmount({payment:'ACH',amount:250},'ACH'),250)
assert.equal(salePaymentLabel({payment:'ACH',amount:250,other_payments:250}),'ACH')
assert.match(invoices, /Invoice Amount <small>\(Manual Entry\)<\/small>/)
assert.match(invoices, /manual_entry:!hasDetailedLines/)
assert.match(invoices, /Enter an invoice amount or at least one line item/)
const normalized=normalizeInvoice({vendor:'Manual Vendor',date:'2026-08-10',category:'Food',total:477.70,amount:477.70,lines:[]})
assert.equal(normalized.total,477.70)
assert.equal(normalized.amount,477.70)
console.log('RC2.6 modal-entry regression passed: expense controls, ACH/check sales, and manual invoice amount are wired.')
