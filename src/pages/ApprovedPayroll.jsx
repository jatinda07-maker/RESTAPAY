import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { clearLegacyPayrollRecovery, markPayrollDeleted } from '../lib/localStore'

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
        payment_status: entry.payment_status && entry.payment_status !== 'Pending' ? entry.payment_status : 'Approved',
        paid_date: entry.paid_date || '',
        notes: entry.notes || '',
        approved_at: entry.approved_at || entry.updated_at || entry.created_at || '',
        updated_at: entry.updated_at || entry.approved_at || ''
      }))
    return [...stored, ...derived]
  }, [data.approvedPayroll, data.payrollEntries])

  const [search,setSearch]=useState('')
  const [statusFilter,setStatusFilter]=useState('all')
  const [paymentFilter,setPaymentFilter]=useState('all')
  const [editing,setEditing]=useState(null)
  const [form,setForm]=useState({})
  const [selected,setSelected]=useState([])
  const [bulkEditing,setBulkEditing]=useState(false)
  const [bulkForm,setBulkForm]=useState({payment_status:'',payment_type:'',check_number:'',paid_date:''})

  const filtered=useMemo(()=>rows.filter(r=>{
    const q=search.trim().toLowerCase()
    const matches=!q || [r.employee_name,r.check_number,r.payment_type,r.pay_date,r.pay_period_start,r.pay_period_end].some(v=>String(v||'').toLowerCase().includes(q))
    const status=statusFilter==='all' || String(r.payment_status||'Approved').toLowerCase()===statusFilter
    const payment=paymentFilter==='all' || String(r.payment_type||'Other').toLowerCase()===paymentFilter
    return matches && status && payment
  }).sort((a,b)=>String(b.approved_at||'').localeCompare(String(a.approved_at||''))),[rows,search,statusFilter,paymentFilter])

  const visibleIds=useMemo(()=>filtered.map(r=>String(r.id)),[filtered])
  const selectedVisibleCount=visibleIds.filter(id=>selected.includes(id)).length
  const allVisibleSelected=visibleIds.length>0 && selectedVisibleCount===visibleIds.length
  const someVisibleSelected=selectedVisibleCount>0 && !allVisibleSelected

  useEffect(()=>{
    const validIds=new Set(rows.map(r=>String(r.id)))
    setSelected(current=>current.filter(id=>validIds.has(id)))
  },[rows])

  const totals=useMemo(()=>rows.filter(r=>{
    const q=search.trim().toLowerCase()
    const matches=!q || [r.employee_name,r.check_number,r.payment_type,r.pay_date,r.pay_period_start,r.pay_period_end].some(v=>String(v||'').toLowerCase().includes(q))
    const status=statusFilter==='all' || String(r.payment_status||'Approved').toLowerCase()===statusFilter
    return matches && status
  }).reduce((a,r)=>{const v=num(r.approved_amount);a.total+=v;a[String(r.payment_type||'Other').toLowerCase()]=(a[String(r.payment_type||'Other').toLowerCase()]||0)+v;return a},{total:0,cash:0,check:0,ach:0,card:0,other:0}),[rows,search,statusFilter])

  function edit(row){setEditing(row.id);setForm({...row})}

  function applyUpdates(ids, updates){
    const idSet=new Set(ids.map(String))
    const now=new Date().toISOString()
    const selectedRows=rows.filter(row=>idSet.has(String(row.id)))
    const updatesById=new Map(selectedRows.map(row=>[String(row.id),{...row,...updates,updated_at:now}]))
    const sourceUpdates=new Map(selectedRows.filter(row=>row.source_payroll_entry_id).map(row=>[String(row.source_payroll_entry_id),{...updates,updated_at:now}]))

    setData(prev=>{
      const existing=Array.isArray(prev.approvedPayroll)?prev.approvedPayroll:[]
      const existingIds=new Set(existing.map(row=>String(row.id)))
      const approvedPayroll=existing.map(row=>{
        const next=updatesById.get(String(row.id))
        return next?{...row,...next}:row
      })
      selectedRows.forEach(row=>{
        if(!existingIds.has(String(row.id))) approvedPayroll.push(updatesById.get(String(row.id)))
      })

      const payrollEntries=(prev.payrollEntries||[]).map(entry=>{
        const next=sourceUpdates.get(String(entry.id))
        if(!next) return entry
        return {
          ...entry,
          payment_status:next.payment_status ?? entry.payment_status,
          payment_method:next.payment_type ?? entry.payment_method,
          payroll_type:next.payment_type ?? entry.payroll_type,
          check_number:next.check_number ?? entry.check_number,
          paid_date:next.paid_date ?? entry.paid_date,
          updated_at:now
        }
      })
      return {...prev,approvedPayroll,payrollEntries}
    })
  }

  function save(){
    const updates={...form,approved_amount:num(form.approved_amount)}
    if(updates.payment_status==='Paid'&&!updates.paid_date) updates.paid_date=today()
    if(updates.payment_status!=='Paid') updates.paid_date=updates.paid_date||''
    applyUpdates([editing],updates)
    setEditing(null)
  }

  function updateStatus(row,status){
    const paidDate=status==='Paid'?(row.paid_date||today()):row.paid_date||''
    applyUpdates([row.id],{payment_status:status,paid_date:paidDate})
  }

  function applyBulkEdit(){
    if(!selected.length) return
    const updates={}
    if(bulkForm.payment_status){
      updates.payment_status=bulkForm.payment_status
      if(bulkForm.payment_status==='Paid') updates.paid_date=bulkForm.paid_date||today()
      else if(bulkForm.paid_date) updates.paid_date=bulkForm.paid_date
    } else if(bulkForm.paid_date) updates.paid_date=bulkForm.paid_date
    if(bulkForm.payment_type) updates.payment_type=bulkForm.payment_type
    if(bulkForm.check_number!=='') updates.check_number=bulkForm.check_number
    if(!Object.keys(updates).length){ window.alert('Choose at least one field to update.'); return }
    if(!window.confirm(`Apply these changes to ${selected.length} selected payroll record${selected.length===1?'':'s'}?`)) return
    applyUpdates(selected,updates)
    setBulkEditing(false)
    setBulkForm({payment_status:'',payment_type:'',check_number:'',paid_date:''})
  }

  function toggleRow(id){
    const key=String(id)
    setSelected(current=>current.includes(key)?current.filter(item=>item!==key):[...current,key])
  }

  function toggleAllVisible(){
    setSelected(current=>{
      if(allVisibleSelected) return current.filter(id=>!visibleIds.includes(id))
      return Array.from(new Set([...current,...visibleIds]))
    })
  }

  function deleteApprovedRows(ids){
    const idSet=new Set(ids.map(String))
    const rowsToDelete=rows.filter(row=>idSet.has(String(row.id)))
    const sourceIds=new Set(rowsToDelete.map(row=>row.source_payroll_entry_id).filter(Boolean).map(String))
    const approvedIds=new Set(rowsToDelete.map(row=>row.id).filter(Boolean).map(String))

    const deletedIds=Array.from(new Set([...sourceIds,...approvedIds]))
    markPayrollDeleted(deletedIds)
    setData(prev=>({
      ...prev,
      deletedPayrollIds:Array.from(new Set([...(prev.deletedPayrollIds||[]),...deletedIds])),
      approvedPayroll:(prev.approvedPayroll||[]).filter(row=>!approvedIds.has(String(row.id)) && !sourceIds.has(String(row.source_payroll_entry_id||''))),
      payrollEntries:(prev.payrollEntries||[]).filter(entry=>!sourceIds.has(String(entry.id)) && !approvedIds.has(String(entry.approved_payroll_id||'')))
    }))
    setSelected(current=>current.filter(id=>!idSet.has(id)))
  }

  function remove(id){
    if(!window.confirm('Permanently delete this approved payroll record? This cannot be undone.')) return
    deleteApprovedRows([id])
  }

  function removeSelected(){
    if(!selected.length) return
    if(!window.confirm(`Delete ${selected.length} selected approved payroll record${selected.length===1?'':'s'}? This cannot be undone.`)) return
    deleteApprovedRows(selected)
  }

  function clearAllPayroll(){
    const confirmation=window.prompt('This permanently removes all payroll records and imports. Type CLEAR PAYROLL to continue.')
    if(confirmation!=='CLEAR PAYROLL') return
    const ids=[...rows.map(row=>String(row.id)),...(data.payrollEntries||[]).map(row=>String(row.id))]
    markPayrollDeleted(ids)
    clearLegacyPayrollRecovery()
    setData(prev=>({...prev,payrollEntries:[],approvedPayroll:[],payrollImports:[],deletedPayrollIds:Array.from(new Set([...(prev.deletedPayrollIds||[]),...ids]))}))
    setSelected([])
  }

  return <div className="page-stack approved-payroll-page">
    <section className="approved-kpi-grid" aria-label="Approved payroll totals">
      {[
        {label:'Approved Total',value:totals.total,icon:'payroll',tone:'approved',helper:'Total Approved',filter:'all',action:'View all approved payroll'},
        {label:'Cash',value:totals.cash,icon:'dollar',tone:'cash',helper:'Cash Payments',filter:'cash',action:'View cash payments'},
        {label:'Check',value:totals.check,icon:'edit',tone:'check',helper:'Check Payments',filter:'check',action:'View check payments'},
        {label:'ACH',value:totals.ach,icon:'landmark',tone:'ach',helper:'ACH Payments',filter:'ach',action:'View ACH payments'}
      ].map(card=><button type="button" className={`approved-kpi-card ${card.tone} ${paymentFilter===card.filter?'active':''}`} key={card.label} onClick={()=>setPaymentFilter(card.filter)} aria-pressed={paymentFilter===card.filter}>
        <span className="approved-kpi-main">
          <span className="approved-kpi-icon"><Icon name={card.icon} size={21}/></span>
          <span className="approved-kpi-copy"><span className="approved-kpi-label">{card.label}</span><strong>${money(card.value)}</strong><small>{card.helper}</small></span>
        </span>
        <span className="approved-kpi-action"><span><Icon name={card.tone==='approved'?'trending':card.icon} size={13}/>{card.action}</span><b>›</b></span>
      </button>)}
    </section>

    <section className="card">
      <header className="section-header"><div><h2>Approved Payroll</h2><p>Approved payroll is kept separately from working payroll and remains editable for payment processing.</p></div></header>
      <div className="toolbar-row approved-payroll-toolbar">
        <input type="search" placeholder="Search employee, date, or check number" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="void">Void</option></select>
        {paymentFilter!=='all'&&<button type="button" className="btn ghost" onClick={()=>setPaymentFilter('all')}>Clear {paymentFilter.toUpperCase()} Filter</button>}
        <button type="button" className="btn secondary" disabled={!selected.length} onClick={()=>setBulkEditing(true)}><Icon name="edit" size={15}/> Edit Selected{selected.length?` (${selected.length})`:''}</button>
        <button type="button" className="btn danger" disabled={!selected.length} onClick={removeSelected}><Icon name="trash" size={15}/> Delete Selected{selected.length?` (${selected.length})`:''}</button>
        <button type="button" className="btn danger" onClick={clearAllPayroll}><Icon name="trash" size={15}/> Clear All Payroll</button>
      </div>
      <div className="table-wrap"><table><thead><tr><th className="select-column"><input type="checkbox" checked={allVisibleSelected} ref={el=>{if(el) el.indeterminate=someVisibleSelected}} onChange={toggleAllVisible} aria-label="Select all visible approved payroll"/></th><th>Employee</th><th>Pay Date</th><th>Original</th><th>Approved Amount</th><th>Payment</th><th>Check #</th><th>Status</th><th>Approved</th><th></th></tr></thead><tbody>{filtered.length?filtered.map(r=><tr key={r.id} className={selected.includes(String(r.id))?'selected-row':''}><td className="select-column"><input type="checkbox" checked={selected.includes(String(r.id))} onChange={()=>toggleRow(r.id)} aria-label={`Select ${r.employee_name}`}/></td><td><b>{r.employee_name}</b><small>{r.group_name||r.payroll_classification||''}</small></td><td>{r.pay_date||'—'}</td><td>${money(r.original_amount)}</td><td><b>${money(r.approved_amount)}</b></td><td>{r.payment_type||'Check'}</td><td>{r.check_number||'—'}</td><td><select className="status-inline-select" value={r.payment_status && r.payment_status !== 'Pending' ? r.payment_status : 'Approved'} onChange={e=>updateStatus(r,e.target.value)} aria-label={`Update status for ${r.employee_name}`}><option>Approved</option><option>Paid</option><option>Void</option></select></td><td>{String(r.approved_at||'').slice(0,10)}</td><td><div className="row-actions"><button type="button" onClick={()=>edit(r)} title="Edit"><Icon name="edit" size={14}/></button><button type="button" onClick={()=>remove(r.id)} title="Delete"><Icon name="trash" size={14}/></button></div></td></tr>):<tr><td colSpan="10">No approved payroll records.</td></tr>}</tbody></table></div>
    </section>

    {editing&&<div className="payroll-edit-overlay" onClick={()=>setEditing(null)}><section className="payroll-edit-modal" onClick={e=>e.stopPropagation()}><header><div><h2>Edit Approved Payroll</h2><p>The original payroll amount remains visible for audit.</p></div><button type="button" className="modal-close" onClick={()=>setEditing(null)}>×</button></header><div className="payroll-edit-grid"><label>Employee<input value={form.employee_name||''} disabled/></label><label>Original Amount<input value={money(form.original_amount)} disabled/></label><label>Approved Amount<input type="number" step="0.01" value={form.approved_amount??''} onChange={e=>setForm(f=>({...f,approved_amount:e.target.value}))}/></label><label>Payment Type<select value={form.payment_type||'Check'} onChange={e=>setForm(f=>({...f,payment_type:e.target.value}))}><option>Cash</option><option>Check</option><option>ACH</option><option>Card</option><option>Other</option></select></label><label>Check Number<input value={form.check_number||''} onChange={e=>setForm(f=>({...f,check_number:e.target.value}))}/></label><label>Status<select value={form.payment_status && form.payment_status !== 'Pending' ? form.payment_status : 'Approved'} onChange={e=>setForm(f=>({...f,payment_status:e.target.value,paid_date:e.target.value==='Paid'?(f.paid_date||today()):f.paid_date}))}><option>Approved</option><option>Paid</option><option>Void</option></select></label><label>Paid Date<input type="date" value={form.paid_date||''} onChange={e=>setForm(f=>({...f,paid_date:e.target.value}))}/></label><label className="wide">Notes<textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label></div><footer><button type="button" className="btn secondary" onClick={()=>setEditing(null)}>Cancel</button><button type="button" className="btn primary" onClick={save}>Save Changes</button></footer></section></div>}

    {bulkEditing&&<div className="payroll-edit-overlay" onClick={()=>setBulkEditing(false)}><section className="payroll-edit-modal" onClick={e=>e.stopPropagation()}><header><div><h2>Edit Selected Payroll</h2><p>Only fields you choose below will be changed for {selected.length} selected record{selected.length===1?'':'s'}.</p></div><button type="button" className="modal-close" onClick={()=>setBulkEditing(false)}>×</button></header><div className="payroll-edit-grid"><label>Status<select value={bulkForm.payment_status} onChange={e=>setBulkForm(f=>({...f,payment_status:e.target.value,paid_date:e.target.value==='Paid'?(f.paid_date||today()):f.paid_date}))}><option value="">Keep current status</option><option>Approved</option><option>Paid</option><option>Void</option></select></label><label>Payment Type<select value={bulkForm.payment_type} onChange={e=>setBulkForm(f=>({...f,payment_type:e.target.value}))}><option value="">Keep current payment type</option><option>Cash</option><option>Check</option><option>ACH</option><option>Card</option><option>Other</option></select></label><label>Check Number<input value={bulkForm.check_number} placeholder="Leave blank to keep current" onChange={e=>setBulkForm(f=>({...f,check_number:e.target.value}))}/></label><label>Paid Date<input type="date" value={bulkForm.paid_date} onChange={e=>setBulkForm(f=>({...f,paid_date:e.target.value}))}/></label></div><footer><button type="button" className="btn secondary" onClick={()=>setBulkEditing(false)}>Cancel</button><button type="button" className="btn primary" onClick={applyBulkEdit}>Apply Changes</button></footer></section></div>}
  </div>
}
