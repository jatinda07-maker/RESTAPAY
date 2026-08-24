import fs from 'node:fs'
const src=fs.readFileSync(new URL('../src/pages/Reports.jsx', import.meta.url),'utf8')
const checks=[
  ['reports canonical payroll helper', src.includes('const reportPayrollRows = rows =>')],
  ['rolled-up daily source excluded', src.includes("payroll_status || '').trim().toLowerCase()==='rolled-up'")],
  ['weekly rollup preferred', src.includes('if(rollupsByKey.has(key)) return')],
  ['grouping uses canonical rows', src.includes(';reportPayrollRows(rows).forEach(row=>')],
  ['paid rollup priority', src.includes("payrollStatus(item)==='paid'?40:0")],
]
let failed=false
for(const [name,ok] of checks){ console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed=true }
if(failed) process.exit(1)
console.log('RC3.9.19 Reports payroll dedupe regression checks passed.')
