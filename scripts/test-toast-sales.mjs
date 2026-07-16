import XLSX from 'xlsx'
import { parseToastPaymentTotals, parseToastSalesCategoryTotals, parseToastSalesRows } from '../src/engine/ToastSalesEngine.js'

const file = process.argv[2]
if (!file) throw new Error('Usage: node scripts/test-toast-sales.mjs <Toast workbook>')
const workbook = XLSX.readFile(file, { cellDates: true })
const categories = parseToastSalesCategoryTotals(XLSX, workbook)
const payments = parseToastPaymentTotals(XLSX, workbook)
const rows = parseToastSalesRows(XLSX, workbook, file.split('/').pop(), prefix => `${prefix}-${Math.random().toString(36).slice(2)}`)
const sum = key => Math.round(rows.reduce((total, row) => total + Number(row[key] || 0), 0) * 100) / 100
const alcoholFromCategories = Math.round(categories.alcohol.reduce((total, row) => total + row.salesAmount, 0) * 100) / 100
const checks = {
  expectedAlcohol: 21086.46,
  categoryAlcohol: alcoholFromCategories,
  savedRowsAlcohol: sum('alcohol_sales'),
  expectedFood: 64651.96,
  categoryFood: categories.foodTotal,
  savedRowsFood: sum('food_sales'),
  expectedOther: 2572.16,
  savedRowsOther: sum('other_sales'),
  expectedExcluded: 698.58,
  savedRowsExcluded: sum('excluded_sales'),
  expectedCash: 16783.21,
  paymentCash: payments.cash,
  savedRowsCash: sum('cash_sales'),
  expectedCredit: 76266.74,
  savedRowsCredit: sum('credit_sales'),
  rowCount: rows.length
}
console.log(JSON.stringify({ categories, payments, checks }, null, 2))
for (const [a, b] of [[checks.categoryAlcohol, checks.expectedAlcohol], [checks.savedRowsAlcohol, checks.expectedAlcohol], [checks.categoryFood, checks.expectedFood], [checks.savedRowsFood, checks.expectedFood], [checks.savedRowsOther, checks.expectedOther], [checks.savedRowsExcluded, checks.expectedExcluded], [checks.paymentCash, checks.expectedCash], [checks.savedRowsCash, checks.expectedCash], [checks.savedRowsCredit, checks.expectedCredit]]) {
  if (Math.abs(a - b) > 0.01) throw new Error(`Toast reconciliation failed: ${a} != ${b}`)
}
console.log('PASS: Toast category totals and saved daily rows reconcile exactly.')
