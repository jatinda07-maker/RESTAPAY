import fs from 'node:fs'
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const invoices = read('src/pages/Invoices.jsx')
const expenses = read('src/pages/Expenses.jsx')
const css = read('src/styles/records.css')
const checks = [
  [invoices.includes('invoice-status-tabs'), 'invoice status boxes are present'],
  [invoices.includes("applyBulkStatus('Approved')") && invoices.includes("applyBulkStatus('Paid')") && invoices.includes("applyBulkStatus('Void')"), 'direct bulk invoice actions are present'],
  [invoices.includes('data-tone-text') && invoices.includes('categoryTone(r.category)'), 'invoice category text uses semantic colors'],
  [expenses.includes("'Payroll Tax'") && expenses.includes("'Sales Tax'") && expenses.includes("'Business License'") && expenses.includes("'Alcohol License / Liquor License'") && expenses.includes("'Bank Charges'") && expenses.includes("'Service Charges'"), 'expanded expense types are present'],
  [css.includes('.page-canvas .secondary-action.action-paid') && css.includes('.status-unpaid-due'), 'right-panel semantic button and status styles are present'],
  [css.includes('.page-canvas .records-table td') && css.includes('font-size:12.5px'), 'data text gets the small readability increase'],
]
for (const [ok, message] of checks) { if (!ok) throw new Error(`RC3.1 regression failed: ${message}`) }
console.log('RC3.1 right-panel visual/expense-type regression passed.')
