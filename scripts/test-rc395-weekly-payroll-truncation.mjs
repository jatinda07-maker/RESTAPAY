import assert from 'node:assert/strict'
import { buildWeeklyPayroll } from '../src/core/engines/WeeklyPayrollEngine.js'
import { normalizePayrollRecord } from '../src/core/adapters/payrollSchemaAdapter.js'

const rows = [
  { id:'israel-1', employee_name:'Israel Cruz', payroll_date:'2026-08-10', hours:18.02, credit_card_tips:100.00, regular_pay:0, extra_pay:0 },
  { id:'israel-2', employee_name:'Israel Cruz', payroll_date:'2026-08-11', hours:10.08, credit_card_tips:120.00, regular_pay:0, extra_pay:0 },
  { id:'israel-3', employee_name:'Israel Cruz', payroll_date:'2026-08-12', hours:16.76, credit_card_tips:130.00, regular_pay:0, extra_pay:0 },
  { id:'israel-4', employee_name:'Israel Cruz', payroll_date:'2026-08-13', hours:16.80, credit_card_tips:140.00, regular_pay:0, extra_pay:0 },
  { id:'israel-5', employee_name:'Israel Cruz', payroll_date:'2026-08-14', hours:11.52, credit_card_tips:130.00, regular_pay:0, extra_pay:0 },
  { id:'israel-6', employee_name:'Israel Cruz', payroll_date:'2026-08-15', hours:16.90, credit_card_tips:138.98, regular_pay:0, extra_pay:0 },
  { id:'israel-7', employee_name:'Israel Cruz', payroll_date:'2026-08-16', hours:17.92, credit_card_tips:0, regular_pay:0, extra_pay:0 },
]

const [weekly] = buildWeeklyPayroll(rows, { start:'2026-08-10', end:'2026-08-16' })
assert.ok(weekly, 'weekly payroll row should be produced')
assert.equal(weekly.credit_card_tips, 758.98)
assert.ok(Math.abs(weekly.tips_withheld - 26.5643) < 1e-9)
assert.equal(weekly.tips_after_withheld, 732.41)
assert.equal(weekly.total, 732.41)
assert.equal(weekly.total_pay, 732.41)

const normalized = normalizePayrollRecord(weekly, { source:'weekly-rollup', method:'Check' })
assert.equal(normalized.tips_after_withheld, 732.41)
assert.equal(normalized.total, 732.41)
assert.equal(normalized.total_pay, 732.41)

console.log('PASS - Weekly payroll preserves full withholding precision')
console.log('PASS - 758.98 - 26.5643 truncates to 732.41')
console.log('PASS - Weekly payroll preview/save row carries 732.41 through normalization')
console.log('RC3.9.5 weekly payroll truncation regression passed.')
