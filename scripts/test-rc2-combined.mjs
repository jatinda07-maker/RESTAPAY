import fs from 'node:fs'
import assert from 'node:assert/strict'
import { calculateDepartmentCosts, DEFAULT_ALLOCATION_RULES } from '../src/core/engines/DepartmentCostEngine.js'

const payrollSource = fs.readFileSync('src/pages/Payroll.jsx','utf8')
const dashboardSource = fs.readFileSync('src/pages/Dashboard.jsx','utf8')
const settingsSource = fs.readFileSync('src/pages/Settings.jsx','utf8')
const foodAlcoholSource = fs.readFileSync('src/pages/FoodAlcoholCost.jsx','utf8')

assert.match(payrollSource, /paid_history:paymentForm\.payment_status === 'Paid'/)
assert.match(payrollSource, /status_updated_via:'single-payment'/)
assert.match(payrollSource, /status_updated_via:'bulk-action'/)
assert.match(payrollSource, /prepareNextPayrollWeek/)
assert.match(payrollSource, /Next payroll week prepared automatically/)
assert.match(payrollSource, /\['payment_date','paid_date','pay_date','payroll_date','date'\]/)
assert.match(dashboardSource, /Food vs Alcohol Cost/)
assert.match(dashboardSource, /Supplies \+ Shared Costs/)
assert.match(settingsSource, /Cost Allocation/)
assert.match(payrollSource, /\['ready','ready to pay','approved','pending'\]\.includes\(status\)/)
assert.match(payrollSource, /setActiveTab\(status === 'paid' \? 'Payroll History'/)
assert.match(payrollSource, /applyGlobalDateRange/)
assert.match(foodAlcoholSource, /cost-compare-grid/)
assert.match(foodAlcoholSource, /Full allocated department economics/)
assert.match(foodAlcoholSource, /Cleaning \/ Cintas \/ Utilities \/ Insurance \/ Other/)
assert.equal(DEFAULT_ALLOCATION_RULES.managerPayroll.food, 50)
assert.equal(DEFAULT_ALLOCATION_RULES.managerPayroll.alcohol, 50)
assert.equal(DEFAULT_ALLOCATION_RULES.utilities.food, 70)
assert.equal(DEFAULT_ALLOCATION_RULES.utilities.alcohol, 30)

const result = calculateDepartmentCosts({
  salesRows:[{date:'2026-08-01', net_sales:10000, food_sales:7000, alcohol_sales:3000}],
  payrollRows:[
    {employee_name:'General Manager', job_type:'General Manager', total_pay:1000},
    {employee_name:'Cook', job_type:'Kitchen', total_pay:1200},
    {employee_name:'Bartender', job_type:'Bartender', total_pay:500}
  ],
  spendRows:[
    {name:'Paper Supplies', category:'Supplies', amount:200, _source_table:'expenses'},
    {name:'Electric Bill', category:'Utilities', amount:100, _source_table:'expenses'},
    {name:'General overhead', category:'Other', amount:80, _source_table:'expenses'}
  ],
  settings:{departmentAllocations:{
    managerPayroll:{food:60,alcohol:40},
    supplies:{food:75,alcohol:25},
    utilities:{food:70,alcohol:30},
    otherShared:{food:50,alcohol:50}
  }}
})
assert.equal(result.managerFood, 600)
assert.equal(result.managerAlcohol, 400)
assert.equal(result.foodSupplies, 150)
assert.equal(result.rules.utilities.food, 70)
assert.ok(result.foodShared >= 110)
assert.ok(result.alcoholShared >= 80)
console.log('RC2 hotfix regression passed: saved payroll visibility, date-range reveal, paid history, allocations and side-by-side comparison are wired.')
