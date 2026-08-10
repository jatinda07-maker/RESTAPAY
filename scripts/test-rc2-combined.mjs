import fs from 'node:fs'
import assert from 'node:assert/strict'
import { calculateDepartmentCosts, DEFAULT_ALLOCATION_RULES } from '../src/core/engines/DepartmentCostEngine.js'
import { netTips, tipsWithheld } from '../src/core/engines/PayrollEngine.js'
import { normalizePayrollRecord } from '../src/core/adapters/payrollSchemaAdapter.js'
import { buildWeeklyPayroll } from '../src/core/engines/WeeklyPayrollEngine.js'

const payrollSource = fs.readFileSync('src/pages/Payroll.jsx','utf8')
const dashboardSource = fs.readFileSync('src/pages/Dashboard.jsx','utf8')
const settingsSource = fs.readFileSync('src/pages/Settings.jsx','utf8')
const foodAlcoholSource = fs.readFileSync('src/pages/FoodAlcoholCost.jsx','utf8')
const costCss = fs.readFileSync('src/styles/cost.css','utf8')
const globalCss = fs.readFileSync('src/styles/global.css','utf8')

const expenseSource = fs.readFileSync('src/pages/Expenses.jsx','utf8')
const salesSource = fs.readFileSync('src/pages/Sales.jsx','utf8')
const invoicesSource = fs.readFileSync('src/pages/Invoices.jsx','utf8')
const recordsCss = fs.readFileSync('src/styles/records.css','utf8')

assert.match(payrollSource, /paid_history:paymentForm\.payment_status === 'Paid'/)
assert.match(payrollSource, /status_updated_via:'single-payment'/)
assert.match(payrollSource, /status_updated_via:'bulk-action'/)
assert.match(payrollSource, /prepareNextPayrollWeek/)
assert.match(payrollSource, /Next payroll week prepared automatically/)
assert.match(payrollSource, /const paidRows = useMemo\(\(\) => allSourceRows\.filter/)
assert.doesNotMatch(payrollSource, /const paidRows = useMemo\(\(\) => allSourceRows\.filter\([^\n]+inDateRange/)
assert.match(payrollSource, /status_updated_via:'manual-save'/)
assert.match(dashboardSource, /Food vs Alcohol Cost/)
assert.match(dashboardSource, /Supplies \+ Shared Costs/)
assert.match(settingsSource, /Cost Allocation/)
assert.match(payrollSource, /\['ready','ready to pay','approved','pending'\]\.includes\(status\)/)
assert.match(payrollSource, /setActiveTab\(status === 'paid' \? 'Payroll History'/)
assert.match(payrollSource, /applyGlobalDateRange/)
assert.match(payrollSource, /const \[page,setPage\] = useState\(1\)/)
assert.match(payrollSource, /Page \{page\} of \{totalPages\}/)
assert.match(payrollSource, /Previous/)
assert.match(payrollSource, /Rows <select value=\{pageSize\}/)
assert.match(payrollSource, /const withheld = Math\.round\(tips \* 0\.035 \* 100\) \/ 100/)
assert.match(payrollSource, /const latestSavedWeeklyEnd = useMemo/)
assert.match(payrollSource, /const baseEnd = latestSavedWeeklyEnd \|\| latestSourceWeek\?\.end/)
assert.match(payrollSource, /const next = nextWeekAfter\(baseEnd\)/)
assert.match(payrollSource, /const savedKitchenDate = kitchenWeekEnd/)
assert.match(payrollSource, /applyGlobalDateRange\(\{[\s\S]*savedKitchenDate/)
assert.match(foodAlcoholSource, /cost-compare-grid/)
assert.match(foodAlcoholSource, /Full allocated department economics/)
assert.match(foodAlcoholSource, /Cleaning \/ Cintas \/ Utilities \/ Insurance \/ Other/)
assert.match(foodAlcoholSource, /cost-amount-link/)
assert.match(foodAlcoholSource, /cost-detail-drawer/)
assert.match(costCss, /cost-compare-alcohol>header/)
assert.match(costCss, /cost-table th\{background:#dfe9e5/)
assert.match(globalCss, /increase record\/data text only/)
assert.match(payrollSource, /latestKitchenWeekEnd/)

assert.match(expenseSource, /<option>ACH<\/option>/)
assert.match(recordsCss, /RC2\.6 modal control alignment/)
assert.match(salesSource, /<option>Check<\/option><option>ACH<\/option>/)
assert.match(invoicesSource, /Invoice Amount <small>\(Manual Entry\)<\/small>/)
assert.match(payrollSource, /Build Another Kitchen Week/)
assert.match(payrollSource, /inheritedStart = latestKitchenWeekEnd \? addDays\(latestKitchenWeekEnd, 1\)/)
assert.equal(DEFAULT_ALLOCATION_RULES.managerPayroll.food, 50)
assert.equal(DEFAULT_ALLOCATION_RULES.managerPayroll.alcohol, 50)
assert.equal(DEFAULT_ALLOCATION_RULES.utilities.food, 70)
assert.equal(DEFAULT_ALLOCATION_RULES.utilities.alcohol, 30)


assert.equal(tipsWithheld({original_tips:995.87,tips_withheld:1}), 34.86)
assert.equal(netTips({original_tips:995.87,tips_after_withheld:1}), 961.01)
const normalizedTipExample = normalizePayrollRecord({employee_name:'Tip Test',original_tips:995.87,tips_withheld:1,tips_after_withheld:994.87})
assert.equal(normalizedTipExample.tips_withheld,34.86)
assert.equal(normalizedTipExample.tips_after_withheld,961.01)
const weeklyTipExample = buildWeeklyPayroll([{id:'tip-1',employee_name:'Tip Test',pay_date:'2026-08-03',original_tips:995.87,tips_withheld:1}],{start:'2026-08-03',end:'2026-08-09'})[0]
assert.equal(weeklyTipExample.tips_withheld,34.86)
assert.equal(weeklyTipExample.tips_after_withheld,961.01)

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
console.log('RC2.6 regression passed: exact 3.5% withholding, kitchen-only next week, pagination, paid history, allocations, comparison styling and amount drill-downs are wired.')
