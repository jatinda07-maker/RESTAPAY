import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { createId, sortByName } from '../lib/localStore'

const EMPTY = { name:'', category:'Food', contact:'', phone:'', email:'', default_check_number:'', notes:'', is_active:true }
const PAGE_SIZE = 10
const money = value => `$${Number(value || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`
const cleanDate = value => String(value || '').slice(0,10)

export default function VendorsV2({ data, setData }) {
  const [search,setSearch] = useState('')
  const [category,setCategory] = useState('all')
  const [status,setStatus] = useState('all')
  const [page,setPage] = useState(1)
  const [activeTab,setActiveTab] = useState('list')
  const [modalOpen,setModalOpen] = useState(false)
  const [editingId,setEditingId] = useState(null)
  const [form,setForm] = useState(EMPTY)
  const [notice,setNotice] = useState('')

  const vendors = data.vendors || []
  const invoices = data.invoices || []
  const categories = data.vendorCategories?.length ? data.vendorCategories : ['Food','Beverage','Beer','Liquor','Supplies','Utilities','Maintenance','Other']

  const vendorRows = useMemo(() => sortByName(vendors).map(vendor => {
    const related = invoices.filter(inv => inv.vendor_id === vendor.id || String(inv.vendor_name || inv.vendor || '').trim().toLowerCase() === String(vendor.name || '').trim().toLowerCase())
    const totalSpent = related.reduce((sum,inv) => sum + Number(inv.total ?? inv.amount ?? inv.subtotal ?? 0),0)
    const lastInvoice = related.map(inv => cleanDate(inv.invoice_date || inv.date)).filter(Boolean).sort().reverse()[0] || '—'
    return {...vendor, invoice_count:related.length, total_spent:totalSpent, last_invoice:lastInvoice}
  }),[vendors,invoices])

  const stats = useMemo(() => ({
    total: vendorRows.length,
    active: vendorRows.filter(v => v.is_active !== false).length,
    invoices: invoices.length,
    spent: invoices.reduce((sum,inv)=>sum+Number(inv.total ?? inv.amount ?? inv.subtotal ?? 0),0),
    month: invoices.reduce((sum,inv)=>sum+Number(inv.total ?? inv.amount ?? inv.subtotal ?? 0),0),
  }),[vendorRows,invoices])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vendorRows.filter(v => (!q || `${v.name} ${v.category} ${v.contact} ${v.phone} ${v.email}`.toLowerCase().includes(q)) && (category==='all' || v.category===category) && (status==='all' || (status==='active' ? v.is_active!==false : v.is_active===false)))
  },[vendorRows,search,category,status])

  const totalPages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))
  const visible = filtered.slice((Math.min(page,totalPages)-1)*PAGE_SIZE,Math.min(page,totalPages)*PAGE_SIZE)
  const openAdd = () => { setEditingId(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = vendor => { setEditingId(vendor.id); setForm({...EMPTY,...vendor}); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(EMPTY) }

  function saveVendor(event){
    event.preventDefault()
    if(!form.name.trim()){ setNotice('Vendor name is required.'); return }
    const record = {...form,name:form.name.trim(),is_active:Boolean(form.is_active)}
    setData(prev => ({...prev,vendors:sortByName(editingId ? (prev.vendors||[]).map(v=>v.id===editingId?{...v,...record,id:editingId}:v) : [...(prev.vendors||[]),{...record,id:createId('vendor')}])}))
    setNotice(editingId?'Vendor updated.':'Vendor added.')
    closeModal()
  }
  function deleteVendor(vendor){
    if(!window.confirm(`Delete ${vendor.name}?`)) return
    setData(prev=>({...prev,vendors:(prev.vendors||[]).filter(v=>v.id!==vendor.id)}))
    setNotice('Vendor deleted.')
  }
  function clearFilters(){ setSearch(''); setCategory('all'); setStatus('all'); setPage(1) }

  const cards = [
    ['store','Total Vendors',stats.total,'purple'],['check','Active Vendors',stats.active,'green'],['invoices','Invoices',stats.invoices,'blue'],['dollar','Total Spent',money(stats.spent),'orange'],['calendar','This Month',money(stats.month),'pink']
  ]

  return <div className="rv2-mock-page rv2-vendors-mock">
    {notice && <div className="rv2-inline-notice" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
    <div className="rv2-stat-grid rv2-stat-grid-five">{cards.map(([icon,label,value,tone])=><div className={`rv2-stat-card tone-${tone}`} key={label}><div className="rv2-stat-label"><span><Icon name={icon} size={13}/></span>{label}</div><strong>{value}</strong></div>)}</div>
    <div className="rv2-tab-row">
      <button className={activeTab==='list'?'is-active':''} onClick={()=>setActiveTab('list')}><Icon name="store" size={15}/>Vendor List</button>
      <button className={activeTab==='add'?'is-active':''} onClick={openAdd}><Icon name="plus" size={15}/>Add Vendor</button>
      <button className={activeTab==='duplicates'?'is-active':''} onClick={()=>setActiveTab('duplicates')}><Icon name="compare" size={15}/>Duplicate Review</button>
      <button className={activeTab==='activity'?'is-active':''} onClick={()=>setActiveTab('activity')}><Icon name="history" size={15}/>Activity</button>
    </div>
    <section className="rv2-data-panel">
      <div className="rv2-filter-row">
        <label className="rv2-search-control"><Icon name="search" size={16}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Search vendors..."/></label>
        <select value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option value="all">All Categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select>
        <select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <button className="rv2-clear-button" onClick={clearFilters}>Clear Filters</button>
        <button className="rv2-orange-button rv2-filter-action" onClick={openAdd}><Icon name="plus" size={16}/> Add Vendor</button>
      </div>
      <div className="rv2-table-scroll"><table className="rv2-mock-table"><thead><tr><th>Vendor</th><th>Category</th><th>Invoices</th><th>Total Spent</th><th>Last Invoice</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {visible.length?visible.map(v=><tr key={v.id}><td><strong>{v.name}</strong></td><td><span className="rv2-badge category-badge">{v.category||'Other'}</span></td><td>{v.invoice_count}</td><td>{money(v.total_spent)}</td><td>{v.last_invoice}</td><td><span className={`rv2-badge ${v.is_active===false?'status-inactive':'status-active'}`}>{v.is_active===false?'Inactive':'Active'}</span></td><td><div className="rv2-row-icon-actions"><button title="Edit vendor" onClick={()=>openEdit(v)}><Icon name="edit" size={15}/></button><button className="danger" title="Delete vendor" onClick={()=>deleteVendor(v)}><Icon name="trash" size={15}/></button></div></td></tr>):<tr><td colSpan="7" className="rv2-empty-row">No vendors match the selected filters.</td></tr>}
      </tbody></table></div>
      <div className="rv2-table-footer"><div>Show <select value={PAGE_SIZE} disabled><option>{PAGE_SIZE}</option></select> entries</div><div className="rv2-pagination"><button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>‹</button>{Array.from({length:totalPages},(_,i)=>i+1).slice(0,5).map(n=><button key={n} className={page===n?'is-active':''} onClick={()=>setPage(n)}>{n}</button>)}<button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>›</button></div></div>
    </section>
    {modalOpen&&<div className="rv2-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&closeModal()}><section className="rv2-form-modal" role="dialog" aria-modal="true"><header><div className="rv2-modal-title"><span><Icon name="vendors" size={23}/></span><div><h2>{editingId?'Edit Vendor':'Add Vendor'}</h2><p>Manage vendor details, category, contact, and payment defaults.</p></div></div><button className="rv2-modal-close" onClick={closeModal}><Icon name="x" size={18}/></button></header><form onSubmit={saveVendor}><div className="rv2-form-grid">
      <label className="span-2">Vendor Name<input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Enter vendor name"/></label>
      <label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Default Check #<input value={form.default_check_number||''} onChange={e=>setForm({...form,default_check_number:e.target.value})} placeholder="Optional"/></label>
      <label>Contact Person<input value={form.contact||''} onChange={e=>setForm({...form,contact:e.target.value})} placeholder="Contact name"/></label><label>Phone<input value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone number"/></label>
      <label className="span-2">Email<input type="email" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})} placeholder="email@example.com"/></label><label className="span-2">Notes<textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Additional notes"/></label>
      <label className="rv2-check-field span-2"><input type="checkbox" checked={form.is_active!==false} onChange={e=>setForm({...form,is_active:e.target.checked})}/><span>Active vendor</span></label>
    </div><footer><button className="rv2-clear-button" type="button" onClick={closeModal}>Cancel</button><button className="rv2-orange-button" type="submit"><Icon name="save" size={16}/>{editingId?'Update Vendor':'Save Vendor'}</button></footer></form></section></div>}
  </div>
}
