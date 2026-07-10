import React from 'react'
import * as XLSX from 'xlsx'
import { employees, vendors, invoices, expenses } from '../data/mockData'
import { Icon } from '../components/Icons'

const map = {
  sales: { title: 'Sales', desc: 'Import Toast summaries and review cash, credit, online orders, gift cards, tips, refunds, and total sales.', button: 'Import Sales', rows: [['Cash Sales','$18,742.15','Daily'],['Credit Sales','$21,450.60','Daily'],['Online Orders','$7,843.20','Daily'],['Gift Cards','$3,215.30','Daily']] },
  vendors: { title: 'Vendors', desc: 'Manage vendor records, categories, margins, invoices, and spending history.', button: 'Add Vendor', rows: vendors.map(v => [v, 'Active', 'Food / Beverage']) },
  invoices: { title: 'Invoices', desc: 'Upload PDF, image, Excel, or manual invoices. Smart extraction is Supabase/AI-ready.', button: 'Upload Invoice', rows: invoices.map(i => [i[0], i[2], i[3]]) },
  employees: { title: 'Employees', desc: 'Manage employees, job types, cash/check payroll status, and extra pay reasons.', button: 'Add', rows: employees.map((e,i) => [e, i % 2 ? 'Check Payroll' : 'Cash Payroll', i % 2 ? 'Server' : 'Kitchen']) },
  payroll: { title: 'Payroll', desc: 'Create weekly payroll groups, apply Toast payroll, deduct 3.5% server tips, and add extra pay.', button: 'Run Payroll', rows: [['Kitchen Weekly Group','$4,250.00','Cash'],['Server Payroll','$6,820.00','Check'],['Extra Pay','$0.00','Editable']] },
  expenses: { title: 'Expenses', desc: 'Track restaurant expenses, utilities, supplies, maintenance, insurance, and cash expenses.', button: 'Add Expense', rows: expenses.map(e => [e[0], e[2], e[1]]) },
  reports: { title: 'Reports', desc: 'Standard and custom reports with date ranges, sorting, movable columns, and exports.', button: 'Build Report', rows: [['Profit & Loss','Ready','Monthly'],['Food Cost','Ready','Weekly'],['Labor Cost','Ready','Weekly'],['Vendor Spending','Ready','Custom']] },
  'price-increase': { title: 'Price Increase', desc: 'Compare invoice item prices by unit, not whole invoice totals, and flag margin impact.', button: 'Review Alerts', rows: [['Beef Ribeye','Unit price +8.1%','Food'],['Chicken Case','Unit price +3.4%','Food'],['Beer Keg','Unit price +2.9%','Beer']] },
  settings: { title: 'Settings', desc: 'Configure categories, employee job types, margins, Supabase, restaurant profile, and imports.', button: 'Save Settings', rows: [['Supabase','Not connected','Environment'],['Food Margin','30%','Category'],['Liquor Margin','70%','Category']] }
}

function PriceIncreasePage() {
  const today = new Date().toISOString().slice(0, 10)
  const defaults = [
    { id: 'pi-1', name: 'Beef Ribeye', oldPrice: 10.00, newPrice: 10.81, category: 'Food', vendor: '', date: today, source: 'manual' },
    { id: 'pi-2', name: 'Chicken Case', oldPrice: 10.00, newPrice: 10.34, category: 'Food', vendor: '', date: today, source: 'manual' },
    { id: 'pi-3', name: 'Beer Keg', oldPrice: 10.00, newPrice: 10.29, category: 'Beer', vendor: '', date: today, source: 'manual' }
  ]

  const [rows, setRows] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('priceIncreases') || 'null') || defaults } catch { return defaults }
  })
  const [sort, setSort] = React.useState('highest')
  const [editingId, setEditingId] = React.useState(null)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState('all')
  const [vendorFilter, setVendorFilter] = React.useState('all')
  const [status, setStatus] = React.useState('Manual price tracking is ready. You can also pull price changes from saved invoice line items.')
  const [form, setForm] = React.useState({ name:'', oldPrice:'', newPrice:'', category:'Food', vendor:'', date: today })

  function readAppData() {
    try {
      return JSON.parse(localStorage.getItem('restapay_v2_local_data') || '{}') || {}
    } catch {
      return {}
    }
  }

  function persist(next) {
    setRows(next)
    localStorage.setItem('priceIncreases', JSON.stringify(next))
  }

  function money(value) {
    return Number(value || 0).toFixed(2)
  }

  function clean(value) {
    return String(value ?? '').trim()
  }

  function norm(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  }

  function rowDate(row) {
    return String(row?.invoice_date || row?.date || row?.created_at || today).slice(0, 10)
  }

  function parseMoney(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    const text = String(value ?? '').replace(/[$,]/g, '').trim()
    if (!text) return 0
    const n = Number(text)
    return Number.isFinite(n) ? n : 0
  }

  function unitPrice(item) {
    const qty = parseMoney(item.qty || item.quantity || item.case_qty || item.units)
    const total = parseMoney(item.total || item.amount || item.line_total || item.extended_price)
    const direct = parseMoney(item.unit_price || item.unitPrice || item.unit || item.rate || item.price || item.cost)

    if (qty > 0 && total > 0) {
      const computed = total / qty
      // Some invoice imports place the full line total in the unit price column.
      if (!direct || Math.abs(direct - total) < 0.01 || direct > computed * 8) return computed
    }

    return direct || total || 0
  }

  function pct(row) {
    const oldPrice = Number(row.oldPrice || 0)
    const newPrice = Number(row.newPrice || 0)
    return oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0
  }

  function dollarChange(row) {
    return Number(row.newPrice || 0) - Number(row.oldPrice || 0)
  }

  function clear() {
    setEditingId(null)
    setForm({ name:'', oldPrice:'', newPrice:'', category:'Food', vendor:'', date: today })
  }

  function save() {
    if (!clean(form.name)) return setStatus('Enter item name first')
    const payload = {
      ...form,
      name: clean(form.name),
      oldPrice: Number(form.oldPrice || 0),
      newPrice: Number(form.newPrice || 0),
      category: clean(form.category) || 'Other',
      vendor: clean(form.vendor),
      date: form.date || today,
      source: 'manual'
    }

    if (editingId) {
      persist(rows.map(r => r.id === editingId ? { ...r, ...payload, id: editingId } : r))
      setStatus(`Updated price for ${payload.name}`)
    } else {
      persist([{ ...payload, id: `pi-${Date.now()}` }, ...rows])
      setStatus(`Saved price increase for ${payload.name}`)
    }
    clear()
  }

  function edit(row) {
    setEditingId(row.id)
    setForm({
      name: row.name || '',
      oldPrice: row.oldPrice ?? '',
      newPrice: row.newPrice ?? '',
      category: row.category || 'Food',
      vendor: row.vendor || '',
      date: row.date || today
    })
    setStatus(`Editing ${row.name}`)
    requestAnimationFrame(() => document.querySelector('.price-increase-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function remove(id) {
    const found = rows.find(r => r.id === id)
    persist(rows.filter(r => r.id !== id))
    if (editingId === id) clear()
    setStatus(found ? `Deleted ${found.name}` : 'Deleted price row')
  }

  function pullFromInvoices() {
    const appData = readAppData()
    const invoices = appData.invoices || []
    const invoiceItems = appData.invoiceItems || []

    if (!invoiceItems.length) {
      setStatus('No invoice line items found yet. Upload/save invoices with line items first.')
      return
    }

    const invoicesById = Object.fromEntries(invoices.map(inv => [inv.id, inv]))
    const groups = new Map()

    invoiceItems.forEach(item => {
      const name = clean(item.description || item.item || item.item_name || item.name)
      if (!name) return

      const inv = invoicesById[item.invoice_id] || {}
      const price = unitPrice(item)
      if (!price) return

      const vendor = clean(inv.vendor_name || inv.vendor || item.vendor || item.vendor_name)
      const category = clean(item.category || inv.category || 'Other')
      const date = rowDate(inv)
      const key = `${norm(vendor)}::${norm(name)}`

      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push({
        name,
        vendor,
        category,
        date,
        price,
        invoice: inv.invoice_number || '',
        source: 'invoice'
      })
    })

    const generated = []
    groups.forEach(records => {
      records = records
        .filter(r => Number(r.price || 0) > 0)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))

      if (records.length < 2) return

      const prices = records.map(r => Number(r.price || 0)).sort((a, b) => a - b)
      const median = prices[Math.floor(prices.length / 2)] || 0
      if (median > 0) {
        records = records.filter(r => {
          const price = Number(r.price || 0)
          return price >= median * 0.2 && price <= median * 5
        })
      }

      if (records.length < 2) return

      const first = records[0]
      const latest = records[records.length - 1]
      const oldPrice = Number(first.price || 0)
      const newPrice = Number(latest.price || 0)
      if (!oldPrice || !newPrice) return

      generated.push({
        id: `pi-auto-${norm(latest.vendor)}-${norm(latest.name)}-${Date.now()}-${generated.length}`,
        name: latest.name,
        oldPrice,
        newPrice,
        category: latest.category || first.category || 'Other',
        vendor: latest.vendor || first.vendor || '',
        date: latest.date || today,
        firstDate: first.date,
        invoiceCount: records.length,
        latestInvoice: latest.invoice,
        source: 'invoice'
      })
    })

    if (!generated.length) {
      setStatus('Invoice line items were found, but no usable unit prices were detected.')
      return
    }

    const manualRows = rows.filter(row => row.source !== 'invoice')
    const merged = [...generated, ...manualRows]
    persist(merged)
    setStatus(`Pulled ${generated.length} price rows from saved invoice line items.`)
  }

  const appData = readAppData()
  const vendorOptions = [...new Set([...(appData.vendors || []).map(v => v.name), ...rows.map(r => r.vendor)].filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const categoryOptions = [...new Set(['Food', 'Beverage', 'Beer', 'Liquor', 'Supplies', 'Utilities', 'Maintenance', 'Insurance', 'Other', ...(appData.vendorCategories || []), ...rows.map(r => r.category)].filter(Boolean))].sort((a, b) => a.localeCompare(b))

  const filtered = rows.filter(row => {
    const q = search.toLowerCase().trim()
    if (q && ![row.name, row.vendor, row.category, row.source].join(' ').toLowerCase().includes(q)) return false
    if (categoryFilter !== 'all' && row.category !== categoryFilter) return false
    if (vendorFilter !== 'all' && row.vendor !== vendorFilter) return false
    return true
  })

  const sorted = [...filtered].sort((a,b) => {
    if (sort === 'highest') return pct(b) - pct(a)
    if (sort === 'dollars') return dollarChange(b) - dollarChange(a)
    if (sort === 'newest') return String(b.date || '').localeCompare(String(a.date || ''))
    if (sort === 'category') return String(a.category || '').localeCompare(String(b.category || '')) || String(a.name || '').localeCompare(String(b.name || ''))
    if (sort === 'vendor') return String(a.vendor || '').localeCompare(String(b.vendor || '')) || String(a.name || '').localeCompare(String(b.name || ''))
    return String(a.name || '').localeCompare(String(b.name || ''))
  })

  const biggest = sorted[0]
  const overTen = rows.filter(row => pct(row) >= 10).length
  const livePct = pct({ oldPrice: form.oldPrice, newPrice: form.newPrice })

  const exportRows = sorted.map(row => ({
    Name: row.name || '',
    Vendor: row.vendor || '',
    Category: row.category || '',
    Date: row.date || '',
    'Old Price': Number(row.oldPrice || 0),
    'New Price': Number(row.newPrice || 0),
    '$ Change': Number(dollarChange(row).toFixed(2)),
    'Increase %': Number(pct(row).toFixed(2)),
    Source: row.source || 'manual',
    'Invoice Count': row.invoiceCount || '',
    'Latest Invoice': row.latestInvoice || ''
  }))

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function exportCSV() {
    const headers = Object.keys(exportRows[0] || { Name: '', Vendor: '', Category: '', Date: '', 'Old Price': '', 'New Price': '', '$ Change': '', 'Increase %': '', Source: '' })
    const csv = [headers.join(','), ...exportRows.map(row => headers.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','))].join('\\n')
    downloadBlob(csv, `price-increase-${today}.csv`, 'text/csv;charset=utf-8;')
  }

  function exportExcel() {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Price Increases')
    XLSX.writeFile(workbook, `price-increase-${today}.xlsx`)
  }

  function printReport() {
    window.print()
  }

  return <>
    <div className="status-pill">{status}</div>

    <div className="payroll-summary-row sales-summary-row stat-row-clean clickable-summary-row">
      <button type="button" className="summary-click-card tone-blue" onClick={() => { setSearch(''); setCategoryFilter('all'); setVendorFilter('all'); setStatus('Showing all tracked price items.'); setTimeout(() => document.querySelector('.price-list-card')?.scrollIntoView({ behavior: 'smooth' }), 0) }}><span>Tracked Items</span><b>{rows.length}</b><small>Show all tracked items</small></button>
      <button type="button" className="summary-click-card tone-orange" onClick={() => { if (biggest) setSearch(biggest.name); setStatus('Showing the item with the largest increase.'); setTimeout(() => document.querySelector('.price-list-card')?.scrollIntoView({ behavior: 'smooth' }), 0) }}><span>Largest Increase</span><b>{biggest ? `${pct(biggest).toFixed(1)}%` : '0.0%'}</b><small>Open highest increase</small></button>
      <button type="button" className="summary-click-card tone-red" onClick={() => { setSearch(''); setSort('highest'); setStatus('Items above 10% are sorted at the top of the detail list.'); setTimeout(() => document.querySelector('.price-list-card')?.scrollIntoView({ behavior: 'smooth' }), 0) }}><span>Items Over 10%</span><b>{overTen}</b><small>View high-risk increases</small></button>
      <button type="button" className="summary-click-card tone-green" onClick={() => { setStatus('Showing invoice-derived price items in the detail list.'); setSearch('invoice'); setTimeout(() => document.querySelector('.price-list-card')?.scrollIntoView({ behavior: 'smooth' }), 0) }}><span>Invoice Items</span><b>{(appData.invoiceItems || []).length}</b><small>View invoice item details</small></button>
    </div>

    <section className="form-card tight-card price-increase-form">
      <h2>{editingId ? 'Edit Price Increase' : 'Add Price Increase'}</h2>
      <div className="employee-form-grid clean-grid">
        <label>Item name <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Item name" /></label>
        <label>Old price <input type="number" step="0.01" value={form.oldPrice} onChange={e=>setForm({...form,oldPrice:e.target.value})} placeholder="0.00" /></label>
        <label>New price <input type="number" step="0.01" value={form.newPrice} onChange={e=>setForm({...form,newPrice:e.target.value})} placeholder="0.00" /></label>
        <label>Category
          <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
            {categoryOptions.map(category => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label>Vendor
          <select value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})}>
            <option value="">No vendor</option>
            {vendorOptions.map(vendor => <option key={vendor}>{vendor}</option>)}
          </select>
        </label>
        <label>Date <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} /></label>
      </div>

      <div className="status-pill">Live increase: {Number.isFinite(livePct) ? livePct.toFixed(1) : '0.0'}%</div>

      <div className="form-action-footer">
        <button className="btn secondary" onClick={clear} type="button">{editingId ? 'Cancel Edit' : 'Clear'}</button>
        <button className="btn secondary" onClick={pullFromInvoices} type="button"><Icon name="refresh" /> Pull From Invoices</button>
        <button className="btn primary" onClick={save} type="button"><Icon name="save" /> {editingId ? 'Update Price' : 'Save Price'}</button>
      </div>
    </section>

    <section className="table-card compact-table-card price-list-card">
      <header>
        <h2>Price Increase List</h2>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn ghost small-btn" type="button" onClick={exportCSV}>CSV</button>
          <button className="btn ghost small-btn" type="button" onClick={exportExcel}>Excel</button>
          <button className="btn ghost small-btn" type="button" onClick={printReport}>Print / PDF</button>
          <select className="header-select" value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="highest">Highest Increase</option>
            <option value="dollars">Largest $ Increase</option>
            <option value="newest">Newest</option>
            <option value="az">Sorted A-Z</option>
            <option value="category">Category</option>
            <option value="vendor">Vendor</option>
          </select>
        </span>
      </header>

      <div className="sales-filter-bar report-filter-bar">
        <div className="search-box sales-search"><Icon name="search" size={18} /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search item, vendor, category..." /></div>
        <select className="filter-select" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>
          <option value="all">All Categories</option>
          {categoryOptions.map(category => <option key={category}>{category}</option>)}
        </select>
        <select className="filter-select" value={vendorFilter} onChange={e=>setVendorFilter(e.target.value)}>
          <option value="all">All Vendors</option>
          {vendorOptions.map(vendor => <option key={vendor}>{vendor}</option>)}
        </select>
      </div>

      <div className="table-scroll"><table className="price-increase-table">
        <thead><tr><th>Name</th><th>Old Price</th><th>New Price</th><th>$ Change</th><th>Increase</th><th>Category</th><th>Vendor</th><th>Date</th><th>Source</th><th>Action</th></tr></thead>
        <tbody>{sorted.map(row => {
          const increase = pct(row)
          return <tr key={row.id}>
            <td><b>{row.name}</b><small>{row.invoiceCount ? `${row.invoiceCount} invoice prices` : row.latestInvoice ? `Invoice ${row.latestInvoice}` : 'manual'}</small></td>
            <td>${money(row.oldPrice)}</td>
            <td>${money(row.newPrice)}</td>
            <td>${money(dollarChange(row))}</td>
            <td><span className={increase >= 10 ? 'tag delete-link' : increase >= 0 ? 'tag tips' : 'tag cash'}>{increase.toFixed(1)}%</span></td>
            <td>{row.category || '-'}</td>
            <td>{row.vendor || '-'}</td>
            <td>{row.date || '-'}</td>
            <td>{row.source || 'manual'}</td>
            <td className="row-actions"><button type="button" onClick={() => edit(row)}>Edit</button><button className="delete-link" type="button" onClick={() => remove(row.id)}>Delete</button></td>
          </tr>
        })}</tbody>
      </table></div>
    </section>
  </>
}

export default function EntityPage({ page }) {
  if (page === 'price-increase') return <PriceIncreasePage />
  const cfg = map[page] || map.sales
  return <>
    <div className="page-head"><div><h1>{cfg.title}</h1><p>{cfg.desc}</p></div><div className="actions"><button className="btn primary" type="button"><Icon name="plus" /> {cfg.button}</button><button className="btn secondary" type="button">Clear</button></div></div>
    <div className="workspace-grid">
      <section className="form-card"><h2>{cfg.title} Workspace</h2><div className="form-grid"><input placeholder="Search or name" /><input placeholder="Category / type" /><input placeholder="Amount / value" /><input type="date" /></div><div className="actions left"><button className="btn primary" type="button">Save</button><button className="btn danger" type="button">Delete</button></div></section>
      <section className="table-card"><header><h2>{cfg.title} List</h2><span>Sorted A–Z</span></header><table><thead><tr><th>Name</th><th>Value</th><th>Status</th><th></th></tr></thead><tbody>{cfg.rows.map((r,i)=><tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td><button type="button">Edit</button></td></tr>)}</tbody></table></section>
    </div>
  </>
}
