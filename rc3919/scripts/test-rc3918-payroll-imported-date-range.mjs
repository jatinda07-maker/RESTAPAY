import fs from 'node:fs'

const payroll = fs.readFileSync(new URL('../src/pages/Payroll.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/styles/records.css', import.meta.url), 'utf8')
const checks = [
  ['payroll-specific date resolver', payroll.includes("'work_date','shift_date','clock_date','clock_in_date','period_end','payroll_week_end'")],
  ['scoped payroll rows use payroll date range', payroll.includes('allSourceRows.filter(payrollRowInRange)')],
  ['paid history is date scoped', payroll.includes("scopedSourceRows.filter(row => String(row.payment_status")],
  ['imported labor has from/to range controls', payroll.includes('payroll-import-range') && payroll.includes('Apply Range')],
  ['imported file date range becomes active after import', payroll.includes("applyGlobalDateRange({ preset:'custom', from:importedDates[0], to:importedDates[importedDates.length-1] })")],
  ['KPI cards use active tab rows', payroll.includes('cardSourceRows') && payroll.includes("activeTab === 'Imported Labor'")],
  ['responsive imported range CSS present', css.includes('RC3.9.18 Payroll imported-labor date range')],
]
const failed = checks.filter(([,ok]) => !ok)
for (const [name,ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
if (failed.length) process.exit(1)
console.log('RC3.9.18 payroll imported date range and KPI card regression checks passed.')
