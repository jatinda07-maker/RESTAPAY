import assert from 'node:assert/strict'
import { summarizePrimeCostDailyLabor } from '../src/core/adapters/payrollAdapter.js'
import { buildFinancialMetrics } from '../src/core/engines/FinancialReconciliation.js'
const rows=[
 {employee_name:'COOK A',job_type:'Kitchen',weekly_rollup:true,week_start:'2026-08-24',week_end:'2026-08-30',regular_pay:700},
 {employee_name:'DISH A',job_type:'Dishwasher',weekly_rollup:true,week_start:'2026-08-24',week_end:'2026-08-30',regular_pay:350},
 {employee_name:'BUS A',job_type:'Busser',weekly_rollup:true,week_start:'2026-08-24',week_end:'2026-08-30',regular_pay:140},
 {employee_name:'GM A',job_type:'General Manager',weekly_rollup:true,week_start:'2026-08-24',week_end:'2026-08-30',regular_pay:1400},
]
const daily=summarizePrimeCostDailyLabor(rows,[],{from:'2026-08-24',to:'2026-08-25'})
assert.equal(daily.operatingLabor,340) // (700+350+140)/7*2
assert.equal(daily.managementPayroll,400)
assert.deepEqual(daily.operatingDays.map(r=>r.date),['2026-08-24','2026-08-24','2026-08-24','2026-08-25','2026-08-25','2026-08-25'])
const metrics=buildFinancialMetrics({sales:[{net_sales:5000}],payrollSummary:{operatingLabor:1190,managementPayroll:1400},primeCostLabor:daily,invoices:[],expenses:[]})
assert.equal(metrics.primeLabor,740)
assert.equal(metrics.primeCostAmount,740)
assert.equal(metrics.operatingLabor,1190) // official payroll unchanged
console.log('RC3.9.30 Prime Cost daily labor allocation checks passed.')
