import fs from 'node:fs'
const src = fs.readFileSync(new URL('../src/pages/Payroll.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/styles/records.css', import.meta.url), 'utf8')
const must = [
  'const [columnFilters,setColumnFilters]',
  'Filter payroll by date',
  'Filter payroll by employee',
  'Filter payroll by job',
  'Filter payroll by hours',
  'Filter payroll by base pay',
  'Filter payroll by tips',
  'Filter payroll by withheld',
  'Filter payroll by net tips',
  'Filter payroll by final pay',
  'Filter payroll by method',
  'Filter payroll by status',
  ".sort((a,b) => String(a.date||'').localeCompare(String(b.date||''))",
  'Clear Column Filters'
]
for (const token of must) {
  if (!src.includes(token)) throw new Error(`Missing RC2.13 behavior: ${token}`)
}
if (!css.includes('.payroll-column-filter-row')) throw new Error('Missing payroll column filter styling')
console.log('RC2.13 payroll column filters regression passed.')
