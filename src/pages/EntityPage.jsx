import React from 'react'
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
    { id: 'pi-1', name: 'Beef Ribeye', oldPrice: 10.00, newPrice: 10.81, category: 'Food', vendor: '', date: today, lastDate: today, currentDate: today, source: 'manual' },
    { id: 'pi-2', name: 'Chicken Case', oldPrice: 10.00, newPrice: 10.34, category: 'Food', vendor: '', date: today, lastDate: today, currentDate: today, source: 'manual' },
    { id: 'pi-3', name: 'Beer Keg', oldPrice: 10.00, newPrice: 10.29, category: 'Beer', vendor: '', date: today, lastDate: today, currentDate: today, source: 'manual' }
  ]

  const [rows, setRows] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('priceIncreases') || 'null') || defaults } catch { return defaults }
  })
  const [sort, setSort] = React.useState('highest')
  const [editingId, setEditingId] = React.useState(null)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState('all')
  const [vendorFilter, setVendorFilter] = React.useState('all')
  const [status, setStatus] = React.useState("Manual price tracking is ready. Pull from invoices to compare each item's previous invoice date against the latest invoice date.")
  const [form, setForm] = React.useState({ name:'', oldPrice:'', newPrice:'', category:'Food', vendor:'', lastDate: today, currentDate: today })

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

  function unitPrice(item) {
    const direct = Number(item.unit_price || item.price || item.unit || item.rate || 0)
    if (direct) return direct
    const qty = Number(item.qty || item.quantity || 0)
    const total = Number(item.total || item.amount || item.line_total || 0)
    return qty > 0 ? total / qty : total
  }

  function pct(row) {
    const oldPrice = Number(row.oldPrice || 0)
    const newPrice = Number(row.newPrice || 0)
    return oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0
  }

  function dollarChange(row) {
    return Number(row.newPrice || 0) - Number(row.oldPrice || 0)
  }

  function changeLabel(row) {
    const change = dollarChange(row)
    if (change > 0) return 'Increase'
    if (change < 0) return 'Decrease'
    return 'No change'
  }

  function changeClass(row) {
    const change = dollarChange(row)
    if (change > 0) return pct(row) >= 10 ? 'tag delete-link' : 'tag tips'
    if (change < 0) return 'tag cash'
    return 'tag neutral'
  }

  function compareDate(row, fallback = today) {
    return String(row?.currentDate || row?.date || row?.invoice_date || row?.created_at || fallback).slice(0, 10)
  }

  function previousDate(row, fallback = today) {
    return String(row?.lastDate || row?.previousDate || row?.firstDate || row?.date || fallback).slice(0, 10)
  }

  function clear() {
    setEditingId(null)
    setForm({ name:'', oldPrice:'', newPrice:'', category:'Food', vendor:'', lastDate: today, currentDate: today })
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
      date: form.currentDate || form.date || today,
      lastDate: form.lastDate || form.date || today,
      currentDate: form.currentDate || form.date || today,
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
      lastDate: row.lastDate || row.firstDate || row.previousDate || row.date || today,
      currentDate: row.currentDate || row.date || today
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
      records.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.invoice).localeCompare(String(b.invoice)))
      if (records.length < 2) return

      const latest = records[records.length - 1]
      const previous = records[records.length - 2]
      const oldPrice = Number(previous.price || 0)
      const newPrice = Number(latest.price || 0)
      if (!oldPrice || !newPrice) return

      generated.push({
        id: `pi-auto-${norm(latest.vendor)}-${norm(latest.name)}-${Date.now()}-${generated.length}`,
        name: latest.name,
        oldPrice,
        newPrice,
        category: latest.category || previous.category || 'Other',
        vendor: latest.vendor || previous.vendor || '',
        date: latest.date || today,
        lastDate: previous.date || today,
        currentDate: latest.date || today,
        previousInvoice: previous.invoice,
        latestInvoice: latest.invoice,
        invoiceCount: records.length,
        source: 'invoice'
      })
    })

    if (!generated.length) {
      setStatus('Invoice line items were found, but each item needs at least two dated prices to compare last date vs current date.')
      return
    }

    const manualRows = rows.filter(row => row.source !== 'invoice')
    const merged = [...generated, ...manualRows]
    persist(merged)
    setStatus(`Pulled ${generated.length} item comparisons from invoices. Each row compares the previous invoice date to the latest invoice date.`)
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
  const decreased = rows.filter(row => dollarChange(row) < 0).length
  const livePct = pct({ oldPrice: form.oldPrice, newPrice: form.newPrice })

  return <>
    <div className="status-pill">{status}</div>

    <div className="payroll-summary-row sales-summary-row">
      <div><span>Tracked Items</span><b>{rows.length}</b></div>
      <div><span>Largest Increase</span><b>{biggest ? `${pct(biggest).toFixed(1)}%` : '0.0%'}</b></div>
      <div><span>Items Over 10%</span><b>{overTen}</b></div>
      <div><span>Decreases</span><b>{decreased}</b></div>
      <div><span>Invoice Items</span><b>{(appData.invoiceItems || []).length}</b></div>
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
        <label>Last date <input type="date" value={form.lastDate} onChange={e=>setForm({...form,lastDate:e.target.value})} /></label>
        <label>Current date <input type="date" value={form.currentDate} onChange={e=>setForm({...form,currentDate:e.target.value})} /></label>
      </div>

      <div className="status-pill">Live change: {Number.isFinite(livePct) ? livePct.toFixed(1) : '0.0'}% ({money(dollarChange({ oldPrice: form.oldPrice, newPrice: form.newPrice }))})</div>

      <div className="form-action-footer">
        <button className="btn secondary" onClick={clear}>{editingId ? 'Cancel Edit' : 'Clear'}</button>
        <button className="btn secondary" onClick={pullFromInvoices}><Icon name="refresh" /> Pull From Invoices</button>
        <button className="btn primary" onClick={save}><Icon name="save" /> {editingId ? 'Update Price' : 'Save Price'}</button>
      </div>
    </section>

    <section className="table-card compact-table-card">
      <header>
        <h2>Price Increase List</h2>
        <span>
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

      <table>
        <thead><tr><th>Name</th><th>Last Date</th><th>Last Price</th><th>Current Date</th><th>Current Price</th><th>$ Change</th><th>% Change</th><th>Status</th><th>Category</th><th>Vendor</th><th>Source</th><th>Action</th></tr></thead>
        <tbody>{sorted.map(row => {
          const increase = pct(row)
          return <tr key={row.id}>
            <td><b>{row.name}</b><small>{row.invoiceCount ? `${row.invoiceCount} invoice prices` : row.latestInvoice ? `Invoice ${row.latestInvoice}` : 'manual'}{row.previousInvoice ? ` | Previous ${row.previousInvoice}` : ''}</small></td>
            <td>{previousDate(row)}</td>
            <td>${money(row.oldPrice)}</td>
            <td>{compareDate(row)}</td>
            <td>${money(row.newPrice)}</td>
            <td>{dollarChange(row) >= 0 ? '+' : '-'}${money(Math.abs(dollarChange(row)))}</td>
            <td><span className={changeClass(row)}>{increase >= 0 ? '+' : ''}{increase.toFixed(1)}%</span></td>
            <td><span className={changeClass(row)}>{changeLabel(row)}</span></td>
            <td>{row.category || '-'}</td>
            <td>{row.vendor || '-'}</td>
            <td>{row.source || 'manual'}</td>
            <td className="row-actions"><button onClick={()=>edit(row)}>Edit</button><button className="delete-link" onClick={()=>remove(row.id)}>Delete</button></td>
          </tr>
        })}</tbody>
      </table>
    </section>
  </>
}

export default function EntityPage({ page }) {
  if (page === 'price-increase') return <PriceIncreasePage />
  const cfg = map[page] || map.sales
  return <>
    <div className="page-head"><div><h1>{cfg.title}</h1><p>{cfg.desc}</p></div><div className="actions"><button className="btn primary"><Icon name="plus" /> {cfg.button}</button><button className="btn secondary">Clear</button></div></div>
    <div className="workspace-grid">
      <section className="form-card"><h2>{cfg.title} Workspace</h2><div className="form-grid"><input placeholder="Search or name" /><input placeholder="Category / type" /><input placeholder="Amount / value" /><input type="date" /></div><div className="actions left"><button className="btn primary">Save</button><button className="btn danger">Delete</button></div></section>
      <section className="table-card"><header><h2>{cfg.title} List</h2><span>Sorted A–Z</span></header><table><thead><tr><th>Name</th><th>Value</th><th>Status</th><th></th></tr></thead><tbody>{cfg.rows.map((r,i)=><tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td><button>Edit</button></td></tr>)}</tbody></table></section>
    </div>
  </>
}
