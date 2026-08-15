import assert from 'node:assert/strict'
import { salesViewRows, summarizeSales } from '../src/core/engines/SalesViewEngine.js'
const rows = [{ id:1, business_date:'2026-07-20', net_sales:'1000', cash_sales:'200', credit_sales:'700', gift_card_sales:'25', other_payments:'75', tips_collected:'180', food_sales:'650', alcohol_sales:'350' }]
const totals = summarizeSales(rows)
assert.equal(totals.net, 1000)
assert.equal(totals.cash, 200)
assert.equal(totals.credit, 700)
assert.equal(totals.other, 100)
assert.equal(totals.tips, 180)
assert.equal(salesViewRows(rows,{tab:'Cash'})[0].view_amount,200)
assert.equal(salesViewRows(rows,{tab:'Credit'})[0].view_amount,700)
assert.equal(salesViewRows(rows,{tab:'Other'})[0].view_amount,100)
assert.equal(salesViewRows(rows,{tab:'Tips'})[0].view_amount,180)
console.log('Sales view engine tests passed.')
