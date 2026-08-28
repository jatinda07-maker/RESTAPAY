import fs from 'node:fs'
const read=p=>fs.readFileSync(p,'utf8')
const sort=read('src/lib/sort.js')
const payroll=read('src/pages/Payroll.jsx')
const reports=read('src/pages/Reports.jsx')
const drawer=read('src/components/DetailDrawer.jsx')
const checks=[
  ['shared A-Z helper', sort.includes('sortOptionsAZ') && sort.includes("sensitivity:'base'")],
  ['shared date then text helper', sort.includes('sortByDateThenText')],
  ['payroll weeks ascending', payroll.includes('.sort((a,b) => a.end.localeCompare(b.end))')],
  ['next-week still uses latest', payroll.includes('availablePayrollWeeks.at(-1)')],
  ['report payroll groups ascending', reports.includes("String(a.from||'').localeCompare(String(b.from||''))")],
  ['drawer cost rows ascending', drawer.includes("String(a[0]).localeCompare(String(b[0]))")],
  ['cash withdrawal history ascending', drawer.includes("String(a.entry_date||a.date).localeCompare(String(b.entry_date||b.date))")],
]
let failed=0
for(const [name,ok] of checks){ console.log(`${ok?'PASS':'FAIL'}: ${name}`); if(!ok) failed++ }
if(failed){ process.exitCode=1; throw new Error(`${failed} RC3.9.28 sorting checks failed`) }
console.log('RC3.9.28 Global Ascending Sort Audit checks passed.')
