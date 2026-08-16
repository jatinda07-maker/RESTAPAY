import assert from 'node:assert/strict'
import fs from 'node:fs'
import { calculateDepartmentCosts } from '../src/core/engines/DepartmentCostEngine.js'
import { summarizePayroll } from '../src/core/adapters/payrollAdapter.js'
import { buildFinancialMetrics } from '../src/core/engines/FinancialReconciliation.js'

const payroll = [
  { employee_name:'Cook A', job_type:'Cook', regular_pay:800, pay_date:'2026-07-10' },
  { employee_name:'Server A', job_type:'Server', regular_pay:0, credit_card_tips:500, pay_date:'2026-07-10' },
  { employee_name:'Manager A', job_type:'Assistant Manager', regular_pay:600, pay_date:'2026-07-10' },
]
const employees = [
  { name:'Cook A', job_type:'Cook' },
  { name:'Server A', job_type:'Server' },
  { name:'Manager A', job_type:'Assistant Manager' },
]
const spendRows = [
  { _source_table:'invoice_items', category:'Food', description:'Beef', amount:1000, invoice_date:'2026-07-05' },
  { _source_table:'invoice_items', category:'Liquor', description:'Tequila', amount:400, invoice_date:'2026-07-06' },
  { _source_table:'expenses', expense_type:'Supplies', description:'Restaurant supplies', amount:100, expense_date:'2026-07-07' },
  { _source_table:'expenses', expense_type:'Utilities', description:'Utilities', amount:200, expense_date:'2026-07-08' },
]
const dc = calculateDepartmentCosts({ payrollRows:payroll, employees, spendRows, settings:{departmentAllocations:{managerPayroll:{food:50,alcohol:50},supplies:{food:80,alcohol:20},utilities:{food:80,alcohol:20}}} })
assert.equal(dc.kitchenPayroll, 800)
assert.equal(dc.payrollDetails.kitchen.length, 1)
assert.equal(dc.payrollDetails.manager.length, 1)
assert.equal(dc.payrollDetails.tips.length, 1)
assert.equal(dc.managerFood, 300)
assert.equal(dc.foodSupplies, 80)
assert.equal(dc.foodShared, 160)
assert.equal(dc.trueFoodCost, 2340)

const summary = summarizePayroll(payroll, employees)
const metrics = buildFinancialMetrics({ sales:[{net_sales:5000}], payrollSummary:summary, invoices:[{category:'Food',total:1000},{category:'Liquor',total:400}], expenses:[] })
assert.equal(metrics.operatingLabor, 800)
assert.equal(metrics.frontOfHousePayroll, 0)
assert.equal(metrics.managementPayroll, 600)
assert.equal(metrics.primeCostAmount, 2800) // direct COGS 1400 + BOH 800 + management 600, tips excluded

const drawer = fs.readFileSync('src/components/DetailDrawer.jsx','utf8')
assert.match(drawer,/dc\.spendDetails\?\.food/)
assert.match(drawer,/dc\.payrollDetails\?\.kitchen/)
assert.match(drawer,/allocatedAmount/)
assert.match(drawer,/foodAllocated/)
assert.match(drawer,/alcoholAllocated/)
assert.match(drawer,/allClassifiedPayroll/)
assert.match(drawer,/entryScope\s*\|\|\s*title/)
assert.match(drawer,/Front of House Payroll/)
assert.match(drawer,/Tip Pass-Through/)
assert.match(drawer,/EXCLUDED/)
console.log('RC3.7.1 modal entry reconciliation regression passed')
