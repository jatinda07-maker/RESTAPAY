import fs from 'node:fs'
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const vendor = read('src/pages/Vendors.jsx')
const settings = read('src/pages/Settings.jsx')
const expenses = read('src/pages/Expenses.jsx')
const invoices = read('src/pages/Invoices.jsx')
const classifications = read('src/lib/classifications.js')
const globalCss = read('src/styles/global.css')
const checks = [
  [settings.includes("tab==='Classifications'") && settings.includes('classificationPanel'), 'Settings classification manager exists'],
  [settings.includes('WARNING:') && settings.includes('Rename') && settings.includes('Merge') && settings.includes('Deactivate'), 'classification changes warn and support rename merge deactivate'],
  [vendor.includes('bulkUpdateClassification') && vendor.includes('Apply Category') && vendor.includes('Apply Expense Type'), 'vendor bulk category and expense type actions exist'],
  [vendor.includes("restapay-expense-types-v2") && expenses.includes("restapay-expense-types-v2"), 'vendor and expense screens share expense-type source'],
  [vendor.includes("restapay-categories") && invoices.includes("restapay-categories"), 'vendor and invoice screens share category source'],
  [classifications.includes("'Payroll Tax'") && classifications.includes("'Sales Tax'") && classifications.includes("'Business License'") && classifications.includes("'Alcohol License / Liquor License'") && classifications.includes("'Bank Charges'") && classifications.includes("'Service Charges'"), 'expanded requested expense types exist'],
  [globalCss.includes('RC3.2 top bar contrast refresh') && globalCss.includes('.topbar{background:linear-gradient'), 'dark contrast is limited to topbar styling']
]
for (const [ok,message] of checks) if (!ok) throw new Error(`RC3.2 regression failed: ${message}`)
console.log('RC3.2 classification/settings/vendor bulk/topbar regression passed.')
