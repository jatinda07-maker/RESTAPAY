import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { detectToastLaborPeriod, parseToastLaborRows, laborImportDiagnostics } from '../src/engine/ToastLaborEngine.js'

const matrix = [
  ['Toast Labor Summary'],
  ['Date Range', '07/14/2026 - 07/20/2026'],
  [],
  ['Employee', 'Job', 'Total Hours', 'Hourly Rate', 'Regular Pay', 'Total Tips'],
  ['Capuano, Haleigh', 'Server', 40, 4, 160, 2240.97],
  ['Cruz, Israel', 'General Manager', 50, 25, 1250, 100]
]
const ws = XLSX.utils.aoa_to_sheet(matrix)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Labor Summary')

const period = detectToastLaborPeriod(XLSX, wb)
assert.deepEqual(period, { start: '2026-07-14', end: '2026-07-20', label: '2026-07-14 to 2026-07-20' })

const rows = parseToastLaborRows(XLSX, wb, { payDate: '2026-07-21', tipRate: 3.5, reportPeriod: period })
assert.equal(rows.length, 2)
assert.equal(rows[0].pay_date, '2026-07-20')
assert.equal(rows[0].period_start, '2026-07-14')
assert.equal(rows[0].period_end, '2026-07-20')
assert.equal(rows[0].total_tips, 2240.97)
assert.equal(rows[0].tip_deduction, 78.43)
assert.equal(rows[0].tips, 2162.54)

const diag = laborImportDiagnostics(rows)
assert.equal(diag.hours, 90)
assert.equal(diag.regularPay, 1410)
assert.equal(diag.totalTips, 2340.97)
console.log('Toast labor import tests passed')
