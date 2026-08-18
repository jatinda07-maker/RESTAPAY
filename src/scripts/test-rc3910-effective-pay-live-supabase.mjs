import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { effectivePayRate, normalizeEffectiveWeekStart } from '../core/engines/PayRateEngine.js'
import { buildKitchenWeeklyPayroll } from '../core/engines/WeeklyPayrollEngine.js'

const rates=[
  {id:'r1',employee_id:'tommy',amount:600,effective_date:'2026-07-01'},
  {id:'r2',employee_id:'tommy',amount:700,effective_date:'2026-08-03'},
  {id:'r3',employee_id:'tommy',amount:750,effective_date:'2026-09-07'},
]
assert.equal(effectivePayRate(rates,'tommy','2026-08-02',0),600)
assert.equal(effectivePayRate(rates,'tommy','2026-08-03',0),700)
assert.equal(effectivePayRate(rates,'tommy','2026-09-06',0),700)
assert.equal(effectivePayRate(rates,'tommy','2026-09-07',0),750)
assert.equal(normalizeEffectiveWeekStart('2026-08-09'),'2026-08-03')

const employee={id:'tommy',name:'TOMMY',job:'Busser',method:'Cash',basePay:600}
const oldWeek=buildKitchenWeeklyPayroll([employee],{start:'2026-07-27',end:'2026-08-02',selectedEmployeeIds:['tommy'],payRates:rates})[0]
const newWeek=buildKitchenWeeklyPayroll([employee],{start:'2026-08-03',end:'2026-08-09',selectedEmployeeIds:['tommy'],payRates:rates})[0]
assert.equal(oldWeek.regular_pay,600,'Historical week must keep the historical effective rate')
assert.equal(newWeek.regular_pay,700,'New week must use the effective-dated rate')

const root=path.resolve(process.cwd())
const store=fs.readFileSync(path.join(root,'src/data/liveDataStore.js'),'utf8')
const employees=fs.readFileSync(path.join(root,'src/pages/Employees.jsx'),'utf8')
const payroll=fs.readFileSync(path.join(root,'src/pages/Payroll.jsx'),'utf8')
const persistent=fs.readFileSync(path.join(root,'src/hooks/usePersistentState.js'),'utf8')
const migration=fs.readFileSync(path.join(root,'supabase/migrations/005_employee_pay_rate_history.sql'),'utf8')
const settingsMigration=fs.readFileSync(path.join(root,'supabase/migrations/006_restapay_live_app_settings.sql'),'utf8')

assert.match(store,/restapay-pay-rates/)
assert.match(store,/employee_pay_rates/)
assert.match(store,/app_settings/)
assert.match(store,/postgres_changes[\s\S]*app_settings/)
assert.match(store,/restapay-cost-settings/)
assert.match(store,/restapay-labor-classification/)
assert.match(persistent,/isLiveSettingKey/)
assert.match(persistent,/replaceLiveSetting/)
assert.match(employees,/Change Pay Rate/)
assert.match(employees,/Historical payroll was not changed/)
assert.match(employees,/effectiveDate/)
assert.match(payroll,/restapay-pay-rates/)
assert.match(payroll,/payRates/)
assert.match(migration,/employee_pay_rates/)
assert.match(settingsMigration,/app_settings/)

console.log('RC3.9.10 effective-dated pay rates + project-wide Supabase settings regression passed')
