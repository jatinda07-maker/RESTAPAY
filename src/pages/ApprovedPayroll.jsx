import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'

const PAY_METHODS = ['Cash', 'Check', 'ACH', 'Card', 'Other']
const STATUSES = ['Pending', 'Paid', 'Void']
function num(v){ return Number(String(v ?? '').replace(/[$,%]/g,'')) || 0 }
function money(v){ return num(v).toFixed(2) }
function today(){ return new Date().toISOString().slice(0,10) }

export default function ApprovedPayroll({ data, setData }) {
  const rows = data.approvedPayroll || []
  const [search,setSearch]=useState('')
  const [statusFilter,setStatusFilter]=useState('all')
  const [editing,setEditing]=useState(null)
  const [form,setForm]=useState({})
  const [selectedIds,setSelectedIds]=useState([])
  const [bulk,setBulk]=useState({ payment_type:'', payment_status:'', check_number:'', pay_date:'' })

  const filtered=useMemo(()=>rows.filter(r=>{
    const q=search.trim().toLowerCase()
    const matches=!q || [r.employee_name,r.check_number,r.payment_type,r.pay_date,r.pay_period_start,r.pay_period_end].some(v=>String(v||'').toLowerCase().includes(q))
    const status=statusFilter==='all' || String(r.payment_status||'Pending').toLowerCase()===statusFilter
    return matches && status
  }).sort((a,b)=>String(b.pay_date||b.approved_at||'').localeCompare(String(a.pay_date||a.approved_at||''))),[rows,search,statusFilter])

  const totals=useMemo(()=>filtered.reduce((a,r)=>{const v=num(r.approved_amount);a.total+=v;a[String(r.payment_type||'Other').toLowerCase()]=(a[String(r.payment_type||'Other').toLowerCase()]||0)+v;return a},{total:0,cash:0,check:0,ach:0,card:0,other:0}),[filtered])
  const allVisibleSelected=filtered.length>0 && filtered.every(r=>selectedIds.includes(r.id))

  function toggle(id){ setSelectedIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]) }
  function toggleAll(){ const ids=filtered.map(r=>r.id); setSelectedIds(current=>allVisibleSelected?current.filter(id=>!ids.includes(id)):Array.from(new Set([...current,...ids]))) }
  function edit(row){setEditing(row.id);setForm({...row})}
  function save(){
    setData(prev=>({...prev,approvedPayroll:(prev.approvedPayroll||[]).map(r=>r.id===editing?{...r,...form,approved_amount:num(form.approved_amount),updated_at:new Date().toISOString()}:r)}))
    setEditing(null)
  }
  function remove(id){ if(!window.confirm('Delete this approved payroll record?')) return; setData(prev=>({...prev,approvedPayroll:(prev.approvedPayroll||[]).filter(r=>r.id!==id)})); setSelectedIds(ids=>ids.filter(x=>x!==id)) }
  function bulkDelete(){ if(!selectedIds.length) return; if(!window.confirm(`Delete ${selectedIds.length} selected payroll records?`)) return; setData(prev=>({...prev,approvedPayroll:(prev.approvedPayroll||[]).filter(r=>!selectedIds.includes(r.id))})); setSelectedIds([]) }
  function applyBulk(){
    if(!selectedIds.length) return
    const changes={}
    if(bulk.payment_type) changes.payment_type=bulk.payment_type
    if(bulk.payment_status){ changes.payment_status=bulk.payment_status; if(bulk.payment_status==='Paid') changes.paid_date=today() }
    if(bulk.check_number.trim()) changes.check_number=bulk.check_number.trim()
    if(bulk.pay_date) changes.pay_date=bulk.pay_date
    if(!Object.keys(changes).length) return
    setData(prev=>({...prev,approvedPayroll:(prev.approvedPayroll||[]).map(r=>selectedIds.includes(r.id)?{...r,...changes,updated_at:new Date().toISOString()}:r)}))
    setBulk({payment_type:'',payment_status:'',check_number:'',pay_date:''})
  }

  return <div className="page-stack approved-payroll-page payroll-approved-modern">
    <section className="summary-grid compact-summary payroll-approved-summary">
      {[['Approved Total',totals.total],['Cash',totals.cash],['Check',totals.check],['ACH',totals.ach]].map(([label,value])=><article className="summary-card" key={label}><span>{label}</span><strong>${money(value)}</strong></article>)}
    </section>
    <section className="card payroll-approved-card">
      <header className="section-header"><div><h2>Approved Payroll</h2><p>One condensed record per employee for the selected payroll period. Records remain editable until payment is finalized.</p></div></header>
      <div className="toolbar-row payroll-approved-filters"><input type="search" placeholder="Search employee, date, or check number" value={search} onChange={e=>setSearch(e.target.value)}/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="void">Void</option></select></div>
      <div className="payroll-bulk-toolbar">
        <strong>{selectedIds.length} selected</strong>
        <select value={bulk.payment_type} onChange={e=>setBulk(v=>({...v,payment_type:e.target.value}))}><option value="">Payment type</option>{PAY_METHODS.map(x=><option key={x}>{x}</option>)}</select>
        <select value={bulk.payment_status} onChange={e=>setBulk(v=>({...v,payment_status:e.target.value}))}><option value="">Status</option>{STATUSES.map(x=><option key={x}>{x}</option>)}</select>
        <input value={bulk.check_number} onChange={e=>setBulk(v=>({...v,check_number:e.target.value}))} placeholder="Check #" />
        <input type="date" value={bulk.pay_date} onChange={e=>setBulk(v=>({...v,pay_date:e.target.value}))}/>
        <button className="btn primary" disabled={!selectedIds.length} onClick={applyBulk}>Apply Bulk Edit</button>
        <button className="btn danger" disabled={!selectedIds.length} onClick={bulkDelete}><Icon name="trash" size={14}/> Delete Selected</button>
      </div>
      <div className="table-wrap payroll-approved-table"><table><thead><tr><th><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll}/></th><th>Employee</th><th>Pay Period</th><th>Pay Date</th><th>Hours</th><th>Original Tips</th><th>Withheld</th><th>Extra Pay</th><th>Approved Amount</th><th>Payment</th><th>Check #</th><th>Status</th><th></th></tr></thead><tbody>{filtered.length?filtered.map(r=><tr key={r.id}><td><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={()=>toggle(r.id)}/></td><td><b>{r.employee_name}</b><small>{r.group_name||r.payroll_classification||''}</small></td><td>{r.pay_period_start||r.period_start||'—'}<small>{(r.pay_period_end||r.period_end) && (r.pay_period_end||r.period_end)!==(r.pay_period_start||r.period_start)?`to ${r.pay_period_end||r.period_end}`:''}</small></td><td>{r.pay_date||'—'}</td><td>{money(r.hours)}</td><td>${money(r.original_tips)}</td><td>${money(r.tip_deduction)}</td><td>${money(r.extra_pay)}</td><td><b>${money(r.approved_amount)}</b></td><td>{r.payment_type||'Check'}</td><td>{r.check_number||'—'}</td><td><span className="status-pill-modern">{r.payment_status||'Pending'}</span></td><td><div className="row-actions"><button onClick={()=>edit(r)} title="Edit"><Icon name="edit" size={14}/></button><button onClick={()=>remove(r.id)} title="Delete"><Icon name="trash" size={14}/></button></div></td></tr>):<tr><td colSpan="13" className="empty-cell">No approved payroll records.</td></tr>}</tbody></table></div>
    </section>
    {editing&&<div className="payroll-edit-overlay" onClick={()=>setEditing(null)}><section className="payroll-edit-modal" onClick={e=>e.stopPropagation()}><header><div><h2>Edit Approved Payroll</h2><p>Edit the final employee total, payment details, or status.</p></div><button className="modal-close" onClick={()=>setEditing(null)}>×</button></header><div className="payroll-edit-grid"><label>Employee<input value={form.employee_name||''} disabled/></label><label>Hours<input type="number" step="0.01" value={form.hours??''} onChange={e=>setForm(f=>({...f,hours:e.target.value}))}/></label><label>Original Tips<input type="number" step="0.01" value={form.original_tips??''} onChange={e=>setForm(f=>({...f,original_tips:e.target.value}))}/></label><label>Tips Withheld<input type="number" step="0.01" value={form.tip_deduction??''} onChange={e=>setForm(f=>({...f,tip_deduction:e.target.value}))}/></label><label>Extra Pay<input type="number" step="0.01" value={form.extra_pay??''} onChange={e=>setForm(f=>({...f,extra_pay:e.target.value}))}/></label><label>Extra Pay Reason<input value={form.extra_reason||''} onChange={e=>setForm(f=>({...f,extra_reason:e.target.value}))}/></label><label>Approved Amount<input type="number" step="0.01" value={form.approved_amount??''} onChange={e=>setForm(f=>({...f,approved_amount:e.target.value}))}/></label><label>Payment Type<select value={form.payment_type||'Check'} onChange={e=>setForm(f=>({...f,payment_type:e.target.value}))}>{PAY_METHODS.map(x=><option key={x}>{x}</option>)}</select></label><label>Check Number<input value={form.check_number||''} onChange={e=>setForm(f=>({...f,check_number:e.target.value}))}/></label><label>Pay Date<input type="date" value={form.pay_date||''} onChange={e=>setForm(f=>({...f,pay_date:e.target.value}))}/></label><label>Status<select value={form.payment_status||'Pending'} onChange={e=>setForm(f=>({...f,payment_status:e.target.value,paid_date:e.target.value==='Paid'?(f.paid_date||today()):f.paid_date}))}>{STATUSES.map(x=><option key={x}>{x}</option>)}</select></label><label>Paid Date<input type="date" value={form.paid_date||''} onChange={e=>setForm(f=>({...f,paid_date:e.target.value}))}/></label><label className="wide">Notes<textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label></div><footer><button className="btn secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="btn primary" onClick={save}>Save Changes</button></footer></section></div>}
  </div>
}
