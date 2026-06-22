import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { createId, sortByName } from '../lib/localStore'

const emptyForm = {
  name: '', employee_type: 'Regular', job_type: 'Kitchen', pay_type: 'Hourly', payroll_type: 'Cash', base_pay: '', extra_pay: 0, extra_reason: '', is_active: true
}
const payTypes = ['Tips', 'Hourly', 'Salary']
const payrollMethods = ['Cash', 'Check']

export default function Employees({ data, setData }) {
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [newEmployeeType, setNewEmployeeType] = useState('')
  const [newJobType, setNewJobType] = useState('')
  const [status, setStatus] = useState('Local auto-save is active. Employees stay saved when you change screens.')

  const employees = data.employees || []
  const employeeTypes = data.employeeTypes || []
  const jobTypes = data.jobTypes || []

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function clearForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  function saveEmployee(event) {
    event.preventDefault()
    const name = form.name.trim()
    if (!name) return setStatus('Employee name is required')

    const record = {
      ...form,
      name,
      base_pay: Number(form.base_pay || 0),
      extra_pay: Number(form.extra_pay || 0),
      extra_reason: String(form.extra_reason || '').trim(),
      is_active: Boolean(form.is_active)
    }

    setData(prev => {
      const nextEmployees = editingId
        ? prev.employees.map(emp => emp.id === editingId ? { ...emp, ...record, id: editingId } : emp)
        : [...prev.employees, { ...record, id: createId('emp') }]
      return { ...prev, employees: sortByName(nextEmployees) }
    })
    setStatus(editingId ? 'Employee updated and saved locally' : 'Employee added and saved locally')
    clearForm()
  }

  function editEmployee(emp) {
    setEditingId(emp.id)
    setForm({
      name: emp.name || '',
      employee_type: emp.employee_type || 'Regular',
      job_type: emp.job_type || 'Kitchen',
      pay_type: emp.pay_type || 'Hourly',
      payroll_type: emp.payroll_type || 'Cash',
      base_pay: emp.base_pay ?? '',
      extra_pay: emp.extra_pay ?? 0,
      extra_reason: emp.extra_reason || '',
      is_active: emp.is_active !== false
    })
    setTimeout(() => document.getElementById('employeeName')?.focus(), 0)
  }

  function deleteEmployee(id) {
    setData(prev => ({
      ...prev,
      employees: prev.employees.filter(emp => emp.id !== id),
      payrollGroups: prev.payrollGroups.map(group => ({ ...group, memberIds: group.memberIds.filter(memberId => memberId !== id) }))
    }))
    if (editingId === id) clearForm()
    setStatus('Employee deleted locally and removed from payroll groups')
  }

  function addEmployeeType() {
    const value = newEmployeeType.trim()
    if (!value) return
    setData(prev => prev.employeeTypes.some(type => type.toLowerCase() === value.toLowerCase()) ? prev : { ...prev, employeeTypes: [...prev.employeeTypes, value].sort() })
    updateField('employee_type', value)
    setNewEmployeeType('')
    setStatus(`Employee type saved: ${value}`)
  }

  function addJobType() {
    const value = newJobType.trim()
    if (!value) return
    setData(prev => prev.jobTypes.some(type => type.toLowerCase() === value.toLowerCase()) ? prev : { ...prev, jobTypes: [...prev.jobTypes, value].sort() })
    updateField('job_type', value)
    setNewJobType('')
    setStatus(`Job type saved: ${value}`)
  }

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sortByName(employees).filter(emp => !q || `${emp.name} ${emp.employee_type} ${emp.job_type} ${emp.pay_type} ${emp.payroll_type}`.toLowerCase().includes(q))
  }, [employees, search])

  return <>
    <div className="page-head employee-head">
      <div>
        <h1>Employees</h1>
        <p>Compact employee setup with employee type, job type, pay type, and local auto-save.</p>
      </div>
      <div className="employee-head-actions">
        <div className="search-box"><Icon name="search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..." /></div>
      </div>
    </div>

    <div className="status-pill">{status}</div>

    <section className="form-card employee-form-card tight-card">
      <h2>{editingId ? 'Edit Employee' : 'Add Employee'}</h2>
      <form onSubmit={saveEmployee} className="employee-form-grid clean-grid">
        <label>Employee name <span>*</span><input id="employeeName" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Name" /></label>
        <label>Employee type<select value={form.employee_type} onChange={e => updateField('employee_type', e.target.value)}>{employeeTypes.map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Job type<select value={form.job_type} onChange={e => updateField('job_type', e.target.value)}>{jobTypes.map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Pay type<select value={form.pay_type} onChange={e => updateField('pay_type', e.target.value)}>{payTypes.map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Payroll method<select value={form.payroll_type} onChange={e => updateField('payroll_type', e.target.value)}>{payrollMethods.map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Base pay<input type="number" min="0" step="0.01" value={form.base_pay} onChange={e => updateField('base_pay', e.target.value)} placeholder="0.00" /></label>
        <label>Extra pay<input type="number" min="0" step="0.01" value={form.extra_pay} onChange={e => updateField('extra_pay', e.target.value)} placeholder="0.00" /></label>
        <label>Extra reason<input value={form.extra_reason} onChange={e => updateField('extra_reason', e.target.value)} placeholder="Optional" /></label>
        <div className="form-actions-inline"><button className="btn secondary" type="button" onClick={clearForm}>Clear</button><button className="btn primary" type="submit"><Icon name="save" /> Save</button></div>
      </form>

      <div className="type-manager-grid compact-types">
        <div className="type-box"><h3>Add employee type</h3><div className="mini-add-row"><input value={newEmployeeType} onChange={e => setNewEmployeeType(e.target.value)} placeholder="Example: Seasonal" /><button className="btn secondary" type="button" onClick={addEmployeeType}>Add</button></div></div>
        <div className="type-box"><h3>Add job type</h3><div className="mini-add-row"><input value={newJobType} onChange={e => setNewJobType(e.target.value)} placeholder="Example: Busser" /><button className="btn secondary" type="button" onClick={addJobType}>Add</button></div></div>
      </div>
    </section>

    <section className="table-card employee-table-card compact-table-card">
      <header><h2>Employee List</h2><span>{filteredEmployees.length} employees</span></header>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Job</th><th>Pay</th><th>Method</th><th>Base</th><th>Extra</th><th>Action</th></tr></thead>
        <tbody>{filteredEmployees.map(emp => <tr key={emp.id}>
          <td><b>{emp.name}</b><small>{emp.is_active === false ? 'Inactive' : 'Active'}</small></td>
          <td>{emp.employee_type}</td><td>{emp.job_type}</td><td><span className={`tag ${String(emp.pay_type).toLowerCase()}`}>{emp.pay_type}</span></td>
          <td><span className={emp.payroll_type === 'Cash' ? 'tag cash' : 'tag check'}>{emp.payroll_type}</span></td>
          <td>${Number(emp.base_pay || 0).toFixed(2)}</td><td>${Number(emp.extra_pay || 0).toFixed(2)}</td>
          <td className="row-actions"><button onClick={() => editEmployee(emp)}>Edit</button><button className="delete-link" onClick={() => deleteEmployee(emp.id)}>Delete</button></td>
        </tr>)}</tbody>
      </table>
    </section>
  </>
}
