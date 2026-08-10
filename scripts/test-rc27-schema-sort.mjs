import fs from 'node:fs'

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const store = read('src/data/liveDataStore.js')
const invoices = read('src/pages/Invoices.jsx')
const expenses = read('src/pages/Expenses.jsx')
const sales = read('src/pages/Sales.jsx')
const globalCss = read('src/styles/global.css')

if (/duplicate_match_id:r\.duplicate_match_id|duplicate_match_reason:text\(r\.duplicate_match_reason\)|duplicate_override:Boolean\(r\.duplicate_override\)/.test(store)) throw new Error('Invoice DB payload still writes optional duplicate metadata columns')
if (!invoices.includes('.sort(alpha)')) throw new Error('Invoice categories/vendors are not sorted with alpha comparator')
if (!expenses.includes('.sort(alpha)')) throw new Error('Expense types are not sorted A-Z')
if (!expenses.includes("slice().sort((a,b)=>alpha(a.name,b.name))")) throw new Error('Expense vendor dropdown is not sorted A-Z')
if (!sales.includes('existingIndex=items.findIndex')) throw new Error('Manual sales do not merge with an existing business date')
if (globalCss.includes('RC2.5 readability: increase record/data text only')) throw new Error('RC2.5 global typography override was not removed')
console.log('RC2.7 schema/sort/typography regression passed.')
