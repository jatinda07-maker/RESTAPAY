import * as XLSX from 'xlsx'
import { parseToastLaborRows, laborImportDiagnostics } from '../src/engine/ToastLaborEngine.js'

const wb = XLSX.utils.book_new()
const rows = [
  ['Toast Labor Summary'],
  ['Generated report'],
  [],
  ['Employee Name','Job','Regular Hours','OT Hours','Total Hours','Hourly Rate','Gross Pay','Credit Card Tips','Cash Tips','Tips Withheld','Check #'],
  ['Doe, Jane','Server',30,2,32,10,340,120,30,5.25,'101'],
  ['Smith, John','Cook',40,0,40,15,600,0,0,0,'102'],
  ['Grand Total','',70,2,72,'',940,120,30,5.25,'']
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Labor Summary')
const parsed = parseToastLaborRows(XLSX, wb, { payDate: '2026-07-13', tipRate: 3.5 })
const diag = laborImportDiagnostics(parsed)
console.log(JSON.stringify({ parsed, diag }, null, 2))
if (parsed.length !== 2) throw new Error(`Expected 2 rows, got ${parsed.length}`)
if (diag.hours !== 72) throw new Error(`Expected 72 hours, got ${diag.hours}`)
if (diag.regularPay !== 940) throw new Error(`Expected 940 pay, got ${diag.regularPay}`)
if (diag.totalTips !== 150) throw new Error(`Expected 150 tips, got ${diag.totalTips}`)
if (diag.withheld !== 5.25) throw new Error(`Expected 5.25 withheld, got ${diag.withheld}`)
if (diag.netTips !== 144.75) throw new Error(`Expected 144.75 net tips, got ${diag.netTips}`)
console.log('PASS: Toast labor workbook title rows, multi-column tips, hours, wages, and totals parsed correctly.')
