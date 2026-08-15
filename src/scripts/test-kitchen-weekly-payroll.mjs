import assert from 'node:assert/strict'
import { buildKitchenWeeklyPayroll, isMondayToSunday } from '../src/core/engines/WeeklyPayrollEngine.js'

assert.equal(isMondayToSunday('2026-08-03','2026-08-09'), true)
const employees = [
  {id:'k1',name:'Ana',job:'Kitchen',method:'Cash',basePay:500},
  {id:'k2',name:'Ben',job:'Dishwasher',method:'Check',basePay:425,extra_pay:25},
  {id:'s1',name:'Chris',job:'Waiter',method:'Check',basePay:100},
]
const rows = buildKitchenWeeklyPayroll(employees, {
  start:'2026-08-03', end:'2026-08-09', selectedEmployeeIds:['k1','k2'], groupId:'g1', groupName:'Kitchen Payroll'
})
assert.equal(rows.length,2)
assert.equal(rows[0].payroll_date,'2026-08-09')
assert.equal(rows[0].weekly_rollup,true)
assert.equal(rows[0].source,'kitchen-weekly')
assert.equal(rows[0].regular_pay,500)
assert.equal(rows[0].total,500)
assert.equal(rows[1].total,450)
assert.equal(rows[1].payment_method,'Check')
assert.equal(rows[1].group_id,'g1')
console.log('Kitchen weekly payroll engine test passed.')
