import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { applyPresetToSetters, isDateInRange, readPageDateRange, savePageDateRange } from '../engine/DateEngine'
import { markPayrollDeleted } from '../lib/localStore'

function num(v){ return Number(String(v ?? '').replace(/[$,%]/g,'')) || 0 }
function money(v){ return num(v).toFixed(2) }
function today(){ return new Date().toISOString().slice(0,10) }
function approvedRowDate(row){ return row.pay_date || row.payroll_date || row.pay_period_end || String(row.approved_at || row.created_at || '').slice(0,10) }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char])) }
function amountInWords(value){
  const amount=Math.max(0,Math.round(num(value)*100)/100)
  const dollars=Math.floor(amount)
  const cents=Math.round((amount-dollars)*100)
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  function underThousand(n){
    let out=[]
    if(n>=100){out.push(`${ones[Math.floor(n/100)]} Hundred`);n%=100}
    if(n>=20){out.push(tens[Math.floor(n/10)]);if(n%10) out.push(ones[n%10])}
    else if(n>0) out.push(ones[n])
    return out.join(' ')
  }
  function whole(n){
    if(n===0) return 'Zero'
    const groups=[[1_000_000_000,'Billion'],[1_000_000,'Million'],[1_000,'Thousand'],[1,'']]
    const out=[]
    for(const [size,label] of groups){
      if(n>=size){const part=Math.floor(n/size);out.push(underThousand(part)+(label?` ${label}`:''));n%=size}
    }
    return out.join(' ')
  }
  return `${whole(dollars)} and ${String(cents).padStart(2,'0')}/100 Dollars`
}

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
  const [checkPrintOpen,setCheckPrintOpen]=useState(false)
  const savedCheckSettings=data.settings?.checkPrint||{}
  const [checkPrintForm,setCheckPrintForm]=useState({
    business_name:savedCheckSettings.business_name||'Isabella Restaurant',
    business_address:savedCheckSettings.business_address||'',
    bank_name:savedCheckSettings.bank_name||'',
    check_date:savedCheckSettings.check_date||today(),
    starting_check_number:savedCheckSettings.starting_check_number||'',
    memo:savedCheckSettings.memo||'Payroll',
    mark_paid:savedCheckSettings.mark_paid!==false
  })

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



  const selectedCheckRows=useMemo(()=>rows.filter(row=>selected.includes(String(row.id)) && String(row.payment_type||'Check').toLowerCase()==='check' && String(row.payment_status||'Pending').toLowerCase()!=='void'),[rows,selected])

  function openCheckPrint(){
    if(!selected.length){window.alert('Select one or more approved payroll rows first.');return}
    if(!selectedCheckRows.length){window.alert('Selected rows must use Check as the payment type and cannot be Void.');return}
    setCheckPrintOpen(true)
  }

  function printSelectedChecks(){
    if(!selectedCheckRows.length) return
    const startNumber=parseInt(checkPrintForm.starting_check_number,10)
    const hasSequence=Number.isFinite(startNumber)
    const prepared=selectedCheckRows.map((row,index)=>({
      ...row,
      printable_check_number:String(row.check_number||'').trim() || (hasSequence?String(startNumber+index):'')
    }))
    if(prepared.some(row=>!row.printable_check_number) && !window.confirm('Some checks do not have a check number. Print them anyway?')) return
    const settings={...checkPrintForm}
    setData(prev=>{
      const now=new Date().toISOString()
      const updateMap=new Map(prepared.map(row=>[String(row.id),row.printable_check_number]))
      const sourceMap=new Map(prepared.filter(row=>row.source_payroll_entry_id).map(row=>[String(row.source_payroll_entry_id),row.printable_check_number]))
      return {
        ...prev,
        settings:{...(prev.settings||{}),checkPrint:settings},
        approvedPayroll:(prev.approvedPayroll||[]).map(row=>updateMap.has(String(row.id))?{...row,check_number:updateMap.get(String(row.id)),payment_status:settings.mark_paid?'Paid':row.payment_status,paid_date:settings.mark_paid?settings.check_date:row.paid_date,updated_at:now}:row),
        payrollEntries:(prev.payrollEntries||[]).map(row=>sourceMap.has(String(row.id))?{...row,check_number:sourceMap.get(String(row.id)),payment_status:settings.mark_paid?'Paid':row.payment_status,paid_date:settings.mark_paid?settings.check_date:row.paid_date,updated_at:now}:row)
      }
    })
    const pages=prepared.map(row=>{
      const amount=money(row.approved_amount)
      const payPeriod=[row.pay_period_start,row.pay_period_end].filter(Boolean).join(' - ')
      const number=escapeHtml(row.printable_check_number||'')
      const employee=escapeHtml(row.employee_name||'Employee')
      const memo=escapeHtml(checkPrintForm.memo||'Payroll')
      const date=escapeHtml(checkPrintForm.check_date||today())
      return `<section class="check-page">
        <div class="check">
          <div class="check-head"><div><strong>${escapeHtml(checkPrintForm.business_name)}</strong><div>${escapeHtml(checkPrintForm.business_address)}</div></div><div class="bank">${escapeHtml(checkPrintForm.bank_name)}</div><div class="check-no">No. ${number}</div></div>
          <div class="check-date"><span>Date</span><b>${date}</b></div>
          <div class="pay-line"><span>PAY TO THE<br>ORDER OF</span><b>${employee}</b><strong>$${amount}</strong></div>
          <div class="words">${escapeHtml(amountInWords(row.approved_amount))}</div>
          <div class="check-foot"><div>Memo: <b>${memo}</b></div><div class="signature">Authorized Signature</div></div>
        </div>
        <div class="stub"><h3>Payroll Check Stub</h3><div><b>Employee:</b> ${employee}</div><div><b>Check #:</b> ${number}</div><div><b>Check date:</b> ${date}</div><div><b>Pay period:</b> ${escapeHtml(payPeriod||row.pay_date||'')}</div><table><tr><th>Approved payroll</th><th>Payment method</th><th>Net check</th></tr><tr><td>$${amount}</td><td>Check</td><td><b>$${amount}</b></td></tr></table><p>${memo}</p></div>
        <div class="stub employee-copy"><h3>Employee Copy</h3><div><b>Employee:</b> ${employee}</div><div><b>Check #:</b> ${number}</div><div><b>Pay period:</b> ${escapeHtml(payPeriod||row.pay_date||'')}</div><div class="stub-total">Net Pay: $${amount}</div></div>
      </section>`
    }).join('')
    // Do not use the `noopener` feature here. Chrome can return `null` while
    // still opening an empty tab, which leaves the user with a blank screen.
    const printWindow=window.open('about:blank','_blank')
    if(!printWindow){window.alert('Your browser blocked the check preview. Allow pop-ups for this site and try again.');return}
    printWindow.document.open()
    printWindow.document.write(`<!doctype html><html><head><title>Payroll Checks</title><style>
      @page{size:letter;margin:0.25in}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#111}.check-page{height:10.5in;page-break-after:always}.check-page:last-child{page-break-after:auto}.check{height:3.45in;border:1px solid #777;padding:.22in .3in;position:relative}.check-head{display:grid;grid-template-columns:1fr 1fr auto;gap:15px;min-height:.55in;font-size:12px}.check-head strong{font-size:17px}.bank{text-align:center;font-weight:700}.check-no{text-align:right;font-size:14px}.check-date{text-align:right;margin:.08in 0}.check-date span{margin-right:12px;font-size:11px}.check-date b{display:inline-block;border-bottom:1px solid #222;min-width:1.25in;padding:3px}.pay-line{display:grid;grid-template-columns:.7in 1fr 1.25in;gap:10px;align-items:end;margin:.18in 0}.pay-line span{font-size:9px}.pay-line b{border-bottom:1px solid #222;padding:6px;font-size:15px}.pay-line strong{border:1px solid #222;padding:7px;text-align:right;font-size:16px}.words{border-bottom:1px solid #222;padding:7px 4px;font-weight:700;min-height:.35in}.check-foot{display:flex;justify-content:space-between;align-items:end;margin-top:.55in}.signature{border-top:1px solid #222;width:2.4in;text-align:center;padding-top:4px;font-size:10px}.stub{height:3.2in;border:1px dashed #777;border-top:0;padding:.25in .35in;font-size:12px}.stub h3{margin:0 0 .15in}.stub>div{margin:5px 0}.stub table{border-collapse:collapse;width:100%;margin-top:.2in}.stub th,.stub td{border:1px solid #aaa;padding:9px;text-align:right}.stub th:first-child,.stub td:first-child{text-align:left}.employee-copy{height:3.2in}.stub-total{font-size:18px;font-weight:700;text-align:right;margin-top:.25in!important}@media screen{body{background:#eee}.check-page{width:8in;margin:15px auto;background:white;box-shadow:0 2px 12px #aaa}}
    </style></head><body>${pages}<script>window.onload=()=>{window.focus();setTimeout(()=>window.print(),250)}<\/script></body></html>`)
    printWindow.document.close()
    printWindow.focus()
    setCheckPrintOpen(false)
  }

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
        <button className="btn primary" disabled={!selected.length} onClick={openCheckPrint}><Icon name="receipt" size={15}/> Print Checks{selected.length?` (${selectedCheckRows.length})`:``}</button>
        <button className="btn secondary" disabled={!selected.length} onClick={()=>setBulkEditing(true)}><Icon name="edit" size={15}/> Edit Selected{selected.length?` (${selected.length})`:''}</button>
        <button className="btn secondary" disabled={!selected.length} onClick={returnSelectedToPending}>Return to Pending{selected.length?` (${selected.length})`:''}</button>
        <button className="btn danger" disabled={!selected.length} onClick={removeSelected}><Icon name="trash" size={15}/> Delete Permanently{selected.length?` (${selected.length})`:''}</button>
      </div>
      <div className="table-wrap"><table><thead><tr><th className="select-column"><input type="checkbox" checked={allVisibleSelected} ref={el=>{if(el) el.indeterminate=someVisibleSelected}} onChange={toggleAllVisible} aria-label="Select all visible approved payroll"/></th><th>Employee</th><th>Pay Date</th><th>Original</th><th>Approved Amount</th><th>Payment</th><th>Check #</th><th>Status</th><th>Approved</th><th></th></tr></thead><tbody>{filtered.length?filtered.map(r=><tr key={r.id} className={selected.includes(String(r.id))?'selected-row':''}><td className="select-column"><input type="checkbox" checked={selected.includes(String(r.id))} onChange={()=>toggleRow(r.id)} aria-label={`Select ${r.employee_name}`}/></td><td><b>{r.employee_name}</b><small>{r.group_name||r.payroll_classification||''}</small></td><td>{r.pay_date||'—'}</td><td>${money(r.original_amount)}</td><td><b>${money(r.approved_amount)}</b></td><td>{r.payment_type||'Check'}</td><td>{r.check_number||'—'}</td><td><select className="status-inline-select" value={r.payment_status||'Pending'} onChange={e=>updateStatus(r,e.target.value)} aria-label={`Update status for ${r.employee_name}`}><option>Pending</option><option>Paid</option><option>Void</option></select></td><td>{String(r.approved_at||'').slice(0,10)}</td><td><div className="row-actions"><button onClick={()=>edit(r)} title="Edit"><Icon name="edit" size={14}/></button><button onClick={()=>remove(r.id)} title="Delete"><Icon name="trash" size={14}/></button></div></td></tr>):<tr><td colSpan="10">No approved payroll records.</td></tr>}</tbody></table></div>
    </section>


    {checkPrintOpen&&<div className="payroll-edit-overlay" onClick={()=>setCheckPrintOpen(false)}><section className="payroll-edit-modal" onClick={e=>e.stopPropagation()}><header><div><h2>Print Payroll Checks</h2><p>Print one letter-size check page per selected employee. Only Check payments are included.</p></div><button className="modal-close" onClick={()=>setCheckPrintOpen(false)}>×</button></header><div className="payroll-edit-grid"><label>Business Name<input value={checkPrintForm.business_name} onChange={e=>setCheckPrintForm(f=>({...f,business_name:e.target.value}))}/></label><label>Bank Name<input value={checkPrintForm.bank_name} onChange={e=>setCheckPrintForm(f=>({...f,bank_name:e.target.value}))} placeholder="Optional"/></label><label className="wide">Business Address<input value={checkPrintForm.business_address} onChange={e=>setCheckPrintForm(f=>({...f,business_address:e.target.value}))} placeholder="Optional"/></label><label>Check Date<input type="date" value={checkPrintForm.check_date} onChange={e=>setCheckPrintForm(f=>({...f,check_date:e.target.value}))}/></label><label>Starting Check Number<input inputMode="numeric" value={checkPrintForm.starting_check_number} onChange={e=>setCheckPrintForm(f=>({...f,starting_check_number:e.target.value.replace(/[^0-9]/g,'')}))} placeholder="Auto-number blank checks"/></label><label className="wide">Memo<input value={checkPrintForm.memo} onChange={e=>setCheckPrintForm(f=>({...f,memo:e.target.value}))}/></label><label className="wide"><span><input type="checkbox" checked={checkPrintForm.mark_paid} onChange={e=>setCheckPrintForm(f=>({...f,mark_paid:e.target.checked}))}/> Mark printed payroll as Paid</span></label></div><div className="check-print-summary"><b>{selectedCheckRows.length}</b> check{selectedCheckRows.length===1?'':'s'} will print. Total: <b>${money(selectedCheckRows.reduce((sum,row)=>sum+num(row.approved_amount),0))}</b></div><footer><button className="btn secondary" onClick={()=>setCheckPrintOpen(false)}>Cancel</button><button className="btn primary" onClick={printSelectedChecks}><Icon name="receipt" size={15}/> Print Checks</button></footer></section></div>}

    {editing&&<div className="payroll-edit-overlay" onClick={()=>setEditing(null)}><section className="payroll-edit-modal" onClick={e=>e.stopPropagation()}><header><div><h2>Edit Approved Payroll</h2><p>The original payroll amount remains visible for audit.</p></div><button className="modal-close" onClick={()=>setEditing(null)}>×</button></header><div className="payroll-edit-grid"><label>Employee<input value={form.employee_name||''} disabled/></label><label>Original Amount<input value={money(form.original_amount)} disabled/></label><label>Approved Amount<input type="number" step="0.01" value={form.approved_amount??''} onChange={e=>setForm(f=>({...f,approved_amount:e.target.value}))}/></label><label>Payment Type<select value={form.payment_type||'Check'} onChange={e=>setForm(f=>({...f,payment_type:e.target.value}))}><option>Cash</option><option>Check</option><option>ACH</option><option>Card</option><option>Other</option></select></label><label>Check Number<input value={form.check_number||''} onChange={e=>setForm(f=>({...f,check_number:e.target.value}))}/></label><label>Status<select value={form.payment_status||'Pending'} onChange={e=>setForm(f=>({...f,payment_status:e.target.value,paid_date:e.target.value==='Paid'?(f.paid_date||today()):f.paid_date}))}><option>Pending</option><option>Paid</option><option>Void</option></select></label><label>Paid Date<input type="date" value={form.paid_date||''} onChange={e=>setForm(f=>({...f,paid_date:e.target.value}))}/></label><label className="wide">Notes<textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label></div><footer><button className="btn secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="btn primary" onClick={save}>Save Changes</button></footer></section></div>}

    {bulkEditing&&<div className="payroll-edit-overlay" onClick={()=>setBulkEditing(false)}><section className="payroll-edit-modal" onClick={e=>e.stopPropagation()}><header><div><h2>Edit Selected Payroll</h2><p>Only fields you choose below will be changed for {selected.length} selected record{selected.length===1?'':'s'}.</p></div><button className="modal-close" onClick={()=>setBulkEditing(false)}>×</button></header><div className="payroll-edit-grid"><label>Status<select value={bulkForm.payment_status} onChange={e=>setBulkForm(f=>({...f,payment_status:e.target.value,paid_date:e.target.value==='Paid'?(f.paid_date||today()):f.paid_date}))}><option value="">Keep current status</option><option>Pending</option><option>Paid</option><option>Void</option></select></label><label>Payment Type<select value={bulkForm.payment_type} onChange={e=>setBulkForm(f=>({...f,payment_type:e.target.value}))}><option value="">Keep current payment type</option><option>Cash</option><option>Check</option><option>ACH</option><option>Card</option><option>Other</option></select></label><label>Check Number<input value={bulkForm.check_number} placeholder="Leave blank to keep current" onChange={e=>setBulkForm(f=>({...f,check_number:e.target.value}))}/></label><label>Paid Date<input type="date" value={bulkForm.paid_date} onChange={e=>setBulkForm(f=>({...f,paid_date:e.target.value}))}/></label></div><footer><button className="btn secondary" onClick={()=>setBulkEditing(false)}>Cancel</button><button className="btn primary" onClick={applyBulkEdit}>Apply Changes</button></footer></section></div>}
  </div>
}
