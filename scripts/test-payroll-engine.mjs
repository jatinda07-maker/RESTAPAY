import assert from 'node:assert/strict'
import { netTips, originalTips, payrollTotal, groupPayrollByEmployee } from '../src/engine/PayrollEngine.js'

const tipped = { employee_name: 'Server', regular_pay: 0, original_tips: 100, tip_deduction: 3.5, tips: 96.5, extra_pay: 10 }
assert.equal(originalTips(tipped), 100)
assert.equal(netTips(tipped), 96.5)
assert.equal(payrollTotal(tipped), 106.5)

const legacyTipped = { employee_name: 'Legacy Server', regular_pay: 0, original_tips: 100, tip_deduction: 3.5, extra_pay: 0 }
assert.equal(netTips(legacyTipped), 96.5)
assert.equal(payrollTotal(legacyTipped), 96.5)

const hourly = { employee_name: 'Cook', regular_pay: 400, overtime_pay: 25, tips: 0, extra_pay: 20 }
assert.equal(payrollTotal(hourly), 445)

const explicit = { employee_name: 'Manager', total_pay: 900, regular_pay: 800, extra_pay: 200 }
assert.equal(payrollTotal(explicit), 900)

const groups = groupPayrollByEmployee([
  { employee_id: '1', employee_name: 'Cook', pay_date: '2026-07-02', regular_pay: 100 },
  { employee_id: '1', employee_name: 'Cook', pay_date: '2026-07-01', regular_pay: 100, extra_pay: 5 }
])
assert.equal(groups.length, 1)
assert.equal(groups[0].total, 205)
assert.deepEqual(groups[0].rows.map(row => row.pay_date), ['2026-07-01', '2026-07-02'])

console.log('Payroll engine tests passed')
