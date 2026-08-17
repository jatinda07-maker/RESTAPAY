import fs from 'node:fs'
import assert from 'node:assert/strict'
import { tipsWithheld, netTips, payrollTotal } from '../src/core/engines/PayrollEngine.js'

assert.equal(netTips({original_tips:758.98,job_type:'Waiter'}),732.41,'Net tips must truncate, not round')
assert.equal(payrollTotal({original_tips:758.98,job_type:'Waiter'}),732.41,'Payroll payment must truncate to cents')
assert.ok(Math.abs(tipsWithheld({original_tips:758.98})-26.5643)<1e-9,'Withholding precision must remain available internally')
const payroll=fs.readFileSync('src/pages/Payroll.jsx','utf8')
assert.match(payroll,/Undo Paid \/ restore source labor/)
assert.match(payroll,/Permanently delete payroll record and linked source rows/)
assert.match(payroll,/sourceIds\.has\(String\(item\.id\)\)/)
const store=fs.readFileSync('src/data/liveDataStore.js','utf8')
assert.match(store,/truncateMoney\(grossTips-tipsWithheld\)/)
console.log('RC3.9.4 payroll delete synchronization and truncation regression passed')
