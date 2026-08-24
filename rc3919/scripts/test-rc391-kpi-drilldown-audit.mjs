import fs from 'node:fs'

const read = p => fs.readFileSync(p, 'utf8')
const drawer = read('src/components/DetailDrawer.jsx')
const vendorComparison = read('src/pages/VendorComparison.jsx')
const vendors = read('src/pages/Vendors.jsx')
const invoices = read('src/pages/Invoices.jsx')
const bank = read('src/pages/BankChecks.jsx')
const price = read('src/pages/PriceIncrease.jsx')

const expect = (condition, message) => { if (!condition) throw new Error(message) }

for (const title of ['Compared Items','Best Vendor Matches','Potential Savings','Invoice Lines','Total Vendors','Invoice Total','True Food Cost','True Alcohol Cost','Food Profit','Alcohol Profit','Total Payments','Cleared','Pending','Entries','Sales Imports','Labor Imports','Invoice Imports','Completed','Connection Status','Last Sales Sync','Last Labor Sync','Pending Jobs','Restaurant Profile','Users & Roles','Data & Backup','Notifications']) {
  expect(drawer.includes(`'${title}'`), `Missing DetailDrawer mapping for ${title}`)
}
expect(drawer.includes('/best vendor matches/i.test(label)'), 'Best Vendor Matches entry resolver missing')
expect(drawer.includes('/invoice lines/i.test(label)'), 'Invoice Lines entry resolver missing')
expect(drawer.includes("kind === 'bank'"), 'Bank/check explicit entry formatter missing')
expect(vendorComparison.includes('detailRows') && vendorComparison.includes("rows:r.history"), 'Vendor Comparison KPI/item drilldowns are not carrying source rows')
expect(vendorComparison.includes("Check Sam's"), "Sam's benchmark action missing")
expect(vendors.includes('detailRows') && vendors.includes('cleanRows'), 'Vendor KPI cards are not carrying source rows')
expect(invoices.includes('foodInvoiceRows') && invoices.includes('openInvoiceRows'), 'Invoice KPI exact row sets missing')
expect(bank.includes('detailRows') && bank.includes("safeStatus(r.status,'Pending')==='Cleared'"), 'Bank KPI exact row sets missing')
expect(price.includes('detailRows') && price.includes('largest?(largest.comparison_rows||largest.history||[]):[]'), 'Price Increase KPI exact row sets missing')

console.log('RC3.9.1 KPI drilldown audit passed')
