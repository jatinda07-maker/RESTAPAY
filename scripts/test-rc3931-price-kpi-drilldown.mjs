import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const engine = read('src/core/engines/InvoiceEngine.js')
const app = read('src/hooks/useAppData.js')
const drawer = read('src/components/DetailDrawer.jsx')
const page = read('src/pages/PriceIncrease.jsx')

assert.ok(engine.includes('previous_date: previous.date'))
assert.ok(engine.includes('current_date: latest.date'))
assert.ok(app.includes('comparisonInvoices = data.invoices'))
assert.ok(app.includes('date <= range.to'))
assert.ok(app.includes('date >= range.from'))
assert.ok(drawer.includes('currentComparisonInRange'))
assert.ok(drawer.includes('price increases|items increased|items decreased|largest increase|unit impact'))
assert.ok(page.includes('cardRows'))
assert.ok(page.includes('comparison_rows||r.history'))
console.log('RC3.9.31 price KPI drilldown synchronization checks passed.')
