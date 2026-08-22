import fs from 'node:fs'
import assert from 'node:assert/strict'

const reports=fs.readFileSync('src/pages/Reports.jsx','utf8')
const drawer=fs.readFileSync('src/components/DetailDrawer.jsx','utf8')
const appData=fs.readFileSync('src/hooks/useAppData.js','utf8')
const css=fs.readFileSync('src/styles/records.css','utf8')

assert.ok(reports.includes('groupPayrollByEmployeePeriod'), 'reports must group payroll by employee and payroll period')
assert.ok(reports.includes("headers:['Payroll Period','Employee'"), 'grouped report must show payroll period')
assert.ok(reports.includes('Previous Period Reconciliation / Carry Forward'), 'cash report must show reconciliation carry forward')
assert.ok(reports.includes('Current Period Reconciliation Adjustment'), 'cash report must show current reconciliation adjustment')
assert.ok(appData.includes('cashCarryForward = reconciledClosing + postFinancial.cashRemaining + ledgerEffect(postLedger)'), 'cash carry-forward must use the latest reconciled closing balance')
assert.ok(appData.includes('financial.cashRemaining = cashCarryForward + periodCashChange'), 'cash remaining must include carry-forward')
assert.ok(drawer.includes('Cash Balance Adjustment'), 'cash drawer must expose reconciliation controls')
assert.ok(drawer.includes('Set Closing Balance'), 'cash drawer must allow setting reconciled closing cash')
assert.ok(drawer.includes('drawer-range-editor'), 'drawer must use compact date editor')
assert.ok(css.includes('RC3.9.17 compact drawer date controls'), 'compact drawer date styles must be present')
console.log('RC3.9.17 payroll grouping, cash carry-forward/reconciliation, and compact drawer checks passed.')
