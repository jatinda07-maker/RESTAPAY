import assert from 'node:assert/strict'
import { buildFinancialMetrics } from '../src/core/engines/FinancialReconciliation.js'
import { summarizePayroll } from '../src/core/adapters/payrollAdapter.js'
import { originalTips, tipsWithheld, netTips } from '../src/core/engines/PayrollEngine.js'

const payroll=[
 {employee_name:'Tipped Server',job_type:'Server',original_tips:100,tip_deduction:3.5,tips:96.5,payment_method:'Check'},
 {employee_name:'Kitchen',job_type:'Kitchen',regular_pay:200,extra_pay:20,payment_method:'Cash'},
]
const ps=summarizePayroll(payroll)
assert.equal(ps.total,220,'Employee Payroll Total must exclude customer tips')
assert.equal(ps.paymentTotal,316.5,'Payment total may include pass-through tips')
assert.equal(originalTips(payroll[0]),100)
assert.equal(tipsWithheld(payroll[0]),3.5)
assert.equal(netTips(payroll[0]),96.5)

const metrics=buildFinancialMetrics({
 sales:[{net_sales:1000,food_sales:700,alcohol_sales:300,cash_sales:500}],
 payrollSummary:ps,
 invoices:[{category:'Food',total:200},{category:'Alcohol',total:100}],
 expenses:[
   {category:'Food',amount:200,method:'Cash'},
   {category:'Liquor',amount:100,method:'Cash'},
   {category:'Payroll',amount:220,method:'Cash'},
   {category:'Payroll Tax',amount:30,method:'Check'},
   {category:'Utilities',amount:50,method:'Cash'},
 ],
})
assert.equal(metrics.cogs,300)
assert.equal(metrics.expenseTotal,80,'Operating expenses must exclude Food/Alcohol and wage payroll duplicates')
assert.equal(metrics.excludedFoodAlcoholExpenses.reduce((s,r)=>s+Number(r.amount||0),0),300)
assert.equal(metrics.excludedPayrollTipExpenses.reduce((s,r)=>s+Number(r.amount||0),0),220)
assert.equal(metrics.cashExpenses,50,'Cash operating expenses must also exclude duplicated COGS/payroll rows')
assert.equal(metrics.operatingProfit,400,'1000 - 300 COGS - 220 wages - 80 operating expenses')
console.log('RC3.9.20 operating-expense dedupe and tipped-PDF regression checks passed.')
