import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'

function num(v){ return Number(String(v ?? '').replace(/[$,%]/g,'')) || 0 }
function money(v){ return num(v).toFixed(2) }
function today(){ return new Date().toISOString().slice(0,10) }

export default function ApprovedPayroll({ data, setData }) {
  const rows = useMemo(() => {
    const stored = Array.isArray(data.approvedPayroll) ? data.approvedPayroll : []
    const storedSources = new Set(stored.map(row => row.source_payroll_entry_id).filter(Boolean))
    const derived = (data.payrollEntries || [])
      .filter(entry => String(entry.approval_status || '').toLowerCase() === 'approved' || entry.approved_payroll_id)
      .filter(entry => !storedSources.has(entry.id))
      .map(entry => ({
        id: entry.approved_payroll_id || `approved-${entry.id}`,
        source_payroll_entry_id: entry.id,
        employee_id: entry.employee_id || '',
        employee_name: entry.employee_name || 'Employee',
        group_name: entry.group_name || '',
        payroll_classification: entry.payroll_classification || '',
        pay_date: entry.pay_date || entry.payroll_date || '',
        pay_period_start: entry.pay_period_start || '',
        pay_period_end: entry.pay_period_end || '',
        original_amount: num(entry.total_pay || entry.total || entry.amount),
        approved_amount: num(entry.total_pay || entry.total || entry.amount),
        payment_type: entry.payroll_type || entry.payment_method || entry.method || 'Check',
        check_number: entry.check_number || '',
        payment_status: entry.payment_status || 'Pending',
        paid_date: entry.paid_date || '',
        notes: entry.notes || '',
        approved_at: entry.approved_at || entry.updated_at || entry.created_at || '',
        updated_at: entry.updated_at || entry.approved_at || ''
      }))
    return [...stored, ...derived]
  }, [data.approvedPayroll, data.payrollEntries])
  const [search,setSearch]=useState('')
  const [statusFilter,setStatusFilter]=useState('all')
  const [editing,setEditing]=useState(null)
  const [form,setForm]=useState({})
  const filtered=useMemo(()=>rows.filter(r=>{
    const q=search.trim().toLowerCase()
    const matches=!q || [r.employee_name,r.check_number,r.payment_type,r.pay_date,r.pay_period_start,r.pay_period_end].some(v=>String(v||'').toLowerCase().includes(q))
    const status=statusFilter==='all' || String(r.payment_status||'Pending').toLowerCase()===statusFilter
    return matches && status
  }).sort((a,b)=>String(b.approved_at||'').localeCompare(String(a.approved_at||''))),[rows,search,statusFilter])
  const totals=useMemo(()=>filtered.reduce((a,r)=>{const v=num(r.approved_amount);a.total+=v;a[String(r.payment_type||'Other').toLowerCase()]=(a[String(r.payment_type||'Other').toLowerCase()]||0)+v;return a},{total:0,cash:0,check:0,ach:0,card:0,other:0}),[filtered])
  function edit(row){setEditing(row.id);setForm({...row})}
  function save(){
    setData(prev=>({...prev,approvedPayroll:(prev.approvedPayroll||[]).map(r=>r.id===editing?{...r,...form,approved_amount:num(form.approved_amount),updated_at:new Date().toISOString()}:r)}))
    setEditing(null)
  }
  function remove(id){ if(!window.confirm('Delete this approved payroll record?')) return; setData(prev=>({...prev,approvedPayroll:(prev.approvedPayroll||[]).filter(r=>r.id!==id)})) }
  return <div className="page-stack approved-payroll-page">
    <section className="summary-grid compact-summary">
      {[['Approved Total',totals.total],['Cash',totals.cash],['Check',totals.check],['ACH',totals.ach]].map(([label,value])=><article className="summary-card" key={label}><span>{label}</span><strong>${money(value)}</strong></article>)}
    </section>
    <section className="card">
      <header className="section-header"><div><h2>Approved Payroll</h2><p>Approved payroll is kept separately from working payroll and remains editable for payment processing.</p></div></header>
      <div className="toolbar-row"><input type="search" placeholder="Search employee, date, or check number" value={search} onChange={e=>setSearch(e.target.value)}/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="void">Void</option></select></div>
      <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Pay Date</th><th>Original</th><th>Approved Amount</th><th>Payment</th><th>Check #</th><th>Status</th><th>Approved</th><th></th></tr></thead><tbody>{filtered.length?filtered.map(r=><tr key={r.id}><td><b>{r.employee_name}</b><small>{r.group_name||r.payroll_classification||''}</small></td><td>{r.pay_date||'—'}</td><td>${money(r.original_amount)}</td><td><b>${money(r.approved_amount)}</b></td><td>{r.payment_type||'Check'}</td><td>{r.check_number||'—'}</td><td><span className="status-pill-modern">{r.payment_status||'Pending'}</span></td><td>{String(r.approved_at||'').slice(0,10)}</td><td><div className="row-actions"><button onClick={()=>edit(r)} title="Edit"><Icon name="edit" size={14}/></button><button onClick={()=>remove(r.id)} title="Delete"><Icon name="trash" size={14}/></button></div></td></tr>):<tr><td colSpan="9">No approved payroll records.</td></tr>}</tbody></table></div>
    </section>
    {editing&&<div className="payroll-edit-overlay" onClick={()=>setEditing(null)}><section className="payroll-edit-modal" onClick={e=>e.stopPropagation()}><header><div><h2>Edit Approved Payroll</h2><p>The original payroll amount remains visible for audit.</p></div><button className="modal-close" onClick={()=>setEditing(null)}>×</button></header><div className="payroll-edit-grid"><label>Employee<input value={form.employee_name||''} disabled/></label><label>Original Amount<input value={money(form.original_amount)} disabled/></label><label>Approved Amount<input type="number" step="0.01" value={form.approved_amount??''} onChange={e=>setForm(f=>({...f,approved_amount:e.target.value}))}/></label><label>Payment Type<select value={form.payment_type||'Check'} onChange={e=>setForm(f=>({...f,payment_type:e.target.value}))}><option>Cash</option><option>Check</option><option>ACH</option><option>Card</option><option>Other</option></select></label><label>Check Number<input value={form.check_number||''} onChange={e=>setForm(f=>({...f,check_number:e.target.value}))}/></label><label>Status<select value={form.payment_status||'Pending'} onChange={e=>setForm(f=>({...f,payment_status:e.target.value,paid_date:e.target.value==='Paid'?(f.paid_date||today()):f.paid_date}))}><option>Pending</option><option>Paid</option><option>Void</option></select></label><label>Paid Date<input type="date" value={form.paid_date||''} onChange={e=>setForm(f=>({...f,paid_date:e.target.value}))}/></label><label className="wide">Notes<textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label></div><footer><button className="btn secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="btn primary" onClick={save}>Save Changes</button></footer></section></div>}
  </div>
}
