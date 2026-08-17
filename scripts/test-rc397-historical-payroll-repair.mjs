import assert from 'node:assert/strict'
import { buildHistoricalPayrollRepair } from '../src/core/engines/WeeklyPayrollEngine.js'
import fs from 'node:fs'

const rows = [
  {id:'a1', employee_id:'angelica', employee_name:'Angelica Rueda', source:'toast', payroll_date:'2026-08-03', hours:10.2, regular_pay:0, original_tips:100, payment_method:'Check', payroll_status:'rolled-up'},
  {id:'a2', employee_id:'angelica', employee_name:'Angelica Rueda', source:'toast', payroll_date:'2026-08-08', hours:25.7, regular_pay:0, original_tips:200, payment_method:'Check', payroll_status:'rolled-up'},
  {id:'t700', employee_id:'tommy', employee_name:'TOMMY', source:'kitchen-weekly', weekly_rollup:true, payroll_week_start:'2026-08-03', payroll_week_end:'2026-08-09', payroll_date:'2026-08-09', regular_pay:700, extra_pay:0, total:700, payment_method:'Cash', payment_status:'Paid'},
  {id:'t25a', employee_id:'tommy', employee_name:'TOMMY', source:'kitchen-weekly', weekly_rollup:true, payroll_week_start:'2026-08-03', payroll_week_end:'2026-08-09', payroll_date:'2026-08-09', regular_pay:25, extra_pay:0, total:25, payment_method:'Cash', payment_status:'Paid'},
  {id:'t25b', employee_id:'tommy', employee_name:'TOMMY', source:'kitchen-weekly', weekly_rollup:true, payroll_week_start:'2026-08-03', payroll_week_end:'2026-08-09', payroll_date:'2026-08-09', regular_pay:25, extra_pay:0, total:25, payment_method:'Cash', payment_status:'Paid'},
]

const repair = buildHistoricalPayrollRepair(rows,{start:'2026-08-03',end:'2026-08-09'})
assert.equal(repair.checkRows.length,1)
assert.equal(repair.checkRows[0].employee_name,'Angelica Rueda')
assert.equal(repair.checkRows[0].hours,35.9)
assert.equal(repair.kitchenRows.length,1)
assert.equal(repair.kitchenRows[0].employee_name,'TOMMY')
assert.equal(repair.kitchenRows[0].regular_pay,700)
assert.equal(repair.kitchenRows[0].extra_pay,25)
assert.equal(repair.kitchenRows[0].total,725)
assert.equal(repair.kitchenRows[0].payment_status,'Paid')
assert.equal(repair.rows.length,2)
assert.equal(repair.reviewCount,0)
const store = fs.readFileSync(new URL('../src/data/liveDataStore.js', import.meta.url),'utf8')
assert.match(store,/weekly-component\|\$\{employee\}/)
assert.match(store,/source === 'kitchen-weekly'/)
console.log('RC3.9.7 historical payroll repair regression passed')
