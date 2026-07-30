import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { applyPresetToSetters, isDateInRange, readPageDateRange, savePageDateRange } from '../engine/DateEngine'
import { markPayrollDeleted } from '../lib/localStore'

function num(v){ return Number(String(v ?? '').replace(/[$,%]/g,'')) || 0 }
function money(v){ return num(v).toFixed(2) }
function today(){ return new Date().toISOString().slice(0,10) }
function approvedRowDate(row){ return row.pay_date || row.payroll_date || row.pay_period_end || String(row.approved_at || row.created_at || '').slice(0,10) }

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
  const [employeeFilter,setEmployeeFilter]=useState('all')
  const [dateStart,setDateStart]=useState(() => readPageDateRange('approvedPayroll').start)
  const [dateEnd,setDateEnd]=useState(() => readPageDateRange('approvedPayroll').end)
  const [editing,setEditing]=useState(null)
  const [form,setForm]=useState({})
  const [selected,setSelected]=useState([])
  const [bulkEditing,setBulkEditing]=useState(false)
  const [bulkForm,setBulkForm]=useState({payment_status:'',payment_type:'',check_number:'',paid_date:''})

  const employeeOptions=useMemo(()=>Array.from(new Set(rows.map(r=>String(r.employee_name||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b)),[rows])

  const filtered=useMemo(()=>rows.filter(r=>{
    const q=search.trim().toLowerCase()
    const matches=!q || [r.employee_name,r.check_number,r.payment_type,r.pay_date,r.pay_period_start,r.pay_period_end].some(v=>String(v||'').toLowerCase().includes(q))
    const status=statusFilter==='all' || String(r.payment_status||'Pending').toLowerCase()===statusFilter
    const employee=employeeFilter==='all' || String(r.employee_name||'')===employeeFilter
    const date=isDateInRange(approvedRowDate(r),dateStart,dateEnd)
    return matches && status && employee && date
  }).sort((a,b)=>approvedRowDate(b).localeCompare(approvedRowDate(a)) || String(a.employee_name||'').localeCompare(String(b.employee_name||''))),[rows,search,statusFilter,employeeFilter,dateStart,dateEnd])

  const visibleIds=useMemo(()=>filtered.map(r=>String(r.id)),[filtered])
  const selectedVisibleCount=visibleIds.filter(id=>selected.includes(id)).length
  const allVisibleSelected=visibleIds.length>0 && selectedVisibleCount===visibleIds.length
  const someVisibleSelected=selectedVisibleCount>0 && !allVisibleSelected

  useEffect(()=>{
    const validIds=new Set(rows.map(r=>String(r.id)))
    setSelected(current=>current.filter(id=>validIds.has(id)))
  },[rows])

  const totals=useMemo(()=>filtered.reduce((a,r)=>{const v=num(r.approved_amount);a.total+=v;a[String(r.payment_type||'Other').toLowerCase()]=(a[String(r.payment_type||'Other').toLowerCase()]||0)+v;return a},{total:0,cash:0,check:0,ach:0,card:0,other:0}),[filtered])


  function applyDateRange(){
    savePageDateRange('approvedPayroll',dateStart,dateEnd)
  }

  function applyDatePreset(preset){
    applyPresetToSetters(preset,setDateStart,setDateEnd,(start,end)=>savePageDateRange('approvedPayroll',start,end))
  }

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

  function linkedSourceIds(selectedRows=[]){
    return new Set(selectedRows.flatMap(row=>[
      row.source_payroll_entry_id,
      row.source_payroll_id
    ]).filter(Boolean).map(String))
  }

  function permanentlyDeleteApprovedRows(ids){
    const idSet=new Set(ids.map(String))
    const rowsToDelete=rows.filter(row=>idSet.has(String(row.id)))
    const sourceIds=linkedSourceIds(rowsToDelete)
    const approvedIds=new Set(rowsToDelete.map(row=>row.id).filter(Boolean).map(String))
    const tombstones=Array.from(new Set([...approvedIds,...sourceIds]))
    markPayrollDeleted(tombstones)

    setData(prev=>({
      ...prev,
      deletedPayrollIds:Array.from(new Set([...(prev.deletedPayrollIds||[]).map(String),...tombstones])),
      approvedPayroll:(prev.approvedPayroll||[]).filter(row=>
        !approvedIds.has(String(row.id)) &&
        !sourceIds.has(String(row.source_payroll_entry_id||row.source_payroll_id||''))
      ),
      payrollEntries:(prev.payrollEntries||[]).filter(entry=>
        !sourceIds.has(String(entry.id)) &&
        !approvedIds.has(String(entry.approved_payroll_id||''))
      )
    }))
    setSelected(current=>current.filter(id=>!idSet.has(id)))
  }

  function returnApprovedRowsToPending(ids){
    const idSet=new Set(ids.map(String))
    const rowsToReturn=rows.filter(row=>idSet.has(String(row.id)))
    const sourceIds=linkedSourceIds(rowsToReturn)
    const approvedIds=new Set(rowsToReturn.map(row=>row.id).filter(Boolean).map(String))

    setData(prev=>({
      ...prev,
      approvedPayroll:(prev.approvedPayroll||[]).filter(row=>
        !approvedIds.has(String(row.id)) &&
        !sourceIds.has(String(row.source_payroll_entry_id||row.source_payroll_id||''))
      ),
      payrollEntries:(prev.payrollEntries||[]).map(entry=>{
        if(!sourceIds.has(String(entry.id)) && !approvedIds.has(String(entry.approved_payroll_id||''))) return entry
        const next={...entry,approval_status:'Pending',payment_status:'Pending',updated_at:new Date().toISOString()}
        delete next.approved_payroll_id
        delete next.approved_at
        delete next.paid_date
        return next
      })
    }))
    setSelected(current=>current.filter(id=>!idSet.has(id)))
  }

  function remove(id){
    if(!window.confirm('Permanently delete this approved payroll record and its linked payroll entry? This cannot be undone.')) return
    permanentlyDeleteApprovedRows([id])
  }

  function removeSelected(){
    if(!selected.length) return
    if(!window.confirm(`Permanently delete ${selected.length} selected approved payroll record${selected.length===1?'':'s'} and their linked payroll entries? This cannot be undone.`)) return
    permanentlyDeleteApprovedRows(selected)
  }

  function returnSelectedToPending(){
    if(!selected.length) return
    if(!window.confirm(`Return ${selected.length} selected approved payroll record${selected.length===1?'':'s'} to Pending Payroll?`)) return
    returnApprovedRowsToPending(selected)
  }

  return <div className="page-stack approved-payroll-page">
    <section className="summary-grid compact-summary payroll-modern-summary approved-modern-summary">
      {[
        {label:'Approved Total',value:totals.total,icon:'dollar',tone:'blue'},
        {label:'Cash',value:totals.cash,icon:'wallet',tone:'green'},
        {label:'Check',value:totals.check,icon:'receipt',tone:'orange'},
        {label:'ACH',value:totals.ach,icon:'landmark',tone:'purple'}
      ].map(card=><article className={`summary-card payroll-modern-card tone-${card.tone}`} key={card.label}><div className="payroll-modern-card-head"><span>{card.label}</span><span className="payroll-modern-card-icon"><Icon name={card.icon === 'wallet' ? 'dollar' : card.icon} size={18}/></span></div><strong>${money(card.value)}</strong><small>Filtered approved payroll</small></article>)}
    </section>

    <section className="card">
      <header className="section-header"><div><h2>Approved Payroll</h2><p>Approved payroll is kept separately from working payroll and remains editable for payment processing.</p></div></header>
      <DateControls start={dateStart} end={dateEnd} onStartChange={setDateStart} onEndChange={setDateEnd} onApply={applyDateRange} onPreset={applyDatePreset} />
      <div className="toolbar-row approved-payroll-toolbar">
        <input type="search" placeholder="Search employee, date, or check number" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={employeeFilter} onChange={e=>setEmployeeFilter(e.target.value)} aria-label="Filter approved payroll by employee"><option value="all">All employees</option>{employeeOptions.map(name=><option key={name} value={name}>{name}</option>)}</select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="void">Void</option></select>
        <button className="btn secondary" disabled={!selected.length} onClick={()=>setBulkEditing(true)}><Icon name="edit" size={15}/> Edit Selected{selected.length?` (${selected.length})`:''}</button>
        <button className="btn secondary" disabled={!selected.length} onClick={returnSelectedToPending}>Return to Pending{selected.length?` (${selected.length})`:''}</button>
        <button className="btn danger" disabled={!selected.length} onClick={removeSelected}><Icon name="trash" size={15}/> Delete Permanently{selected.length?` (${selected.length})`:''}</button>
      </div>
      <div className="table-wrap"><table><thead><tr><th className="select-column"><input type="checkbox" checked={allVisibleSelected} ref={el=>{if(el) el.indeterminate=someVisibleSelected}} onChange={toggleAllVisible} aria-label="Select all visible approved payroll"/></th><th>Employee</th><th>Pay Date</th><th>Original</th><th>Approved Amount</th><th>Payment</th><th>Check #</th><th>Status</th><th>Approved</th><th></th></tr></thead><tbody>{filtered.length?filtered.map(r=><tr key={r.id} className={selected.includes(String(r.id))?'selected-row':''}><td className="select-column"><input type="checkbox" checked={selected.includes(String(r.id))} onChange={()=>toggleRow(r.id)} aria-label={`Select ${r.employee_name}`}/></td><td><b>{r.employee_name}</b><small>{r.group_name||r.payroll_classification||''}</small></td><td>{r.pay_date||'—'}</td><td>${money(r.original_amount)}</td><td><b>${money(r.approved_amount)}</b></td><td>{r.payment_type||'Check'}</td><td>{r.check_number||'—'}</td><td><select className="status-inline-select" value={r.payment_status||'Pending'} onChange={e=>updateStatus(r,e.target.value)} aria-label={`Update status for ${r.employee_name}`}><option>Pending</option><option>Paid</option><option>Void</option></select></td><td>{String(r.approved_at||'').slice(0,10)}</td><td><div className="row-actions"><button onClick={()=>edit(r)} title="Edit"><Icon name="edit" size={14}/></button><button onClick={()=>remove(r.id)} title="Delete"><Icon name="trash" size={14}/></button></div></td></tr>):<tr><td colSpan="10">No approved payroll records.</td></tr>}</tbody></table></div>
    </section>

    {editing&&<div className="payroll-edit-overlay" onClick={()=>setEditing(null)}><section className="payroll-edit-modal" onClick={e=>e.stopPropagation()}><header><div><h2>Edit Approved Payroll</h2><p>The original payroll amount remains visible for audit.</p></div><button className="modal-close" onClick={()=>setEditing(null)}>×</button></header><div className="payroll-edit-grid"><label>Employee<input value={form.employee_name||''} disabled/></label><label>Original Amount<input value={money(form.original_amount)} disabled/></label><label>Approved Amount<input type="number" step="0.01" value={form.approved_amount??''} onChange={e=>setForm(f=>({...f,approved_amount:e.target.value}))}/></label><label>Payment Type<select value={form.payment_type||'Check'} onChange={e=>setForm(f=>({...f,payment_type:e.target.value}))}><option>Cash</option><option>Check</option><option>ACH</option><option>Card</option><option>Other</option></select></label><label>Check Number<input value={form.check_number||''} onChange={e=>setForm(f=>({...f,check_number:e.target.value}))}/></label><label>Status<select value={form.payment_status||'Pending'} onChange={e=>setForm(f=>({...f,payment_status:e.target.value,paid_date:e.target.value==='Paid'?(f.paid_date||today()):f.paid_date}))}><option>Pending</option><option>Paid</option><option>Void</option></select></label><label>Paid Date<input type="date" value={form.paid_date||''} onChange={e=>setForm(f=>({...f,paid_date:e.target.value}))}/></label><label className="wide">Notes<textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label></div><footer><button className="btn secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="btn primary" onClick={save}>Save Changes</button></footer></section></div>}

    {bulkEditing&&<div className="payroll-edit-overlay" onClick={()=>setBulkEditing(false)}><section className="payroll-edit-modal" onClick={e=>e.stopPropagation()}><header><div><h2>Edit Selected Payroll</h2><p>Only fields you choose below will be changed for {selected.length} selected record{selected.length===1?'':'s'}.</p></div><button className="modal-close" onClick={()=>setBulkEditing(false)}>×</button></header><div className="payroll-edit-grid"><label>Status<select value={bulkForm.payment_status} onChange={e=>setBulkForm(f=>({...f,payment_status:e.target.value,paid_date:e.target.value==='Paid'?(f.paid_date||today()):f.paid_date}))}><option value="">Keep current status</option><option>Pending</option><option>Paid</option><option>Void</option></select></label><label>Payment Type<select value={bulkForm.payment_type} onChange={e=>setBulkForm(f=>({...f,payment_type:e.target.value}))}><option value="">Keep current payment type</option><option>Cash</option><option>Check</option><option>ACH</option><option>Card</option><option>Other</option></select></label><label>Check Number<input value={bulkForm.check_number} placeholder="Leave blank to keep current" onChange={e=>setBulkForm(f=>({...f,check_number:e.target.value}))}/></label><label>Paid Date<input type="date" value={bulkForm.paid_date} onChange={e=>setBulkForm(f=>({...f,paid_date:e.target.value}))}/></label></div><footer><button className="btn secondary" onClick={()=>setBulkEditing(false)}>Cancel</button><button className="btn primary" onClick={applyBulkEdit}>Apply Changes</button></footer></section></div>}
  </div>
}
