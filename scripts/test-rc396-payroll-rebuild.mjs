import fs from 'node:fs'
import assert from 'node:assert/strict'
import { buildWeeklyPayroll } from '../src/core/engines/WeeklyPayrollEngine.js'
const page=fs.readFileSync(new URL('../src/pages/Payroll.jsx', import.meta.url),'utf8')
const store=fs.readFileSync(new URL('../src/data/liveDataStore.js', import.meta.url),'utf8')
assert(!page.includes("'Ready to Pay','Payroll History'"), 'Ready to Pay tab must be removed')
assert(page.includes("'Imported Labor','Weekly Payroll','Payroll History'"), 'Weekly Payroll tab must replace Ready to Pay')
assert(page.includes("markWeeklyPaidByMethod('Cash')"))
assert(page.includes("markWeeklyPaidByMethod('Check')"))
assert(store.includes("return `weekly|${employee}|${weekStart}|${weekEnd}"), 'non-kitchen weekly duplicate identity must remain employee/week based')
assert(store.includes("duplicateIds=before.map"), 'historical duplicate cleanup must remove duplicate Supabase rows')
const rows=buildWeeklyPayroll([
 {id:'a1',employee_id:'e1',employee_name:'Israel Cruz',pay_date:'2026-08-10',regular_pay:0,credit_card_tips:400,source:'toast'},
 {id:'a2',employee_id:'e1',employee_name:'Israel Cruz',pay_date:'2026-08-16',regular_pay:0,credit_card_tips:358.98,source:'toast'},
],{start:'2026-08-10',end:'2026-08-16'})
assert.equal(rows.length,1)
assert.equal(rows[0].payroll_date,'2026-08-16')
assert.equal(rows[0].tips_after_withheld,732.41)
assert.deepEqual(rows[0].source_ids,['a1','a2'])
console.log('RC3.9.6 payroll rebuild regression passed')
