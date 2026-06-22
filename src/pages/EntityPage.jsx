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
  const defaults = [
    { id: 'pi-1', name: 'Beef Ribeye', oldPrice: 10.00, newPrice: 10.81, category: 'Food', vendor: '', date: new Date().toISOString().slice(0,10), source: 'manual' },
    { id: 'pi-2', name: 'Chicken Case', oldPrice: 10.00, newPrice: 10.34, category: 'Food', vendor: '', date: new Date().toISOString().slice(0,10), source: 'manual' },
    { id: 'pi-3', name: 'Beer Keg', oldPrice: 10.00, newPrice: 10.29, category: 'Beer', vendor: '', date: new Date().toISOString().slice(0,10), source: 'manual' }
  ]
  const [rows, setRows] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('priceIncreases') || 'null') || defaults } catch { return defaults }
  })
  const [sort, setSort] = React.useState('az')
  const [editingId, setEditingId] = React.useState(null)
  const [form, setForm] = React.useState({ name:'', oldPrice:'', newPrice:'', category:'Food', vendor:'', date:new Date().toISOString().slice(0,10) })
  function persist(next) { setRows(next); localStorage.setItem('priceIncreases', JSON.stringify(next)) }
  function pct(row) { const oldPrice = Number(row.oldPrice || 0); const newPrice = Number(row.newPrice || 0); return oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0 }
  function clear() { setEditingId(null); setForm({ name:'', oldPrice:'', newPrice:'', category:'Food', vendor:'', date:new Date().toISOString().slice(0,10) }) }
  function save() {
    if (!String(form.name || '').trim()) return
    const payload = { ...form, name: form.name.trim(), oldPrice: Number(form.oldPrice || 0), newPrice: Number(form.newPrice || 0), source: 'manual' }
    if (editingId) persist(rows.map(r => r.id === editingId ? { ...r, ...payload, id: editingId } : r))
    else persist([...rows, { ...payload, id: `pi-${Date.now()}` }])
    clear()
  }
  function edit(row) { setEditingId(row.id); setForm({ name: row.name || '', oldPrice: row.oldPrice ?? '', newPrice: row.newPrice ?? '', category: row.category || 'Food', vendor: row.vendor || '', date: row.date || new Date().toISOString().slice(0,10) }) }
  function remove(id) { persist(rows.filter(r => r.id !== id)); if (editingId === id) clear() }
  const sorted = [...rows].sort((a,b) => {
    if (sort === 'highest') return pct(b) - pct(a)
    if (sort === 'newest') return String(b.date || '').localeCompare(String(a.date || ''))
    if (sort === 'category') return String(a.category || '').localeCompare(String(b.category || '')) || String(a.name || '').localeCompare(String(b.name || ''))
    if (sort === 'vendor') return String(a.vendor || '').localeCompare(String(b.vendor || '')) || String(a.name || '').localeCompare(String(b.name || ''))
    return String(a.name || '').localeCompare(String(b.name || ''))
  })
  return <>
    <section className="form-card tight-card">
      <h2>{editingId ? 'Edit Price Increase' : 'Add Price Increase'}</h2>
      <div className="employee-form-grid clean-grid">
        <label>Item name <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Item name" /></label>
        <label>Old price <input type="number" step="0.01" value={form.oldPrice} onChange={e=>setForm({...form,oldPrice:e.target.value})} placeholder="0.00" /></label>
        <label>New price <input type="number" step="0.01" value={form.newPrice} onChange={e=>setForm({...form,newPrice:e.target.value})} placeholder="0.00" /></label>
        <label>Category <input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Food" /></label>
        <label>Vendor <input value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})} placeholder="Vendor" /></label>
        <label>Date <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} /></label>
      </div>
      <div className="form-action-footer"><button className="btn secondary" onClick={clear}>{editingId ? 'Cancel Edit' : 'Clear'}</button><button className="btn primary" onClick={save}><Icon name="save" /> {editingId ? 'Update Price' : 'Save Price'}</button></div>
    </section>
    <section className="table-card compact-table-card">
      <header><h2>Price Increase List</h2><span><select className="header-select" value={sort} onChange={e=>setSort(e.target.value)}><option value="az">Sorted A-Z</option><option value="highest">Highest Increase</option><option value="newest">Newest</option><option value="category">Category</option><option value="vendor">Vendor</option></select></span></header>
      <table><thead><tr><th>Name</th><th>Old Price</th><th>New Price</th><th>Increase</th><th>Category</th><th>Vendor</th><th>Date</th><th>Action</th></tr></thead><tbody>{sorted.map(row => <tr key={row.id}><td><b>{row.name}</b><small>{row.source || 'manual'}</small></td><td>${Number(row.oldPrice||0).toFixed(2)}</td><td>${Number(row.newPrice||0).toFixed(2)}</td><td><span className={pct(row) >= 0 ? 'tag tips' : 'tag cash'}>{pct(row).toFixed(1)}%</span></td><td>{row.category || '-'}</td><td>{row.vendor || '-'}</td><td>{row.date || '-'}</td><td className="row-actions"><button onClick={()=>edit(row)}>Edit</button><button className="delete-link" onClick={()=>remove(row.id)}>Delete</button></td></tr>)}</tbody></table>
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
