import fs from 'node:fs'

const dashboard = fs.readFileSync('src/pages/Dashboard.jsx','utf8')
const cards = fs.readFileSync('src/components/AnalyticsCards.jsx','utf8')
const drawer = fs.readFileSync('src/components/DetailDrawer.jsx','utf8')

const checks = [
  [dashboard.includes('Food + alcohol + operating labor vs sales'), 'Prime Cost KPI explains operating labor'],
  [cards.includes('value={appMoney(metrics.operatingLabor)}'), 'Cost card uses operatingLabor'],
  [cards.includes('Tip Pass-Through'), 'Cost card identifies excluded tips'],
  [!cards.includes('Payroll & Expenses\" value={appMoney(-(metrics.payrollTotal+metrics.expenseTotal))}'), 'Profit card no longer deducts payrollTotal'],
  [drawer.includes("['Operating Labor',`${payroll.length} payroll records · tips excluded`,appMoney(metrics.operatingLabor)]"), 'Prime Cost drawer uses operatingLabor'],
  [drawer.includes("['Tip Pass-Through','Employee-owned net tips · excluded from Prime Cost',appMoney(metrics.netTipsPaid)]"), 'Prime Cost drawer shows excluded tips'],
  [drawer.includes("['Operating Labor',`${payroll.length} payroll records · tips excluded`,appMoney(-metrics.operatingLabor)]"), 'Operating Profit drawer deducts operatingLabor'],
]
for (const [ok,label] of checks) {
  if (!ok) throw new Error(`FAIL: ${label}`)
  console.log(`PASS: ${label}`)
}
console.log('RC3.6 prime cost display regression passed')
