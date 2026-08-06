import assert from 'node:assert/strict'
import { buildWeeklyPayroll, isMondayToSunday } from '../src/core/engines/WeeklyPayrollEngine.js'

assert.equal(isMondayToSunday('2026-07-20','2026-07-26'), true)
const rows = [
  {id:'a1',employee_name:'Alex',pay_date:'2026-07-20',hours:5,regular_pay:50,credit_card_tips:100,tip_deduction:3.5,payment_method:'Check'},
  {id:'a2',employee_name:'Alex',pay_date:'2026-07-26',hours:6,regular_pay:60,credit_card_tips:50,tip_deduction:1.75,payment_method:'Check'},
  {id:'b1',employee_name:'Ben',pay_date:'2026-07-22',hours:8,regular_pay:120,credit_card_tips:0,tip_deduction:0,payment_method:'Cash'},
]
const weekly = buildWeeklyPayroll(rows,{start:'2026-07-20',end:'2026-07-26'})
assert.equal(weekly.length,2)
const alex=weekly.find(row=>row.employee_name==='Alex')
assert.equal(alex.pay_date,'2026-07-26')
assert.equal(alex.hours,11)
assert.equal(alex.regular_pay,110)
assert.equal(alex.credit_card_tips,150)
assert.equal(alex.tip_deduction,5.25)
assert.deepEqual(alex.source_ids,['a1','a2'])
console.log('Weekly payroll engine test passed.')
