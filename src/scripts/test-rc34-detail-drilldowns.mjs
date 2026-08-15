import fs from 'node:fs'
const source = fs.readFileSync('src/components/DetailDrawer.jsx','utf8')
const checks = [
  ['Cash Expenses has exact cash filter', "lowerLabel === 'cash expenses'"],
  ['Cash Vendor Invoices has exact cash invoice filter', "lowerLabel === 'cash vendor invoices'"],
  ['Check and ACH has exact expense filter', "['check','ach'].includes(expenseMethod(r))"],
  ['Credit expenses has exact card filter', "lowerLabel === 'credit expenses'"],
  ['Drawer accepts explicit entry rows', 'entries = []'],
  ['Overview row opens matching entries in same drawer', 'showMatchingEntries(label)'],
  ['Matching list shows every row rather than slicing to eight', 'recentEntries.map(([date,meta,value], index)'],
  ['Entries view reports exact matching record count', 'matching record{recentEntries.length === 1'],
]
for (const [name, text] of checks) {
  if (!source.includes(text)) throw new Error(`RC3.4 regression failed: ${name}`)
  console.log(`PASS: ${name}`)
}
console.log('RC3.4 detail drill-down regression passed.')
