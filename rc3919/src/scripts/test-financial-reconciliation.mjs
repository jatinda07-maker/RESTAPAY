import assert from 'node:assert/strict'
import { buildFinancialMetrics, classifyInvoiceSpend } from '../src/core/engines/FinancialReconciliation.js'

const invoices = [
  { id:'f1', category:'Food', total:110, payment_type:'Cash', lines:[{category:'Food', line_total:100}] },
  { id:'a1', category:'Alcohol', total:55, payment_type:'Check', lines:[{category:'Alcohol', line_total:50}] },
  { id:'o1', category:'Other', total:20, payment_type:'Cash', lines:[] },
]
const split = classifyInvoiceSpend(invoices)
assert.equal(split.food, 110)
assert.equal(split.alcohol, 55)
assert.equal(split.uncategorized, 20)
assert.equal(split.foodInvoiceCount, 1)
assert.equal(split.alcoholInvoiceCount, 1)

const metrics = buildFinancialMetrics({
  sales:[{net_sales:1000,food_sales:700,alcohol_sales:200,other_sales:100,cash_sales:400,credit_sales:600,tips_collected:80}],
  payrollSummary:{total:200,cash:120,check:80,hours:30},
  invoices,
  expenses:[{amount:50,method:'Cash'},{amount:25,method:'Credit'}],
})
assert.equal(metrics.salesTotal, 1000)
assert.equal(metrics.cogs, 165)
assert.equal(metrics.cashInvoiceSpend, 130)
assert.equal(metrics.cashExpenses, 50)
assert.equal(metrics.cashRemaining, 100)
assert.equal(metrics.operatingProfit, 560)
assert.equal(metrics.reconciliation.balanced, true)
assert.equal(metrics.reconciliation.salesCategoryVariance, 0)
assert.equal(metrics.reconciliation.cashEquationVariance, 0)
assert.equal(metrics.reconciliation.profitEquationVariance, 0)
console.log('Financial reconciliation tests passed')
