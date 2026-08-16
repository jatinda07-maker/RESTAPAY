import assert from 'node:assert/strict'
import fs from 'node:fs'
import { summarizePayroll, payrollCostClass } from '../src/core/adapters/payrollAdapter.js'
import { buildFinancialMetrics } from '../src/core/engines/FinancialReconciliation.js'

assert.equal(payrollCostClass({job_type:'Cook'}),'operating-labor')
assert.equal(payrollCostClass({job_type:'Assistant Manager'}),'management')
assert.equal(payrollCostClass({job_type:'Server'}),'front-of-house')
const rows=[
 {employee_name:'Cook',job_type:'Cook',regular_pay:800,payment_method:'Check'},
 {employee_name:'Asst',job_type:'Assistant Manager',regular_pay:500,payment_method:'Check'},
 {employee_name:'Server',job_type:'Server',regular_pay:0,credit_card_tips:500,payment_method:'Check'}
]
const p=summarizePayroll(rows)
assert.equal(p.operatingLabor,800)
assert.equal(p.managementPayroll,500)
assert.equal(p.frontOfHousePayroll,0)
assert.equal(p.netTipsPaid,482.5)
const m=buildFinancialMetrics({sales:[{net_sales:5000}],payrollSummary:p,invoices:[{total:1000,category:'Food'}],expenses:[]})
assert.equal(m.employerLabor,1300)
assert.equal(m.primeCostAmount,1800)
assert.equal(m.operatingProfit,2700)

const drawer=fs.readFileSync('src/components/DetailDrawer.jsx','utf8')
const css=fs.readFileSync('src/styles/components.css','utf8')
assert.match(drawer,/Expense Categories/)
assert.match(drawer,/Payroll by Job Type/)
assert.match(drawer,/True Food Cost/)
assert.match(drawer,/True Alcohol Cost/)
assert.match(drawer,/drawer-row-excluded/)
assert.match(css,/summary-row-excluded/)
assert.match(css,/background:#fff2f2/)
console.log('RC3.7 financial reconciliation and classification regression passed')
