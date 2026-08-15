import fs from 'node:fs'

const records = fs.readFileSync('src/styles/records.css','utf8')
const sales = fs.readFileSync('src/styles/sales.css','utf8')
const components = fs.readFileSync('src/styles/components.css','utf8')

const must = (cond, msg) => { if (!cond) throw new Error(msg) }

must(records.includes('.records-filterbar .records-select>svg:last-child'), 'records filter custom chevron missing')
must(sales.includes('.sales-filterbar .sales-select>svg:last-child'), 'sales filter custom chevron missing')
must(components.includes('.compact-range-select>svg:last-child'), 'date preset custom chevron missing')
must(records.includes('.records-table td{font-size:12px}'), 'records data +1px missing')
must(sales.includes('.sales-table td{font-size:12px}'), 'sales data +1px missing')
must(components.includes('.compact-apply{') && components.includes('height:34px'), 'compact Apply styling missing')

console.log('RC2.11 filter UI regression passed: filter chevrons, +1px data text, and compact Apply styling are wired.')
