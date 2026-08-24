import assert from 'node:assert/strict'
import { summarizePayroll } from '../src/core/adapters/payrollAdapter.js'
import { buildFinancialMetrics } from '../src/core/engines/FinancialReconciliation.js'

const payroll = [
  { employee_name:'Server', credit_card_tips:500, extra_pay:0, payment_method:'Check' },
  { employee_name:'Cook', regular_pay:800, payment_method:'Check' }
]
const summary = summarizePayroll(payroll)
assert.equal(summary.tipsEarned, 500)
assert.equal(summary.tipsWithheld, 17.5)
assert.equal(summary.netTipsPaid, 482.5)
assert.equal(summary.total, 1282.5)
assert.equal(summary.operatingLabor, 800)
const metrics = buildFinancialMetrics({sales:[{net_sales:5000}], payrollSummary:summary, invoices:[{total:1000,category:'Food'}], expenses:[{amount:200}]})
assert.equal(metrics.primeCostAmount, 1800)
assert.equal(metrics.operatingProfit, 3000)
assert.equal(metrics.payrollTotal, 1282.5)
assert.equal(metrics.operatingLabor, 800)
assert.equal(metrics.netTipsPaid, 482.5)
console.log('Tip pass-through accounting regression passed')
