import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { detectToastLaborPeriod, parseToastLaborRows, laborImportDiagnostics } from '../src/engine/ToastLaborEngine.js'

const summary = [
  ['Toast Labor Summary'],
  ['Date Range', '07/14/2026 - 07/20/2026'],
  [],
  ['Employee', 'Job', 'Total Hours', 'Hourly Rate', 'Regular Pay', 'Total Tips'],
  ['Capuano, Haleigh', 'Server', 12, 4, 48, 300],
  ['Cruz, Israel', 'General Manager', 10, 25, 250, 120]
]
const daily = [
  ['Employee', 'Business Date', 'Job', 'Total Hours', 'Hourly Rate', 'Regular Pay', 'Total Tips'],
  ['Capuano, Haleigh', '07/14/2026', 'Server', 5, 4, 20, 100],
  ['Capuano, Haleigh', '07/14/2026', 'Server', 2, 4, 8, 50],
  ['Capuano, Haleigh', '07/15/2026', 'Server', 5, 4, 20, 150],
  ['Cruz, Israel', '07/14/2026', 'General Manager', 4, 25, 100, 40],
  ['Cruz, Israel', '07/15/2026', 'General Manager', 6, 25, 150, 80]
]
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Labor Summary')
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), 'Daily Labor Detail')

const period = detectToastLaborPeriod(XLSX, wb)
assert.deepEqual(period, { start: '2026-07-14', end: '2026-07-20', label: '2026-07-14 to 2026-07-20' })

const rows = parseToastLaborRows(XLSX, wb, { payDate: '2026-07-21', tipRate: 3.5, reportPeriod: period })
assert.equal(rows.length, 4, 'must group by employee + business date and ignore duplicate summary rows')

const haleigh14 = rows.find(row => row.employee_name === 'Capuano, Haleigh' && row.pay_date === '2026-07-14')
assert.ok(haleigh14)
assert.equal(haleigh14.hours, 7)
assert.equal(haleigh14.regular_pay, 28)
assert.equal(haleigh14.total_tips, 150)
assert.equal(haleigh14.tip_deduction, 5.25)
assert.equal(haleigh14.tips, 144.75)

const haleigh15 = rows.find(row => row.employee_name === 'Capuano, Haleigh' && row.pay_date === '2026-07-15')
assert.ok(haleigh15)
assert.equal(haleigh15.total_tips, 150)

const manager14 = rows.find(row => row.employee_name === 'Cruz, Israel' && row.pay_date === '2026-07-14')
assert.ok(manager14)
assert.equal(manager14.total_tips, 40, 'tip-paid managers must retain tips')
assert.equal(manager14.tip_deduction, 1.4)

for (const row of rows) {
  assert.equal(row.period_start, '2026-07-14')
  assert.equal(row.period_end, '2026-07-20')
  assert.notEqual(row.pay_date, '2026-07-21')
}

const diag = laborImportDiagnostics(rows)
assert.equal(diag.hours, 22)
assert.equal(diag.regularPay, 298)
assert.equal(diag.totalTips, 420)
console.log('Toast labor daily-date import tests passed')

const summaryOnly = [
  ['Employee', 'Job Title', 'Regular Hours', 'Overtime Hours', 'Total Pay', 'Total Tips', 'Tips Withheld'],
  ['Capuano, Haleigh', 'Server', 21, 0, 0, 210, 7.35],
  ['Cruz, Israel', 'General Manager', 14, 0, 0, 140, 4.90]
]
const summaryOnlyWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(summaryOnlyWb, XLSX.utils.aoa_to_sheet(summaryOnly), 'Payroll Export')
const summaryDaily = parseToastLaborRows(XLSX, summaryOnlyWb, {
  payDate: '2026-07-21',
  tipRate: 3.5,
  fileName: 'PayrollExport_2026_07_01-2026_07_21.csv'
})
assert.equal(summaryDaily.length, 42, 'summary-only payroll must expand to one row per employee per period date')
assert.equal(summaryDaily[0].period_start, '2026-07-01')
assert.equal(summaryDaily.at(-1).period_end, '2026-07-21')
assert.ok(summaryDaily.every(row => row.allocated_from_summary))
const summaryDiag = laborImportDiagnostics(summaryDaily)
assert.equal(summaryDiag.hours, 35)
assert.equal(summaryDiag.totalTips, 350)
assert.equal(summaryDiag.withheld, 12.25)
assert.equal(summaryDiag.netTips, 337.75)
const managerRows = summaryDaily.filter(row => row.employee_name === 'Cruz, Israel')
assert.equal(managerRows.length, 21)
assert.equal(laborImportDiagnostics(managerRows).totalTips, 140, 'tip-paid managers must retain all allocated tips')
console.log('Toast labor summary filename-period allocation tests passed')
