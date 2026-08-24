import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildFinancialMetrics } from '../src/core/engines/FinancialReconciliation.js'
import { summarizePayroll } from '../src/core/adapters/payrollAdapter.js'

const payroll = [
  {employee_name:'Cook',job_type:'Cook',regular_pay:800,payroll_date:'2026-08-01',method:'Cash'},
  {employee_name:'Manager',job_type:'General Manager',regular_pay:600,payroll_date:'2026-08-01',method:'Check'},
  {employee_name:'Server',job_type:'Server',regular_pay:0,original_tips:500,tips_after_withholding:482.5,total:482.5,payroll_date:'2026-08-01',method:'Check'},
]
const summary = summarizePayroll(payroll, [])
const metrics = buildFinancialMetrics({
  sales:[{net_sales:10000,cash_sales:4000}], payrollSummary:summary,
  invoices:[{category:'Food',total:1000,payment_type:'Cash'},{category:'Liquor',total:400,payment_type:'Check'}],
  expenses:[
    {category:'Utilities',amount:200,payment_type:'Cash'},
    {category:'Cash Withdrawal',name:'Cash Withdrawal - Bank deposit',amount:300,payment_type:'Cash Withdrawal'},
  ]
})
assert.equal(metrics.primeCostAmount, 2800) // 1400 COGS + 800 BOH + 600 manager
assert.equal(metrics.expenseTotal, 200) // withdrawal is not an operating expense
assert.equal(metrics.cashWithdrawals, 300)
assert.equal(metrics.cashRemaining, 1700) // 4000 - 800 cash payroll - 1000 cash invoice - 200 cash expense - 300 withdrawal

const drawer=fs.readFileSync('src/components/DetailDrawer.jsx','utf8')
for (const token of ['Total Vendors','Invoice Total','Price Increases','Items Decreased','Unit Impact','Sales Report','Payroll Report','Expense Report','Cash Withdrawals','Carry Forward','scopedExplicitEntries']) assert.ok(drawer.includes(token), token)
const reports=fs.readFileSync('src/pages/Reports.jsx','utf8')
assert.ok(reports.includes("'sales-department':'Sales Report'"))
assert.ok(reports.includes('Cash Withdrawals'))
const data=fs.readFileSync('src/hooks/useAppData.js','utf8')
assert.ok(data.includes('cashCarryForward'))
assert.ok(data.includes('priorFinancial'))
console.log('RC3.7.2 KPI/date/cash reconciliation regression passed')
