import assert from 'node:assert/strict'
import { originalTips, tipsWithheld, netTips, payrollTotal } from '../src/core/engines/PayrollEngine.js'
import { toPayrollViewRow, summarizePayroll } from '../src/core/adapters/payrollAdapter.js'

const waiter = { employee_name:'James Carter', job_type:'Waiter', credit_card_tips:842, tip_deduction:29.47, regular_pay:66.03, payment_method:'Check' }
assert.equal(originalTips(waiter), 842)
assert.equal(tipsWithheld(waiter), 29.47)
assert.equal(netTips(waiter), 812.53)
assert.equal(payrollTotal(waiter), 812.53)
assert.equal(toPayrollViewRow(waiter).finalPay, '$812.53')
const summary = summarizePayroll([waiter, {employee_name:'Maria', job_type:'Kitchen', regular_pay:693, payment_method:'Cash'}])
assert.equal(summary.total, 1505.53)
assert.equal(summary.cash, 693)
assert.equal(summary.check, 812.53)
console.log('Core engine tests passed')
