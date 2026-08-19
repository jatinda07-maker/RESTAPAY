import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, DollarSign, Filter, Pencil, Plus, Search, Trash2, UsersRound } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import DetailDrawer from '../components/DetailDrawer'
import useCrudCollection from '../hooks/useCrudCollection'
import usePersistentState from '../hooks/usePersistentState'
import { useFeedback } from '../components/AppFeedback'
import {initials,lower,searchableText,safeStatus} from '../lib/safe'
import { effectivePayRate, normalizeEffectiveWeekStart, payRateHistory } from '../core/engines/PayRateEngine.js'
import { canonicalEmployeeJob, inferredDepartmentForJob, JOB_OPTIONS, laborGroupLabel } from '../lib/employeeRoles.js'

const blank={name:'',job:'Kitchen',type:'Hourly',method:'Cash',basePay:'',status:'Active'}

export default function Employees(){
 const [rows,crud]=useCrudCollection('restapay-employees',[])
 const [payRates,rateCrud]=useCrudCollection('restapay-pay-rates',[])
 const [laborClassification,setLaborClassification]=usePersistentState('restapay-labor-classification',{})
 const [searchParams,setSearchParams]=useSearchParams()
 const {notify}=useFeedback()
 const requestedJob=canonicalEmployeeJob(searchParams.get('job')||'')
 const [query,setQuery]=useState('')
 const [job,setJob]=useState(searchParams.get('job')?requestedJob:'All Jobs')
 const [drawer,setDrawer]=useState(null),[modal,setModal]=useState(false),[editing,setEditing]=useState(null),[form,setForm]=useState(blank),[selectedIds,setSelectedIds]=useState([])
 const [rateModal,setRateModal]=useState(false),[rateEmployee,setRateEmployee]=useState(null),[rateForm,setRateForm]=useState({amount:'',effectiveDate:normalizeEffectiveWeekStart(new Date().toISOString().slice(0,10)),reason:''})
 const today=new Date().toISOString().slice(0,10)
 const currentRateFor=(employee)=>effectivePayRate(payRates,employee?.id,today,employee?.basePay??employee?.base_pay??0)
 const departmentFor=(employeeOrJob)=>{
   const rawJob=typeof employeeOrJob==='string'?employeeOrJob:(employeeOrJob?.job||employeeOrJob?.job_type)
   const canonical=canonicalEmployeeJob(rawJob)
   const configured=laborClassification?.[canonical.toLowerCase()]
   return configured?laborGroupLabel(configured):inferredDepartmentForJob(canonical)
 }
 const setJobDepartment=(jobName,department)=>{
   const canonical=canonicalEmployeeJob(jobName)
   const group=department==='Front House'?'FOH':department
   return setLaborClassification(prev=>({...prev,[canonical.toLowerCase()]:group}))
 }
 const openRate=(employee)=>{setRateEmployee(employee);setRateForm({amount:String(currentRateFor(employee)||''),effectiveDate:normalizeEffectiveWeekStart(today),reason:''});setRateModal(true)}
 const safeRows=Array.isArray(rows)?rows.filter(Boolean).map(row=>({...row,job:canonicalEmployeeJob(row.job||row.job_type)})):[]
 const filtered=useMemo(()=>safeRows.filter(r=>(!query||searchableText({...r,department:departmentFor(r)}).includes(lower(query)))&&(job==='All Jobs'||canonicalEmployeeJob(r.job)===job)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true,sensitivity:'base'})),[safeRows,query,job,laborClassification])

 useEffect(()=>{
   const requested=searchParams.get('job')
   if(requested) setJob(canonicalEmployeeJob(requested))
   if(searchParams.get('add')==='1'){
     const nextJob=canonicalEmployeeJob(requested||'Kitchen')
     setEditing(null);setForm({...blank,job:nextJob});setModal(true)
     const next=new URLSearchParams(searchParams);next.delete('add');setSearchParams(next,{replace:true})
   }
 },[searchParams,setSearchParams])

 const openAdd=()=>{setEditing(null);setForm({...blank,job:job==='All Jobs'?'Kitchen':job});setModal(true)}
 const openEdit=(r)=>{setEditing(r.id);setForm({...r,job:canonicalEmployeeJob(r.job||r.job_type),department:departmentFor(r)});setModal(true)}
 const save=async()=>{
   if(!form.name.trim())return notify('Employee name is required.','error')
   const normalizedJob=canonicalEmployeeJob(form.job)
   try{
     if(form.department) await setJobDepartment(normalizedJob,form.department)
     if(editing){
       const existing=safeRows.find(row=>row.id===editing)
       await crud.update(editing,{...form,job:normalizedJob,job_type:normalizedJob,basePay:existing?.basePay??existing?.base_pay??form.basePay})
     }else{
       const employeeId=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`
       const record={...form,job:normalizedJob,job_type:normalizedJob,id:employeeId}
       await crud.add(record)
       if(Number(form.basePay||0)>0)await rateCrud.add({id:`payrate-${employeeId}-${normalizeEffectiveWeekStart(today)}`,employee_id:employeeId,amount:Number(form.basePay||0),effective_date:normalizeEffectiveWeekStart(today),reason:'Initial pay rate'})
     }
     notify(editing?'Employee profile updated in Supabase.':'Employee added to Supabase.');setModal(false)
   }catch(error){notify(error?.message||'Employee could not be saved.','error')}
 }
 const saveRate=async()=>{if(!rateEmployee)return;const amount=Number(rateForm.amount||0);const effectiveDate=normalizeEffectiveWeekStart(rateForm.effectiveDate);if(amount<0||!effectiveDate)return notify('Enter a valid pay amount and effective payroll week.','error');try{const rateId=`payrate-${rateEmployee.id}-${effectiveDate}`;const existing=(payRates||[]).find(row=>String(row.id)===rateId);const rate={id:rateId,employee_id:rateEmployee.id,amount,effective_date:effectiveDate,reason:rateForm.reason||'Pay rate change'};if(existing)await rateCrud.update(rateId,rate);else await rateCrud.add(rate);if(effectiveDate<=today)await crud.update(rateEmployee.id,{basePay:amount,base_pay:amount});setRateModal(false);notify(`Pay rate saved effective ${effectiveDate}. Historical payroll was not changed.`,'success')}catch(error){notify(error?.message||'Pay rate could not be saved.','error')}}
 const del=async(r)=>{if(confirm(`Delete ${r.name}?`)){try{await crud.remove(r.id);setSelectedIds(ids=>ids.filter(id=>id!==r.id));notify('Employee deleted.')}catch(error){notify(error?.message||'Employee could not be deleted.','error')}}}
 const visibleIds=filtered.map(r=>r.id),allVisibleSelected=visibleIds.length>0&&visibleIds.every(id=>selectedIds.includes(id))
 const toggle=id=>setSelectedIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id])
 const toggleAll=()=>setSelectedIds(ids=>allVisibleSelected?ids.filter(id=>!visibleIds.includes(id)):[...new Set([...ids,...visibleIds])])
 const bulkDelete=async()=>{const count=selectedIds.length;if(!count||!confirm(`Delete ${count} selected employee${count===1?'':'s'}?`))return;try{await Promise.all(selectedIds.map(id=>crud.remove(id)));setSelectedIds([]);notify(`${count} employee${count===1?'':'s'} deleted.`)}catch(error){notify(error?.message||'Selected employees could not be deleted.','error')}}
 const cards=[['Total Employees',safeRows.length,'All employee profiles','blue'],['Kitchen Staff',safeRows.filter(r=>departmentFor(r)==='Kitchen / BOH').length,'Kitchen / BOH employees','green'],['Front of House',safeRows.filter(r=>departmentFor(r)==='Front House').length,'FOH employees','purple'],['Active Employees',safeRows.filter(r=>safeStatus(r.status)==='Active').length,'Currently active','orange']]
 const changeJobFilter=value=>{setJob(value);const next=new URLSearchParams(searchParams);if(value==='All Jobs')next.delete('job');else next.set('job',value);setSearchParams(next,{replace:true})}

 return <div className="records-page">
   <section className="records-kpi-grid">{cards.map(([t,v,m,tone])=><button key={t} className={`records-kpi tone-${tone}`} onClick={()=>setDrawer(t)}><span className="records-kpi-icon"><UsersRound size={22}/></span><span><strong>{t}</strong><b>{v}</b><small>{m}</small></span><ChevronRight size={18}/></button>)}</section>
   <section className="records-workspace card-surface">
     <header className="records-header"><div><h2>Employees</h2><p>Manage job, department/classification, pay method, status and effective-dated pay</p></div><div className="records-header-actions">{selectedIds.length>0&&<button className="secondary-action danger-action" onClick={bulkDelete}><Trash2 size={16}/>Delete Selected ({selectedIds.length})</button>}<button className="primary-button" onClick={openAdd}><Plus size={17}/>Add Employee</button></div></header>
     <div className="records-filterbar"><label className="records-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search employees..."/></label><label className="records-select"><Filter size={16}/><select value={job} onChange={e=>changeJobFilter(e.target.value)}><option>All Jobs</option>{JOB_OPTIONS.map(option=><option key={option}>{option}</option>)}</select><ChevronDown size={14}/></label></div>
     <div className="records-table-wrap"><table className="records-table aligned-table employees-table"><thead><tr><th className="select-column"><input type="checkbox" aria-label="Select all visible employees" checked={allVisibleSelected} onChange={toggleAll}/></th><th>Employee</th><th>Job</th><th>Department</th><th>Employee Type</th><th>Pay Method</th><th>Base Pay</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id} className={selectedIds.includes(r.id)?'row-selected':''}><td className="select-column"><input type="checkbox" aria-label={`Select ${r.name}`} checked={selectedIds.includes(r.id)} onChange={()=>toggle(r.id)}/></td><td><span className="employee-cell"><span className="employee-avatar">{initials(r.name)}</span><strong>{r.name||'Unnamed employee'}</strong></span></td><td>{canonicalEmployeeJob(r.job)}</td><td><span className="department-badge">{departmentFor(r)}</span></td><td>{r.type}</td><td>{r.method}</td><td className="numeric">${currentRateFor(r).toFixed(2)}</td><td><button className={`status-badge status-${lower(safeStatus(r.status)).replace(/[^a-z0-9]+/g,'-')}`} onClick={()=>crud.update(r.id,{status:safeStatus(r.status)==='Active'?'Inactive':'Active'})}>{safeStatus(r.status)}</button></td><td><div className="row-actions"><button title="Change Pay Rate" onClick={()=>openRate(r)}><DollarSign size={15}/></button><button title="Edit Employee" onClick={()=>openEdit(r)}><Pencil size={15}/></button><button title="Delete Employee" className="danger" onClick={()=>del(r)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>
   </section>
   <Modal open={modal} title={editing?'Edit Employee':'Add Employee'} subtitle="Job is the specific position; Department is used for FOH/BOH/Management reporting." onClose={()=>setModal(false)} footer={<><button className="secondary-action" onClick={()=>setModal(false)}>Cancel</button><button className="primary-button" onClick={save}>{editing?'Save Changes':'Save Employee'}</button></>}>
     <div className="form-grid"><label>Employee Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/></label><label>Job<select value={canonicalEmployeeJob(form.job)} onChange={e=>setForm({...form,job:e.target.value,department:departmentFor(e.target.value)})}>{JOB_OPTIONS.map(option=><option key={option}>{option}</option>)}</select></label><label>Department / Classification<select value={form.department||departmentFor(form.job)} onChange={e=>setForm({...form,department:e.target.value})}><option>Front House</option><option>Kitchen / BOH</option><option>Management</option><option>Excluded / Other</option></select></label><label>Employee Type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Hourly</option><option>Tip</option><option>Salary</option></select></label><label>Payment Method<select value={form.method} onChange={e=>setForm({...form,method:e.target.value})}><option>Cash</option><option>Check</option><option>ACH</option></select></label><label>{editing?'Current Base Pay (use $ action to change)':'Initial Base Pay'}<input value={editing?String(currentRateFor(safeRows.find(row=>row.id===editing)||form)):form.basePay} readOnly={Boolean(editing)} onChange={e=>setForm({...form,basePay:e.target.value})} placeholder="0.00"/></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Active</option><option>Inactive</option></select></label></div>
   </Modal>
   <Modal open={rateModal} title={rateEmployee?`Change Pay Rate — ${rateEmployee.name}`:'Change Pay Rate'} subtitle="New rates apply from the selected Monday forward. Existing payroll records are never rewritten." onClose={()=>setRateModal(false)} footer={<><button className="secondary-action" onClick={()=>setRateModal(false)}>Cancel</button><button className="primary-button" onClick={saveRate}>Save Pay Rate</button></>}><div className="form-grid"><label>New Weekly/Base Pay<input type="number" min="0" step="0.01" value={rateForm.amount} onChange={e=>setRateForm({...rateForm,amount:e.target.value})}/></label><label>Effective Payroll Week<input type="date" value={rateForm.effectiveDate} onChange={e=>setRateForm({...rateForm,effectiveDate:normalizeEffectiveWeekStart(e.target.value)})}/></label><label className="span-2">Reason<input value={rateForm.reason} onChange={e=>setRateForm({...rateForm,reason:e.target.value})} placeholder="Performance increase, role change, etc."/></label></div>{rateEmployee&&<div className="settings-help"><strong>Pay Rate History</strong>{payRateHistory(payRates,rateEmployee.id).length?payRateHistory(payRates,rateEmployee.id).map(rate=><div key={rate.id}>{rate.effective_date}: ${Number(rate.amount||0).toFixed(2)}{rate.reason?` — ${rate.reason}`:''}</div>):<div>No prior effective-dated rates. Current employee base pay is used as the fallback.</div>}</div>}</Modal>
   <DetailDrawer title={drawer} onClose={()=>setDrawer(null)}/>
 </div>
}
