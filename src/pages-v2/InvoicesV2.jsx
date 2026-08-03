import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import UploadBar from '../components/UploadBar'
import { createId } from '../lib/localStore'

const today = () => new Date().toISOString().slice(0,10)
const EMPTY = { vendor_id:'',vendor_name:'',invoice_number:'',invoice_date:today(),due_date:'',category:'Food',payment_type:'Check',check_number:'',subtotal:'',tax:'',total:'',status:'Open',notes:'' }
const PAGE_SIZE=10
const money=value=>`$${Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`

export default function InvoicesV2({data,setData}){
  const [search,setSearch]=useState('')
  const [vendorFilter,setVendorFilter]=useState('all')
  const [statusFilter,setStatusFilter]=useState('all')
  const [page,setPage]=useState(1)
  const [modalOpen,setModalOpen]=useState(false)
  const [editingId,setEditingId]=useState(null)
  const [form,setForm]=useState(EMPTY)
  const [notice,setNotice]=useState('')
  const invoices=data.invoices||[]
  const vendors=data.vendors||[]
  const categories=data.vendorCategories?.length?data.vendorCategories:['Food','Beverage','Beer','Liquor','Supplies','Utilities','Other']

  const stats=useMemo(()=>({total:invoices.length,open:invoices.filter(i=>String(i.status||'Open').toLowerCase()==='open'),paid:invoices.filter(i=>String(i.status||'').toLowerCase()==='paid'),overdue:invoices.filter(i=>String(i.status||'').toLowerCase()==='overdue')}),[invoices])
  const monthTotal=useMemo(()=>invoices.reduce((s,i)=>s+Number(i.total??i.amount??0),0),[invoices])
  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return [...invoices].sort((a,b)=>String(b.invoice_date||b.date||'').localeCompare(String(a.invoice_date||a.date||''))).filter(i=>(!q||`${i.invoice_number} ${i.vendor_name||i.vendor} ${i.status}`.toLowerCase().includes(q))&&(vendorFilter==='all'||i.vendor_id===vendorFilter||i.vendor_name===vendorFilter)&&(statusFilter==='all'||String(i.status||'Open').toLowerCase()===statusFilter))},[invoices,search,vendorFilter,statusFilter])
  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));const visible=filtered.slice((Math.min(page,totalPages)-1)*PAGE_SIZE,Math.min(page,totalPages)*PAGE_SIZE)
  const openAdd=()=>{setEditingId(null);setForm(EMPTY);setModalOpen(true)}
  const openEdit=inv=>{setEditingId(inv.id);setForm({...EMPTY,...inv,invoice_date:inv.invoice_date||inv.date||today(),vendor_name:inv.vendor_name||inv.vendor||''});setModalOpen(true)}
  const closeModal=()=>{setModalOpen(false);setEditingId(null);setForm(EMPTY)}
  function updateVendor(id){const vendor=vendors.find(v=>v.id===id);setForm({...form,vendor_id:id,vendor_name:vendor?.name||''})}
  function saveInvoice(e){e.preventDefault();if(!form.vendor_name.trim()){setNotice('Vendor is required.');return}const subtotal=Number(form.subtotal||0),tax=Number(form.tax||0),total=Number(form.total||subtotal+tax);const record={...form,subtotal,tax,total};setData(prev=>({...prev,invoices:editingId?(prev.invoices||[]).map(i=>i.id===editingId?{...i,...record,id:editingId}:i):[...(prev.invoices||[]),{...record,id:createId('invoice')}]}));setNotice(editingId?'Invoice updated.':'Invoice added.');closeModal()}
  function deleteInvoice(inv){if(!window.confirm(`Delete invoice ${inv.invoice_number||''}?`))return;setData(prev=>({...prev,invoices:(prev.invoices||[]).filter(i=>i.id!==inv.id),invoiceItems:(prev.invoiceItems||[]).filter(item=>item.invoice_id!==inv.id)}));setNotice('Invoice deleted.')}
  function clearFilters(){setSearch('');setVendorFilter('all');setStatusFilter('all');setPage(1)}
  function handleUpload(e){const file=e.target.files?.[0];if(!file)return;setNotice(`${file.name} selected. Open Add Invoice to review and save extracted details.`);e.target.value=''}
  const cards=[['invoices','Total Invoices',stats.total,'purple'],['alert','Open',`${stats.open.length}\n${money(stats.open.reduce((s,i)=>s+Number(i.total||0),0))}`,'orange'],['check','Paid',`${stats.paid.length}\n${money(stats.paid.reduce((s,i)=>s+Number(i.total||0),0))}`,'green'],['calendar','Overdue',`${stats.overdue.length}\n${money(stats.overdue.reduce((s,i)=>s+Number(i.total||0),0))}`,'pink'],['dollar','This Month',money(monthTotal),'blue']]
  return <div className="rv2-mock-page rv2-invoices-mock">
    <div className="rv2-mock-action-row"><UploadBar label="Upload Invoice" accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx" onChange={handleUpload}/><button className="rv2-orange-button" onClick={openAdd}><Icon name="plus" size={17}/> Add Invoice</button></div>
    {notice&&<div className="rv2-inline-notice" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
    <div className="rv2-stat-grid rv2-stat-grid-five">{cards.map(([icon,label,value,tone])=><div className={`rv2-stat-card tone-${tone}`} key={label}><div className="rv2-stat-label"><span><Icon name={icon} size={13}/></span>{label}</div><strong className="rv2-multiline-value">{value}</strong></div>)}</div>
    <section className="rv2-data-panel"><div className="rv2-filter-row"><label className="rv2-search-control"><Icon name="search" size={16}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Search invoices..."/></label><select value={vendorFilter} onChange={e=>{setVendorFilter(e.target.value);setPage(1)}}><option value="all">All Vendors</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select><select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}><option value="all">All Status</option><option value="open">Open</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select><button className="rv2-clear-button" onClick={clearFilters}>Clear Filters</button></div>
    <div className="rv2-table-scroll"><table className="rv2-mock-table"><thead><tr><th>Invoice #</th><th>Vendor</th><th>Date</th><th>Due Date</th><th>Total</th><th>Paid</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.length?visible.map(inv=><tr key={inv.id}><td><strong>{inv.invoice_number||'—'}</strong></td><td>{inv.vendor_name||inv.vendor||'—'}</td><td>{inv.invoice_date||inv.date||'—'}</td><td>{inv.due_date||'—'}</td><td>{money(inv.total??inv.amount)}</td><td>{money(inv.paid_amount??(String(inv.status||'').toLowerCase()==='paid'?inv.total:0))}</td><td><span className={`rv2-badge status-${String(inv.status||'open').toLowerCase()}`}>{inv.status||'Open'}</span></td><td><div className="rv2-row-icon-actions"><button onClick={()=>openEdit(inv)}><Icon name="edit" size={15}/></button><button className="danger" onClick={()=>deleteInvoice(inv)}><Icon name="trash" size={15}/></button></div></td></tr>):<tr><td colSpan="8" className="rv2-empty-row">No invoices match the selected filters.</td></tr>}</tbody></table></div>
    <div className="rv2-table-footer"><div>Show <select value={PAGE_SIZE} disabled><option>{PAGE_SIZE}</option></select> entries</div><div className="rv2-pagination"><button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>‹</button>{Array.from({length:totalPages},(_,i)=>i+1).slice(0,5).map(n=><button key={n} className={page===n?'is-active':''} onClick={()=>setPage(n)}>{n}</button>)}<button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>›</button></div></div></section>
    {modalOpen&&<div className="rv2-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&closeModal()}><section className="rv2-form-modal rv2-form-modal-wide" role="dialog" aria-modal="true"><header><div className="rv2-modal-title"><span><Icon name="invoices" size={23}/></span><div><h2>{editingId?'Edit Invoice':'Add Invoice'}</h2><p>Enter invoice details and payment information.</p></div></div><button className="rv2-modal-close" onClick={closeModal}><Icon name="x" size={18}/></button></header><form onSubmit={saveInvoice}><div className="rv2-form-grid">
      <label>Vendor<select value={form.vendor_id} onChange={e=>updateVendor(e.target.value)}><option value="">Select vendor</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><label>Manual Vendor Name<input value={form.vendor_name} onChange={e=>setForm({...form,vendor_name:e.target.value,vendor_id:''})} placeholder="Vendor name"/></label>
      <label>Invoice Number<input value={form.invoice_number} onChange={e=>setForm({...form,invoice_number:e.target.value})} placeholder="Invoice #"/></label><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Invoice Date<input type="date" value={form.invoice_date} onChange={e=>setForm({...form,invoice_date:e.target.value})}/></label><label>Due Date<input type="date" value={form.due_date||''} onChange={e=>setForm({...form,due_date:e.target.value})}/></label>
      <label>Subtotal<input type="number" step="0.01" min="0" value={form.subtotal} onChange={e=>setForm({...form,subtotal:e.target.value})} placeholder="0.00"/></label><label>Tax<input type="number" step="0.01" min="0" value={form.tax} onChange={e=>setForm({...form,tax:e.target.value})} placeholder="0.00"/></label>
      <label>Total<input type="number" step="0.01" min="0" value={form.total} onChange={e=>setForm({...form,total:e.target.value})} placeholder="Auto from subtotal + tax"/></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Open</option><option>Paid</option><option>Overdue</option></select></label>
      <label>Payment Type<select value={form.payment_type} onChange={e=>setForm({...form,payment_type:e.target.value})}><option>Cash</option><option>Check</option><option>Credit Card</option><option>ACH</option></select></label><label>Check Number<input value={form.check_number||''} onChange={e=>setForm({...form,check_number:e.target.value})} placeholder="Optional"/></label>
      <label className="span-2">Notes<textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Additional notes"/></label>
    </div><footer><button className="rv2-clear-button" type="button" onClick={closeModal}>Cancel</button><button className="rv2-orange-button" type="submit"><Icon name="save" size={16}/>{editingId?'Update Invoice':'Save Invoice'}</button></footer></form></section></div>}
  </div>
}
