import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import UploadBar from '../components/UploadBar'
import { createId, sortByName } from '../lib/localStore'
import { parseToastLaborRows } from '../engine/ToastLaborEngine'

const EMPTY = { name:'', employee_type:'Front House', job_type:'Server', pay_type:'Hourly', payroll_type:'Check', base_pay:'', extra_pay:'', extra_reason:'', is_active:true }
const PAY_TYPES = ['Tips','Hourly','Salary']
const METHODS = ['Cash','Check']
const PAGE_SIZE = 10

const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase()
const money = value => `$${Number(value || 0).toFixed(2)}`

export default function EmployeesV2({ data, setData }) {
  const [search,setSearch] = useState('')
  const [jobFilter,setJobFilter] = useState('all')
  const [payFilter,setPayFilter] = useState('all')
  const [statusFilter,setStatusFilter] = useState('all')
  const [page,setPage] = useState(1)
  const [modalOpen,setModalOpen] = useState(false)
  const [editingId,setEditingId] = useState(null)
  const [form,setForm] = useState(EMPTY)
  const [notice,setNotice] = useState('')

  const employees = data.employees || []
  const employeeTypes = data.employeeTypes?.length ? data.employeeTypes : ['Front House','Kitchen','Bar','Management']
  const jobTypes = data.jobTypes?.length ? data.jobTypes : ['Server','Cashier','Cook','Bartender','Manager']

  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter(e => e.is_active !== false).length,
    kitchen: employees.filter(e => /kitchen|cook/i.test(`${e.employee_type} ${e.job_type}`)).length,
    servers: employees.filter(e => /server|wait/i.test(`${e.employee_type} ${e.job_type}`)).length,
    managers: employees.filter(e => /manager/i.test(`${e.employee_type} ${e.job_type}`)).length,
    inactive: employees.filter(e => e.is_active === false).length,
  }), [employees])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sortByName(employees).filter(emp => {
      const matchesSearch = !q || `${emp.name} ${emp.employee_type} ${emp.job_type} ${emp.pay_type} ${emp.payroll_type}`.toLowerCase().includes(q)
      const matchesJob = jobFilter === 'all' || emp.job_type === jobFilter || emp.employee_type === jobFilter
      const matchesPay = payFilter === 'all' || emp.pay_type === payFilter
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? emp.is_active !== false : emp.is_active === false)
      return matchesSearch && matchesJob && matchesPay && matchesStatus
    })
  }, [employees, search, jobFilter, payFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((Math.min(page,totalPages)-1)*PAGE_SIZE, Math.min(page,totalPages)*PAGE_SIZE)

  function openAdd(){ setEditingId(null); setForm(EMPTY); setModalOpen(true) }
  function openEdit(emp){
    setEditingId(emp.id)
    setForm({ ...EMPTY, ...emp, base_pay:emp.base_pay ?? '', extra_pay:emp.extra_pay ?? '' })
    setModalOpen(true)
  }
  function closeModal(){ setModalOpen(false); setEditingId(null); setForm(EMPTY) }
  function saveEmployee(event){
    event.preventDefault()
    const name = form.name.trim()
    if(!name){ setNotice('Employee name is required.'); return }
    const record = { ...form, name, base_pay:Number(form.base_pay || 0), extra_pay:Number(form.extra_pay || 0), extra_reason:String(form.extra_reason || '').trim(), is_active:Boolean(form.is_active) }
    setData(prev => ({ ...prev, employees:sortByName(editingId ? (prev.employees || []).map(emp => emp.id === editingId ? { ...emp, ...record, id:editingId } : emp) : [...(prev.employees || []), { ...record, id:createId('emp') }]) }))
    setNotice(editingId ? 'Employee updated.' : 'Employee added.')
    closeModal()
  }
  function deleteEmployee(emp){
    if(!window.confirm(`Delete ${emp.name}?`)) return
    setData(prev => ({ ...prev, employees:(prev.employees || []).filter(item => item.id !== emp.id), payrollGroups:(prev.payrollGroups || []).map(group => ({ ...group, memberIds:(group.memberIds || []).filter(id => id !== emp.id) })) }))
    setNotice('Employee deleted and removed from payroll groups.')
  }
  function clearFilters(){ setSearch(''); setJobFilter('all'); setPayFilter('all'); setStatusFilter('all'); setPage(1) }

  async function handleLaborUpload(event){
    const file = event.target.files?.[0]
    if(!file) return
    try{
      const workbook = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true })
      const rows = parseToastLaborRows(XLSX, workbook, {}) || []
      const names = [...new Set(rows.map(row => String(row.employee_name || row.employee || row.name || '').trim()).filter(Boolean))]
      if(!names.length){ setNotice('No employee names were found in that Toast Labor file.'); return }
      setData(prev => {
        const existing = new Set((prev.employees || []).map(emp => emp.name.trim().toLowerCase()))
        const added = names.filter(name => !existing.has(name.toLowerCase())).map(name => ({ ...EMPTY, id:createId('emp'), name, base_pay:0, extra_pay:0 }))
        return { ...prev, employees:sortByName([...(prev.employees || []), ...added]) }
      })
      setNotice(`Toast Labor reviewed. Added ${names.filter(name => !employees.some(emp => emp.name.trim().toLowerCase() === name.toLowerCase())).length} new employees.`)
    }catch(error){
      console.error(error)
      setNotice('Toast Labor upload could not be read. Use CSV, XLS, or XLSX.')
    }finally{ event.target.value = '' }
  }

  const cards = [
    ['users','Total Employees',stats.total,'purple'],['userCheck','Active Employees',stats.active,'green'],['utensils','Kitchen Staff',stats.kitchen,'orange'],
    ['person','Servers',stats.servers,'blue'],['business','Managers',stats.managers,'pink'],['alert','Inactive',stats.inactive,'slate']
  ]

  return <div className="rv2-mock-page rv2-employees-mock">
    <div className="rv2-mock-action-row">
      <UploadBar label="Upload Toast Labor" accept=".csv,.xls,.xlsx" onChange={handleLaborUpload} />
      <button className="rv2-primary-button" type="button" onClick={openAdd}><Icon name="plus" size={17}/> Add Employee</button>
    </div>

    {notice && <div className="rv2-inline-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}

    <div className="rv2-stat-grid rv2-stat-grid-six">
      {cards.map(([icon,label,value,tone]) => <div className={`rv2-stat-card tone-${tone}`} key={label}><div className="rv2-stat-label"><span><Icon name={icon} size={13}/></span>{label}</div><strong>{value}</strong></div>)}
    </div>

    <section className="rv2-data-panel">
      <div className="rv2-filter-row">
        <label className="rv2-search-control"><Icon name="search" size={16}/><input value={search} onChange={e => {setSearch(e.target.value);setPage(1)}} placeholder="Search employees..."/></label>
        <select value={jobFilter} onChange={e => {setJobFilter(e.target.value);setPage(1)}}><option value="all">All Job Types</option>{[...new Set([...employeeTypes,...jobTypes])].map(type => <option key={type}>{type}</option>)}</select>
        <select value={payFilter} onChange={e => {setPayFilter(e.target.value);setPage(1)}}><option value="all">All Pay Types</option>{PAY_TYPES.map(type => <option key={type}>{type}</option>)}</select>
        <select value={statusFilter} onChange={e => {setStatusFilter(e.target.value);setPage(1)}}><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <button className="rv2-clear-button" type="button" onClick={clearFilters}>Clear Filters</button>
      </div>
      <div className="rv2-table-scroll">
        <table className="rv2-mock-table">
          <thead><tr><th>Employee</th><th>Type</th><th>Job Type</th><th>Pay Type</th><th>Method</th><th>Base Pay</th><th>Extra Pay</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{visible.length ? visible.map((emp,index) => <tr key={emp.id}>
            <td><div className="rv2-person-cell"><span className={`rv2-person-avatar avatar-${index%5}`}>{initials(emp.name)}</span><strong>{emp.name}</strong></div></td>
            <td>{emp.employee_type || '—'}</td><td>{emp.job_type || '—'}</td><td>{emp.pay_type || '—'}</td>
            <td><span className={`rv2-badge method-${String(emp.payroll_type || '').toLowerCase()}`}>{emp.payroll_type || '—'}</span></td>
            <td>{money(emp.base_pay)}</td><td>{money(emp.extra_pay)}</td><td><span className={`rv2-badge ${emp.is_active === false ? 'status-inactive':'status-active'}`}>{emp.is_active === false ? 'Inactive':'Active'}</span></td>
            <td><div className="rv2-row-icon-actions"><button title="Edit employee" onClick={() => openEdit(emp)}><Icon name="edit" size={15}/></button><button className="danger" title="Delete employee" onClick={() => deleteEmployee(emp)}><Icon name="trash" size={15}/></button></div></td>
          </tr>) : <tr><td colSpan="9" className="rv2-empty-row">No employees match the selected filters.</td></tr>}</tbody>
        </table>
      </div>
      <div className="rv2-table-footer"><div>Show <select value={PAGE_SIZE} disabled><option>{PAGE_SIZE}</option></select> entries</div><div className="rv2-pagination"><button disabled={page<=1} onClick={() => setPage(p => Math.max(1,p-1))}>‹</button>{Array.from({length:totalPages},(_,i)=>i+1).slice(0,5).map(n => <button key={n} className={page===n?'is-active':''} onClick={() => setPage(n)}>{n}</button>)}<button disabled={page>=totalPages} onClick={() => setPage(p => Math.min(totalPages,p+1))}>›</button></div></div>
    </section>

    {modalOpen && <div className="rv2-modal-backdrop" role="presentation" onMouseDown={e => e.target===e.currentTarget && closeModal()}>
      <section className="rv2-form-modal" role="dialog" aria-modal="true" aria-labelledby="employee-modal-title">
        <header><div className="rv2-modal-title"><span><Icon name="employees" size={23}/></span><div><h2 id="employee-modal-title">{editingId?'Edit Employee':'Add Employee'}</h2><p>Manage employee role, pay setup, payment method, and status.</p></div></div><button className="rv2-modal-close" onClick={closeModal}><Icon name="x" size={18}/></button></header>
        <form onSubmit={saveEmployee}>
          <div className="rv2-form-grid">
            <label className="span-2">Employee Name<input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Enter employee name"/></label>
            <label>Employee Type<select value={form.employee_type} onChange={e=>setForm({...form,employee_type:e.target.value})}>{employeeTypes.map(type=><option key={type}>{type}</option>)}</select></label>
            <label>Job Type<select value={form.job_type} onChange={e=>setForm({...form,job_type:e.target.value})}>{jobTypes.map(type=><option key={type}>{type}</option>)}</select></label>
            <label>Pay Type<select value={form.pay_type} onChange={e=>setForm({...form,pay_type:e.target.value})}>{PAY_TYPES.map(type=><option key={type}>{type}</option>)}</select></label>
            <label>Payment Method<select value={form.payroll_type} onChange={e=>setForm({...form,payroll_type:e.target.value})}>{METHODS.map(type=><option key={type}>{type}</option>)}</select></label>
            <label>Base Pay<input type="number" min="0" step="0.01" value={form.base_pay} onChange={e=>setForm({...form,base_pay:e.target.value})} placeholder="0.00"/></label>
            <label>Extra Pay<input type="number" min="0" step="0.01" value={form.extra_pay} onChange={e=>setForm({...form,extra_pay:e.target.value})} placeholder="0.00"/></label>
            <label className="span-2">Extra Pay Reason<input value={form.extra_reason} onChange={e=>setForm({...form,extra_reason:e.target.value})} placeholder="Optional reason"/></label>
            <label className="rv2-check-field span-2"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/><span>Active employee</span></label>
          </div>
          <footer><button className="rv2-clear-button" type="button" onClick={closeModal}>Cancel</button><button className="rv2-primary-button" type="submit"><Icon name="save" size={16}/>{editingId?'Update Employee':'Save Employee'}</button></footer>
        </form>
      </section>
    </div>}
  </div>
}
