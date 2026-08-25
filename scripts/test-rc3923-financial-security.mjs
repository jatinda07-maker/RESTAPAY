import assert from 'node:assert/strict'
import fs from 'node:fs'
import { canonicalizePayrollRows, summarizePayroll } from '../src/core/adapters/payrollAdapter.js'
import { calculateDepartmentCosts } from '../src/core/engines/DepartmentCostEngine.js'

const daily=[
 {id:'d1',employee_name:'A',payroll_date:'2026-08-17',week_start:'2026-08-17',week_end:'2026-08-23',regular_pay:100,original_tips:50,tips_withheld:1.75,tips_after_withheld:48.25,total:148.25,job_type:'Kitchen'},
 {id:'d2',employee_name:'A',payroll_date:'2026-08-18',week_start:'2026-08-17',week_end:'2026-08-23',regular_pay:100,original_tips:50,tips_withheld:1.75,tips_after_withheld:48.25,total:148.25,job_type:'Kitchen'},
]
const rollup={id:'w1',employee_name:'A',payroll_date:'2026-08-23',week_start:'2026-08-17',week_end:'2026-08-23',weekly_rollup:true,source:'weekly-rollup',regular_pay:200,original_tips:100,tips_withheld:3.5,tips_after_withheld:96.5,total:296.5,job_type:'Kitchen'}
const canonical=canonicalizePayrollRows([...daily,rollup])
assert.equal(canonical.length,1,'weekly rollup must supersede daily rows in canonical payroll')
const summary=summarizePayroll([...daily,rollup])
assert.equal(summary.total,200,'Employee Payroll Total must be wage-only and exclude net tips')
assert.equal(summary.paymentTotal,296.5,'payment total may retain tip pass-through for cash/check reconciliation')
const dept=calculateDepartmentCosts({payrollRows:[...daily,rollup],salesRows:[{date:'2026-08-23',net_sales:1000,food_sales:1000}],spendRows:[]})
assert.equal(dept.kitchenPayroll,200,'department payroll must use canonical wage-only payroll once')

const topbar=fs.readFileSync(new URL('../src/components/Topbar.jsx',import.meta.url),'utf8')
assert.doesNotMatch(topbar,/window\.prompt\(/,'native browser PIN prompt must be removed')
assert.match(topbar,/role-pin-login/,'RESTAPAY PIN modal must be present')
console.log('RC3.9.23 financial payroll canonicalization and secure role switch checks passed.')
