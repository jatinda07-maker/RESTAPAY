import React, { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import { createId } from '../lib/localStore'
import { parseToastSalesRows } from '../engine/ToastSalesEngine'

function today() { return new Date().toISOString().slice(0, 10) }
function norm(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function money(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  const negative = /^\(.*\)$/.test(raw) || /credit|rebate|refund|return/i.test(raw)
  const cleaned = raw.replace(/[$,%(),]/g, '').trim()
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return 0
  return negative || n < 0 ? -Math.abs(n) : n
}
function fmt(value) { return Number(value || 0).toFixed(2) }
function findValue(row, labels) {
  const mapped = Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [norm(key), value]))
  for (const label of labels) {
    const value = mapped[norm(label)]
    if (value !== undefined && value !== '') return value
  }
  return ''
}
function cleanRows(rows) { return rows.filter(row => Object.values(row || {}).some(value => String(value ?? '').trim() !== '')) }
function sheetObjects(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  return cleanRows(XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }))
}
function firstSheetRows(workbook) { return sheetObjects(workbook, workbook.SheetNames[0]) }
function parseDate(value) {
  if (!value) return today()
  const text = String(value).trim()
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  const d = new Date(text)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  const m = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
  return today()
}
function fileRange(name) {
  const match = String(name || '').match(/(\d{4})[-_ ]?(\d{2})[-_ ]?(\d{2}).*?(\d{4})[-_ ]?(\d{2})[-_ ]?(\d{2})/)
  return match ? { start: `${match[1]}-${match[2]}-${match[3]}`, end: `${match[4]}-${match[5]}-${match[6]}` } : { start: '', end: '' }
}
function itemCategory(name) {
  const text = String(name || '').toLowerCase()
  if (/beer|bud|miller|modelo|corona|michelob|coors|draft/.test(text)) return 'Beer'
  if (/texana|tequila|vodka|whiskey|rum|liquor/.test(text)) return 'Liquor'
  if (/coke|sprite|tea|lemonade|soda|fountain|drink|beverage/.test(text)) return 'Beverage'
  return 'Food'
}
function vendorSource(name) {
  const category = itemCategory(name)
  if (category === 'Beer') return 'Beer Vendor'
  if (category === 'Liquor') return 'ABC Store'
  if (category === 'Beverage') return 'Buffalo Rock'
  if (/margarita mix/i.test(String(name || ''))) return 'US Foods'
  return 'US Foods'
}
function recipeLine(name, qty, unit, cost, vendor = 'US Foods') {
  return { id: createId('recipe-line'), ingredient: name, qty, unit, unitCost: Number(cost || 0), totalCost: Number(qty || 0) * Number(cost || 0), vendor, source: 'Estimated' }
}
function recipeForDish(name, price = 0) {
  const text = String(name || '').toLowerCase()
  if (itemCategory(text) === 'Beer') return [recipeLine(name, 1, 'serving', 2.25, 'Beer Vendor')]
  if (itemCategory(text) === 'Liquor') return [recipeLine('Texana / liquor pour', 1.5, 'oz', 0.72, 'ABC Store')]
  if (/coke|sprite|tea|lemonade|soda|fountain|drink|beverage/.test(text)) return [recipeLine('Beverage syrup / product', 1, 'serving', 0.38, 'Buffalo Rock')]
  if (/margarita/.test(text)) return [recipeLine('Margarita mix', 1, 'serving', 0.42, 'US Foods'), recipeLine('Liquor pour', 1.5, 'oz', 0.72, 'ABC Store')]
  if (/fajita/.test(text)) return [recipeLine(/steak|beef/.test(text) ? 'Steak' : 'Chicken', 7, 'oz', .28), recipeLine('Peppers', 2, 'oz', .08), recipeLine('Onions', 2, 'oz', .05), recipeLine('Tortillas', 3, 'each', .15), recipeLine('Rice and beans', 8, 'oz', .05), recipeLine('Sides', 1, 'set', .75)]
  if (/burrito|chimichanga|quesadilla|taco|enchilada|nacho/.test(text)) return [recipeLine('Tortilla / chips', 1, 'portion', .35), recipeLine(/steak|beef/.test(text) ? 'Beef' : 'Chicken', 5, 'oz', .25), recipeLine('Cheese', 2, 'oz', .18), recipeLine('Rice and beans', 6, 'oz', .05), recipeLine('Sauce / salsa', 1, 'portion', .35)]
  const target = Math.max(Number(price || 0) * .3, 1.25)
  return [recipeLine('Main ingredient', 1, 'portion', target * .55), recipeLine('Sides / garnish', 1, 'portion', target * .25), recipeLine('Sauce / seasoning', 1, 'portion', target * .2)]
}
function productMixItems(workbook, fileName) {
  const rows = sheetObjects(workbook, 'Items')
  const range = fileRange(fileName)
  return rows.map(row => {
    const name = String(findValue(row, ['Item', 'Item, open item', 'Name', 'Open item'])).trim()
    const qtySold = money(findValue(row, ['Qty sold', 'Quantity sold', 'Qty']))
    const avgPrice = money(findValue(row, ['Avg. price', 'Avg price', 'Average price']))
    const grossSales = money(findValue(row, ['Gross item amt', 'Gross item amount', 'Gross sales']))
    const netSales = money(findValue(row, ['Net item amt', 'Net item amount', 'Net sales'])) || grossSales
    if (!name || !qtySold) return null
    const toastDepartment = String(findValue(row, ['Sales Category', 'Sales category', 'Department', 'Menu Group', 'Menu group', 'Category']) || '').trim()
    return { id: `${norm(name)}-${range.start || norm(fileName)}`, name, department: toastDepartment || itemCategory(name), category: toastDepartment || itemCategory(name), vendorSource: vendorSource(name), qtySold, avgPrice, grossSales, netSales, dateStart: range.start, dateEnd: range.end, sourceFile: fileName, status: 'Estimated', importedAt: new Date().toISOString() }
  }).filter(Boolean)
}
function toastSalesCategoryTotals(workbook) {
  const rows = sheetObjects(workbook, 'Sales category summary')
  const groups = { food: [], alcohol: [], excluded: [], other: [] }
  rows.forEach(row => {
    const category = String(findValue(row, ['Sales category', 'Category']) || '').trim()
    if (!category || /^total$/i.test(category)) return
    const entry = { category, itemCount: money(findValue(row, ['Items', 'Item count'])), salesAmount: money(findValue(row, ['Net sales', 'Net Sales'])) }
    const key = norm(category)
    if (['food', 'nosalescategoryassigned'].includes(key)) groups.food.push(entry)
    else if (['bottledbeer', 'cocktailsshots', 'cocktailsandshots', 'draftbeer', 'margaritas', 'wine'].includes(key)) groups.alcohol.push(entry)
    else if (['nongratsvccharges', 'nongratservicecharges', 'servicecharges', 'tips', 'tax', 'taxes', 'discounts', 'giftcards', 'giftcard'].includes(key)) groups.excluded.push(entry)
    else groups.other.push(entry)
  })
  const total = key => groups[key].reduce((sum, row) => sum + Number(row.salesAmount || 0), 0)
  return { ...groups, foodTotal: total('food'), alcoholTotal: total('alcohol'), excludedTotal: total('excluded'), otherTotal: total('other') }
}
function genericSalesRows(workbook, fileName) {
  const categories = toastSalesCategoryTotals(workbook)
  if (workbook.SheetNames.includes('Sales category summary') && (categories.food.length || categories.alcohol.length)) {
    const dayRows = sheetObjects(workbook, 'Sales by day')
    const range = fileRange(fileName)
    const net = categories.foodTotal + categories.alcoholTotal + categories.excludedTotal + categories.otherTotal
    if (!dayRows.length) return [{ id: createId('sale'), business_date: range.start || today(), gross_sales: fmt(net), net_sales: fmt(net), cash_sales: '0.00', credit_sales: '0.00', gift_card_sales: '0.00', online_orders: '0.00', delivery_orders: '0.00', pickup_orders: '0.00', tips: '0.00', refunds: '0.00', voids: '0.00', discounts: '0.00', tax: '0.00', guest_count: '0.00', source_file: fileName, food_sales: fmt(categories.foodTotal), alcohol_sales: fmt(categories.alcoholTotal), other_sales: fmt(categories.otherTotal), excluded_sales: fmt(categories.excludedTotal), food_sales_categories: categories.food, alcohol_sales_categories: categories.alcohol, other_sales_categories: categories.other, excluded_sales_categories: categories.excluded, import_note: 'Toast Sales Category Summary' }]
  }
  const rows = sheetObjects(workbook, 'Sales by day').length ? sheetObjects(workbook, 'Sales by day') : firstSheetRows(workbook)
  return rows.map(row => {
    const date = parseDate(findValue(row, ['Business Date', 'Date', 'Opened Date', 'Order Date']))
    const gross = money(findValue(row, ['Gross Sales', 'Gross', 'Total Sales', 'Sales']))
    const net = money(findValue(row, ['Net Sales', 'Net', 'Net Sales Total'])) || gross
    const cash = money(findValue(row, ['Cash', 'Cash Sales', 'Cash Payments']))
    const credit = money(findValue(row, ['Credit', 'Credit Sales', 'Credit Card Sales', 'Credit Cards']))
    if (!gross && !net && !cash && !credit) return null
    return { id: createId('sale'), business_date: date, gross_sales: fmt(gross), net_sales: fmt(net), cash_sales: fmt(cash), credit_sales: fmt(credit), gift_card_sales: '0.00', online_orders: fmt(money(findValue(row, ['Online', 'DoorDash', 'Other']))), delivery_orders: '0.00', pickup_orders: '0.00', tips: fmt(money(findValue(row, ['Tips', 'Tips after withholding']))), refunds: fmt(Math.abs(money(findValue(row, ['Refunds'])))), voids: fmt(Math.abs(money(findValue(row, ['Voids'])))), discounts: fmt(Math.abs(money(findValue(row, ['Discounts'])))), tax: fmt(money(findValue(row, ['Tax', 'Taxes']))), guest_count: fmt(money(findValue(row, ['Guests', 'Guest Count']))), source_file: fileName, import_note: 'Imported from Import Center' }
  }).filter(Boolean)
}
function payrollRows(workbook, fileName) {
  const rows = firstSheetRows(workbook)
  return rows.map(row => {
    const name = String(findValue(row, ['Employee', 'Employee Name', 'Name'])).trim()
    const hours = money(findValue(row, ['Hours', 'Regular Hours', 'Total Hours']))
    const total = money(findValue(row, ['Total Pay', 'Pay', 'Gross Pay', 'Amount']))
    const tips = money(findValue(row, ['Tips', 'Tips after withholding', 'Final Tips']))
    if (!name || (!hours && !total && !tips)) return null
    return { id: createId('pay'), employee_name: name, employee_id: null, pay_date: parseDate(findValue(row, ['Date', 'Payroll Date', 'Business Date'])), source: fileName, pay_type: 'Hourly', payment_method: /server|waiter|waitress|tips/i.test(name) ? 'Check' : 'Cash', payroll_type: /server|waiter|waitress|tips/i.test(name) ? 'Customer Tips' : 'Operating Labor', hours: fmt(hours), regular_pay: fmt(total), tips_after_withholding: fmt(tips), tips_withheld: fmt(money(findValue(row, ['Tips Withheld', 'Withheld']))), total_pay: fmt(total || tips), extra_pay: '0.00', extra_reason: '', check_number: '' }
  }).filter(Boolean)
}
function invoiceFromFile(fileName, kind) {
  const isCredit = ['rebate', 'credit', 'return'].includes(kind)
  return { id: createId('invoice'), vendor_name: '', invoice_number: fileName.replace(/\.[^.]+$/, ''), invoice_date: today(), due_date: '', category: kind === 'rebate' ? 'Food' : 'Other', payment_type: isCredit ? 'Vendor Credit' : 'Check', invoice_type: kind === 'rebate' ? 'Rebate' : kind === 'credit' ? 'Credit Memo' : kind === 'return' ? 'Return Credit' : 'Regular Invoice', status: isCredit ? 'Credit' : 'Open', total: '0.00', subtotal: '0.00', tax: '0.00', source_file: fileName, notes: isCredit ? 'Imported document placeholder. Review and enter credit amount.' : 'Imported document placeholder. Review and enter invoice total.' }
}

const importTypes = [
  { key: 'sales', label: 'Toast Sales Summary', accepts: '.xlsx,.xls,.csv', icon: 'sales', desc: 'Adds daily sales rows and sales import history.' },
  { key: 'payroll', label: 'Toast Labor / Payroll', accepts: '.xlsx,.xls,.csv', icon: 'payroll', desc: 'Creates payroll rows for review and direct cloud save.' },
  { key: 'productMix', label: 'Toast Product Mix', accepts: '.xlsx,.xls,.csv', icon: 'menu-costing', desc: 'Creates menu dishes and estimated recipes.' },
  { key: 'invoice', label: 'Vendor Invoice PDF/Excel', accepts: '.pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg', icon: 'invoices', desc: 'Creates an invoice placeholder for review; add line items after upload.' },
  { key: 'rebate', label: 'Rebate / Credit Memo', accepts: '.pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg', icon: 'receipt', desc: 'Creates a negative invoice type: Rebate / Credit Memo / Return Credit.' },
  { key: 'backup', label: 'RestaPay Backup', accepts: '.json', icon: 'download', desc: 'Restores a local/cloud backup JSON file.' }
]

export default function ImportCenter({ data, setData, setActive }) {
  const [type, setType] = useState('sales')
  const [status, setStatus] = useState('Choose an import type, upload a file, review the result, then open the related page if needed.')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const selected = importTypes.find(item => item.key === type) || importTypes[0]
  const history = useMemo(() => ([...(data.importHistory || []), ...(data.salesImports || []).map(row => ({ id: row.id, fileName: row.file_name, type: 'Sales', rowCount: row.row_count, createdAt: row.created_at })), ...(data.menuImports || []).map(row => ({ id: row.id, fileName: row.fileName || row.file_name, type: 'Menu Costing', rowCount: row.rowCount || row.row_count, createdAt: row.importedAt || row.created_at }))].filter(Boolean).slice(0, 25)), [data])

  function addHistory(prev, entry) {
    return { ...prev, importHistory: [{ id: createId('import'), createdAt: new Date().toISOString(), ...entry }, ...(prev.importHistory || [])].slice(0, 100) }
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setStatus(`Processing ${file.name}...`)
    try {
      if (type === 'backup') {
        const restored = JSON.parse(await file.text())
        setData(prev => addHistory({ ...prev, ...restored }, { type: 'Backup Restore', fileName: file.name, rowCount: 1, status: 'Imported' }))
        setStatus('Backup restored and saved directly to database.')
        return
      }

      let workbook = null
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (['xlsx', 'xls', 'csv'].includes(extension)) workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })

      if (type === 'sales') {
        if (!workbook) throw new Error('Sales import requires CSV/XLSX.')
        const toastRows = parseToastSalesRows(XLSX, workbook, file.name, createId)
        const rows = toastRows.length ? toastRows : genericSalesRows(workbook, file.name)
        setData(prev => {
          const sameSource = row => String(row.source_file || row.file_name || '').trim() === file.name
          const dates = rows.map(row => String(row.business_date || row.date || '')).filter(Boolean).sort()
          const rangeStart = dates[0] || ''
          const rangeEnd = dates[dates.length - 1] || ''
          const keptSales = (prev.salesDays || []).filter(row => {
            const date = String(row.business_date || row.date || '')
            const overlapsRange = rangeStart && rangeEnd && date >= rangeStart && date <= rangeEnd
            return !sameSource(row) && !overlapsRange
          })
          const keptImports = (prev.salesImports || []).filter(row => !sameSource(row))
          return addHistory({ ...prev, salesDays: [...rows, ...keptSales], salesImports: [{ id: createId('sales-import'), file_name: file.name, row_count: rows.length, range_start: rangeStart, range_end: rangeEnd, created_at: new Date().toISOString() }, ...keptImports] }, { type: 'Toast Sales Summary', fileName: file.name, rowCount: rows.length, status: rows.length ? 'Imported' : 'No rows' })
        })
        setStatus(`Imported ${rows.length} sales rows. Saved directly to database.`)
      } else if (type === 'payroll') {
        if (!workbook) throw new Error('Payroll import requires CSV/XLSX.')
        const rows = payrollRows(workbook, file.name)
        setData(prev => addHistory({ ...prev, payrollEntries: [...rows, ...(prev.payrollEntries || [])], payrollImports: [{ id: createId('payroll-import'), file_name: file.name, row_count: rows.length, created_at: new Date().toISOString() }, ...(prev.payrollImports || [])] }, { type: 'Toast Labor / Payroll', fileName: file.name, rowCount: rows.length, status: rows.length ? 'Imported' : 'No rows' }))
        setStatus(`Imported ${rows.length} payroll rows. Saved directly to database.`)
      } else if (type === 'productMix') {
        if (!workbook) throw new Error('Product Mix import requires CSV/XLSX.')
        const items = productMixItems(workbook, file.name)
        const existing = new Set((data.menuRecipes || []).map(recipe => recipe.menuItemId))
        const recipes = items.filter(item => !existing.has(item.id)).map(item => ({ id: createId('recipe'), menuItemId: item.id, menuItemName: item.name, targetFoodCost: Number(data.settings?.targetFoodCost || 30), confidence: 'Estimated', lines: recipeForDish(item.name, item.avgPrice), updatedAt: new Date().toISOString() }))
        setData(prev => addHistory({ ...prev, menuItems: [...(prev.menuItems || []).filter(row => !items.some(item => item.id === row.id)), ...items], menuRecipes: [...(prev.menuRecipes || []), ...recipes], menuImports: [{ id: createId('menu-import'), fileName: file.name, rowCount: items.length, importedAt: new Date().toISOString() }, ...(prev.menuImports || [])] }, { type: 'Toast Product Mix', fileName: file.name, rowCount: items.length, status: items.length ? 'Imported' : 'No rows' }))
        setStatus(`Imported ${items.length} menu items and created ${recipes.length} estimated recipes.`)
      } else {
        const invoice = invoiceFromFile(file.name, type)
        setData(prev => addHistory({ ...prev, invoices: [invoice, ...(prev.invoices || [])] }, { type: invoice.invoice_type, fileName: file.name, rowCount: 1, status: 'Needs review' }))
        setStatus(`${invoice.invoice_type} created from ${file.name}. Open Invoices to enter totals and line items.`)
      }
    } catch (error) {
      console.error(error)
      setStatus(error?.message || 'Import failed. Please review the file and try again.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return <div className="stack-page import-center-page">
    <section className="hero-strip compact-hero">
      <div>
        <span className="eyebrow">Import Center</span>
        <h2>One place for every upload</h2>
        <p>Import Toast sales, Toast labor, Product Mix, invoices, rebates, and backups. Every successful import saves directly to Supabase and keeps a local backup.</p>
      </div>
      <div className="hero-actions">
        <button type="button" className="btn secondary" onClick={() => setActive?.('sales')}>Sales</button>
        <button type="button" className="btn secondary" onClick={() => setActive?.('invoices')}>Invoices</button>
        <button type="button" className="btn secondary" onClick={() => setActive?.('menu-costing')}>Menu Costing</button>
      </div>
    </section>

    <section className="import-grid">
      {importTypes.map(item => <button type="button" key={item.key} className={`import-type-card ${type === item.key ? 'active' : ''}`} onClick={() => setType(item.key)}>
        <span className="import-icon"><Icon name={item.icon} /></span>
        <strong>{item.label}</strong>
        <small>{item.desc}</small>
      </button>)}
    </section>

    <section className="panel-card import-dropzone">
      <header>
        <div><h2>{selected.label}</h2><small>{selected.desc}</small></div>
        <span className="badge green">Direct Database Save</span>
      </header>
      <div className="import-upload-row">
        <div className="upload-illustration"><Icon name={selected.icon} size={38} /></div>
        <div>
          <h3>Upload file</h3>
          <p>{status}</p>
          <div className="button-row compact-buttons">
            <label className="btn primary file-action"><Icon name="upload" size={16} /> {busy ? 'Processing...' : 'Choose File'}<input ref={fileRef} type="file" accept={selected.accepts} onChange={handleFile} disabled={busy} /></label>
            <button type="button" className="btn secondary" onClick={() => setActive?.(type === 'productMix' ? 'menu-costing' : type === 'payroll' ? 'payroll' : type === 'sales' ? 'sales' : 'invoices')}>Open Related Page</button>
          </div>
        </div>
      </div>
    </section>

    <section className="panel-card">
      <header><h2>Recent Imports</h2><span>{history.length} records</span></header>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Imported</th><th>Type</th><th>File</th><th>Rows</th><th>Status</th></tr></thead>
          <tbody>{history.map(row => <tr key={row.id}><td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}</td><td>{row.type || 'Import'}</td><td>{row.fileName || row.file_name || '-'}</td><td>{row.rowCount || row.row_count || 0}</td><td><span className="badge neutral">{row.status || 'Imported'}</span></td></tr>)}{!history.length && <tr><td colSpan="5"><small>No imports yet. Upload your first Toast or invoice file above.</small></td></tr>}</tbody>
        </table>
      </div>
    </section>
  </div>
}
