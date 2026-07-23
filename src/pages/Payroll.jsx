import React, { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { createId, sortByName } from '../lib/localStore'
import { detectToastLaborPeriod, laborImportDiagnostics, parseToastLaborRows } from '../engine/ToastLaborEngine'

const PAY_METHODS = ['Cash', 'Check', 'ACH', 'Card', 'Other']

function today() { return new Date().toISOString().slice(0, 10) }
function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }
function num(value) { return Number(String(value ?? '').replace(/[$,%]/g, '').trim()) || 0 }
function round2(value) { return Math.round((num(value) + Number.EPSILON) * 100) / 100 }
function money(value) { return round2(value).toFixed(2) }
function normalizeName(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function displayToastName(value) {
  const raw = String(value || '').trim()
  if (!raw.includes(',')) return raw
  const [last, first] = raw.split(',').map(part => part.trim())
  return [first, last].filter(Boolean).join(' ')
}
function sameEmployee(a, b) {
  const left = normalizeName(a)
  const right = normalizeName(displayToastName(b))
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)))
}
function entryDate(row) { return String(row.pay_date || row.payroll_date || row.date || '').slice(0, 10) }
function rowOverlapsRange(row, start, end) {
  const rowStart = String(row.period_start || entryDate(row) || '').slice(0, 10)
  const rowEnd = String(row.period_end || entryDate(row) || '').slice(0, 10)
  if (start && rowEnd && rowEnd < start) return false
  if (end && rowStart && rowStart > end) return false
  return true
}
function isApproved(row) { return String(row.approval_status || '').toLowerCase() === 'approved' || Boolean(row.approved_at) }
function originalTips(row) { return round2(row.original_tips ?? row.total_tips ?? (num(row.tips) + num(row.tip_deduction))) }
function finalPay(row) { return round2(num(row.regular_pay) + num(row.overtime_pay) + num(row.tips) + num(row.extra_pay)) }

function presetRange(key) {
  const now = new Date()
  const iso = value => value.toISOString().slice(0, 10)
  if (key === 'today') return [iso(now), iso(now)]
  if (key === 'thisMonth') return [monthStart(), iso(now)]
  if (key === 'lastWeek') {
    const end = new Date(now); end.setDate(now.getDate() - now.getDay())
    const start = new Date(end); start.setDate(end.getDate() - 6)
    return [iso(start), iso(end)]
  }
  if (key === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return [iso(start), iso(end)]
  }
  return ['', '']
}

function blankManual() {
  return {
    employee_id: '', employee_name: '', period_start: today(), period_end: today(), pay_date: today(), hours: '', regular_pay: '', overtime_pay: '',
    original_tips: '', tip_deduction: '', extra_pay: '', extra_reason: '', payroll_type: 'Check', check_number: '', notes: ''
  }
}

export default function Payroll({ data, setData }) {
  const employees = sortByName((data.employees || []).filter(item => item.is_active !== false))
  const entries = data.payrollEntries || []
  const tipRate = num(data.settings?.tipWithholdingRate ?? 3.5)
  const payrollGroups = sortByName(data.payrollGroups || [])

  const [dateStart, setDateStart] = useState(monthStart())
  const [dateEnd, setDateEnd] = useState(today())
  const [status, setStatus] = useState('Upload Toast labor, select a date range, then calculate payroll.')
  const [builderRows, setBuilderRows] = useState([])
  const [importedRows, setImportedRows] = useState([])
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [selectedBuilderIds, setSelectedBuilderIds] = useState([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [showGroupPayroll, setShowGroupPayroll] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState('kitchen-auto')
  const [groupPeriodStart, setGroupPeriodStart] = useState(today())
  const [groupPeriodEnd, setGroupPeriodEnd] = useState(today())
  const [groupPayDate, setGroupPayDate] = useState(today())
  const [groupEmployeeSearch, setGroupEmployeeSearch] = useState('')
  const [groupAdjustments, setGroupAdjustments] = useState({})
  const [manual, setManual] = useState(blankManual())
  const [editingId, setEditingId] = useState('')
  const [sourceFile, setSourceFile] = useState('')


  const importedEmployeeOptions = useMemo(() => {
    const names = importedRows.map(row => displayToastName(row.raw_name || row.employee_name)).filter(Boolean)
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
  }, [importedRows])

  const filteredImportedRows = useMemo(() => importedRows.filter(row => {
    const date = String(row.pay_date || row.business_date || '').slice(0, 10)
    if (dateStart && date && date < dateStart) return false
    if (dateEnd && date && date > dateEnd) return false
    if (employeeFilter && !sameEmployee(employeeFilter, row.raw_name || row.employee_name)) return false
    if (employeeSearch && !normalizeName(displayToastName(row.raw_name || row.employee_name)).includes(normalizeName(employeeSearch))) return false
    return true
  }), [importedRows, dateStart, dateEnd, employeeFilter, employeeSearch])

  useEffect(() => {
    if (!importedRows.length) return
    const groups = new Map()
    filteredImportedRows.forEach(source => {
      const rawName = source.raw_name || source.employee_name || ''
      const employee = employees.find(item => sameEmployee(item.name, rawName))
      const name = employee?.name || displayToastName(rawName)
      if (!name) return
      const key = employee?.id || normalizeName(name)
      const current = groups.get(key) || {
        id: createId('build'), employee_id: employee?.id || '', employee_name: name,
        job_type: employee?.job_type || source.job_type || '', hours: 0, regular_pay: 0, overtime_pay: 0,
        original_tips: 0, total_tips: 0, tip_deduction: 0, tips: 0, extra_pay: 0, extra_reason: '',
        payroll_type: employee?.payroll_type || 'Check', check_number: employee?.default_check_number || '', notes: '',
        period_start: dateStart || source.period_start || '', period_end: dateEnd || source.period_end || '',
        source_file: sourceFile, source_rows: 0
      }
      current.hours = round2(current.hours + num(source.hours))
      current.regular_pay = round2(current.regular_pay + num(source.regular_pay || source.gross_pay))
      current.overtime_pay = round2(current.overtime_pay + num(source.overtime_pay))
      current.original_tips = round2(current.original_tips + num(source.total_tips))
      current.total_tips = current.original_tips
      current.tip_deduction = round2(current.tip_deduction + num(source.tip_deduction))
      current.tips = round2(current.tips + num(source.tips))
      current.source_rows += 1
      current.total_pay = finalPay(current)
      groups.set(key, current)
    })
    const rows = Array.from(groups.values()).sort((a, b) => a.employee_name.localeCompare(b.employee_name))
    setBuilderRows(rows)
    setSelectedBuilderIds(rows.map(row => row.id))
    const diag = laborImportDiagnostics(filteredImportedRows)
    setStatus(rows.length
      ? `Showing ${filteredImportedRows.length} Toast line entries for ${rows.length} employee(s): ${money(diag.hours)} hours and $${money(diag.regularPay)} wages.`
      : 'No Toast labor line entries match this employee and date range.')
  }, [filteredImportedRows, importedRows.length, employees, dateStart, dateEnd, sourceFile])

  const filteredHistory = useMemo(() => {
    const query = normalizeName([historySearch, employeeSearch].filter(Boolean).join(' '))
    return entries
      .filter(row => {
        if (!rowOverlapsRange(row, dateStart, dateEnd)) return false
        if (query && !normalizeName(`${row.employee_name} ${row.group_name} ${row.check_number} ${row.payroll_type}`).includes(query)) return false
        return true
      })
      .sort((a, b) => entryDate(b).localeCompare(entryDate(a)) || String(a.employee_name || '').localeCompare(String(b.employee_name || '')))
  }, [entries, dateStart, dateEnd, historySearch, employeeSearch])

  const visibleBuilderRows = useMemo(() => {
    const query = normalizeName(employeeSearch)
    return builderRows.filter(row => !query || normalizeName(`${row.employee_name} ${row.job_type} ${row.payroll_type}`).includes(query))
  }, [builderRows, employeeSearch])

  const builderTotals = useMemo(() => visibleBuilderRows.reduce((acc, row) => {
    acc.employees += 1
    acc.hours += num(row.hours)
    acc.regular += num(row.regular_pay)
    acc.overtime += num(row.overtime_pay)
    acc.originalTips += originalTips(row)
    acc.withheld += num(row.tip_deduction)
    acc.netTips += num(row.tips)
    acc.extra += num(row.extra_pay)
    acc.final += finalPay(row)
    return acc
  }, { employees: 0, hours: 0, regular: 0, overtime: 0, originalTips: 0, withheld: 0, netTips: 0, extra: 0, final: 0 }), [visibleBuilderRows])

  const historyTotals = useMemo(() => filteredHistory.reduce((acc, row) => {
    acc.employees.add(normalizeName(row.employee_name))
    acc.hours += num(row.hours)
    acc.originalTips += originalTips(row)
    acc.withheld += num(row.tip_deduction)
    acc.extra += num(row.extra_pay)
    acc.final += finalPay(row)
    return acc
  }, { employees: new Set(), hours: 0, originalTips: 0, withheld: 0, extra: 0, final: 0 }), [filteredHistory])

  const selectedPayrollGroup = payrollGroups.find(group => group.id === selectedGroupId)
  const groupMembers = useMemo(() => {
    const base = selectedGroupId === 'kitchen-auto'
      ? employees.filter(employee => /kitchen|cook|chef|prep|dish/i.test(`${employee.job_type || ''} ${employee.employee_type || ''}`))
      : employees.filter(employee => (selectedPayrollGroup?.memberIds || []).includes(employee.id))
    const query = normalizeName(groupEmployeeSearch)
    return base.filter(employee => !query || normalizeName(`${employee.name} ${employee.job_type} ${employee.employee_type}`).includes(query))
  }, [employees, selectedGroupId, selectedPayrollGroup, groupEmployeeSearch])

  function groupValue(employee, field) {
    const saved = groupAdjustments[employee.id] || {}
    if (field === 'regular_pay') return saved.regular_pay ?? employee.base_pay ?? ''
    if (field === 'extra_pay') return saved.extra_pay ?? employee.extra_pay ?? ''
    if (field === 'extra_reason') return saved.extra_reason ?? employee.extra_reason ?? ''
    if (field === 'payroll_type') return saved.payroll_type ?? selectedPayrollGroup?.payroll_type ?? employee.payroll_type ?? 'Cash'
    if (field === 'check_number') return saved.check_number ?? employee.default_check_number ?? ''
    return saved[field] ?? ''
  }

  function updateGroupAdjustment(employeeId, field, value) {
    setGroupAdjustments(current => ({ ...current, [employeeId]: { ...(current[employeeId] || {}), [field]: value } }))
  }

  function createGroupPayroll() {
    if (!groupPeriodStart || !groupPeriodEnd || groupPeriodStart > groupPeriodEnd) return setStatus('Select a valid group payroll start and end date.')
    if (!groupMembers.length) return setStatus('No kitchen employees are available in this payroll group.')
    for (const employee of groupMembers) {
      if (num(groupValue(employee, 'extra_pay')) > 0 && !String(groupValue(employee, 'extra_reason')).trim()) {
        return setStatus(`${employee.name}: enter an Extra Pay Reason.`)
      }
    }
    const groupName = selectedGroupId === 'kitchen-auto' ? 'Kitchen Payroll' : (selectedPayrollGroup?.name || 'Payroll Group')
    const rows = groupMembers.map(employee => {
      const row = {
        id: createId('pay'), source: 'Manual Payroll Group', employee_id: employee.id, employee_name: employee.name,
        group_name: groupName, pay_date: groupPayDate, period_start: groupPeriodStart, period_end: groupPeriodEnd,
        job_type: employee.job_type || '', pay_type: employee.pay_type || 'Hourly',
        payroll_type: groupValue(employee, 'payroll_type'), check_number: String(groupValue(employee, 'check_number') || '').trim(),
        hours: 0, regular_pay: round2(groupValue(employee, 'regular_pay')), overtime_pay: 0, original_tips: 0, total_tips: 0,
        tip_deduction: 0, tips: 0, extra_pay: round2(groupValue(employee, 'extra_pay')),
        extra_reason: String(groupValue(employee, 'extra_reason') || '').trim(), notes: '', approval_status: 'Pending', created_at: new Date().toISOString()
      }
      row.total_pay = finalPay(row)
      return row
    })
    setData(prev => ({ ...prev, payrollEntries: [...rows, ...(prev.payrollEntries || [])] }))
    setShowGroupPayroll(false)
    setGroupAdjustments({})
    setStatus(`Added ${rows.length} employees from ${groupName} for ${groupPayDate}.`)
  }

  function applyPreset(key) {
    const [start, end] = presetRange(key)
    setDateStart(start)
    setDateEnd(end)
  }

  function updateBuilder(id, field, value) {
    setBuilderRows(rows => rows.map(row => {
      if (row.id !== id) return row
      const next = { ...row, [field]: value }
      if (field === 'employee_id') {
        const employee = employees.find(item => item.id === value)
        if (employee) {
          next.employee_name = employee.name
          next.payroll_type = employee.payroll_type || next.payroll_type
          next.check_number = employee.default_check_number || next.check_number
          next.job_type = employee.job_type || next.job_type
        }
      }
      if (field === 'original_tips' || field === 'tip_deduction') {
        const original = field === 'original_tips' ? num(value) : originalTips(next)
        const withheld = field === 'tip_deduction' ? num(value) : num(next.tip_deduction)
        next.original_tips = round2(original)
        next.total_tips = round2(original)
        next.tips = round2(Math.max(0, original - withheld))
      }
      next.total_pay = finalPay(next)
      return next
    }))
  }

  function toggleBuilder(id) {
    setSelectedBuilderIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id])
  }

  function toggleAllBuilder() {
    const ids = visibleBuilderRows.map(row => row.id)
    const allSelected = ids.length && ids.every(id => selectedBuilderIds.includes(id))
    setSelectedBuilderIds(current => allSelected ? current.filter(id => !ids.includes(id)) : Array.from(new Set([...current, ...ids])))
  }

  async function handleToastFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const detected = detectToastLaborPeriod(XLSX, workbook)
      const parsed = parseToastLaborRows(XLSX, workbook, {
        payDate: detected.end || today(), tipRate, reportPeriod: detected, fileName: file.name
      })
      setSourceFile(file.name)
      setImportedRows(parsed)
      setEmployeeFilter('')
      setEmployeeSearch('')
      if (detected.start && detected.end) {
        setDateStart(detected.start)
        setDateEnd(detected.end)
      }
      const diag = laborImportDiagnostics(parsed)
      setStatus(parsed.length
        ? `Imported ${parsed.length} Toast line entries from ${file.name}. Select an employee and date range to calculate payroll.`
        : `No Toast labor line entries were found in ${file.name}.`)
    } catch (error) {
      console.error(error)
      setStatus(error?.message || 'Toast payroll import failed.')
    } finally {
      event.target.value = ''
    }
  }

  function validateBuilderRows(rows) {
    for (const row of rows) {
      if (num(row.extra_pay) > 0 && !String(row.extra_reason || '').trim()) return `${row.employee_name}: enter an Extra Pay Reason.`
      if ((row.payroll_type || 'Check') === 'Check' && !String(row.check_number || '').trim()) return `${row.employee_name}: enter a check number or change the payment method.`
    }
    return ''
  }

  function createPayroll() {
    const selected = builderRows.filter(row => selectedBuilderIds.includes(row.id))
    if (!selected.length) return setStatus('Select at least one employee to create payroll.')
    const validation = validateBuilderRows(selected)
    if (validation) return setStatus(validation)

    setData(prev => {
      const oldEntries = prev.payrollEntries || []
      const newEmployees = []
      const resolved = selected.map(row => {
        let employee = (prev.employees || []).find(item => item.id === row.employee_id)
        if (!employee) {
          employee = {
            id: createId('emp'), name: row.employee_name, employee_type: row.job_type || 'Regular', job_type: row.job_type || 'Other',
            pay_type: originalTips(row) > 0 ? 'Tips' : 'Hourly', payroll_type: row.payroll_type || 'Check',
            default_check_number: row.check_number || '', base_pay: 0, is_active: true, created_from: 'toast_payroll_builder'
          }
          newEmployees.push(employee)
        }
        return { row, employee }
      })
      const replaceKeys = new Set(resolved.map(({ row, employee }) => `${employee.id}|${row.period_start}|${row.period_end}`))
      const kept = oldEntries.filter(entry => {
        const key = `${entry.employee_id}|${entry.period_start || entryDate(entry)}|${entry.period_end || entryDate(entry)}`
        return !replaceKeys.has(key)
      })
      const created = resolved.map(({ row, employee }) => ({
        id: createId('pay'), import_id: createId('import'), source: 'Toast Payroll Builder', source_file: row.source_file || sourceFile,
        employee_id: employee.id, employee_name: employee.name, group_name: `Toast Payroll ${row.period_start} to ${row.period_end}`,
        pay_date: row.period_end || dateEnd || today(), period_start: row.period_start || dateStart, period_end: row.period_end || dateEnd,
        job_type: row.job_type || employee.job_type || '', pay_type: employee.pay_type || 'Hourly', payroll_type: row.payroll_type || employee.payroll_type || 'Check',
        check_number: row.check_number || '', hours: round2(row.hours), regular_pay: round2(row.regular_pay), overtime_pay: round2(row.overtime_pay),
        original_tips: originalTips(row), total_tips: originalTips(row), tip_deduction: round2(row.tip_deduction), tips: round2(row.tips),
        extra_pay: round2(row.extra_pay), extra_reason: String(row.extra_reason || '').trim(), notes: String(row.notes || '').trim(),
        total_pay: finalPay(row), approval_status: 'Pending', created_at: new Date().toISOString()
      }))
      return {
        ...prev,
        employees: sortByName([...(prev.employees || []), ...newEmployees]),
        payrollEntries: [...created, ...kept],
        payrollImports: [{ id: createId('import'), file_name: sourceFile, period_start: dateStart, period_end: dateEnd, row_count: created.length, created_at: new Date().toISOString() }, ...(prev.payrollImports || [])]
      }
    })
    setBuilderRows([])
    setSelectedBuilderIds([])
    setStatus(`Created payroll for ${selected.length} employees. Review below, then approve.`)
  }

  function approveRows(ids) {
    const selectedIds = ids?.length ? ids : filteredHistory.filter(row => !isApproved(row)).map(row => row.id)
    if (!selectedIds.length) return setStatus('No pending payroll rows are available to approve.')
    const approvedAt = new Date().toISOString()
    setData(prev => ({
      ...prev,
      payrollEntries: (prev.payrollEntries || []).map(row => selectedIds.includes(row.id)
        ? { ...row, approval_status: 'Approved', approved_at: approvedAt, total_pay: finalPay(row) }
        : row)
    }))
    setStatus(`Approved ${selectedIds.length} payroll entries.`)
  }

  function updateEntry(id, field, value) {
    setData(prev => ({
      ...prev,
      payrollEntries: (prev.payrollEntries || []).map(row => {
        if (row.id !== id) return row
        const next = { ...row, [field]: value }
        if (field === 'original_tips' || field === 'tip_deduction') {
          const original = field === 'original_tips' ? num(value) : originalTips(next)
          const withheld = field === 'tip_deduction' ? num(value) : num(next.tip_deduction)
          next.original_tips = round2(original)
          next.total_tips = round2(original)
          next.tips = round2(Math.max(0, original - withheld))
        }
        next.total_pay = finalPay(next)
        return next
      })
    }))
  }

  function deleteEntry(id) {
    setData(prev => ({ ...prev, payrollEntries: (prev.payrollEntries || []).filter(row => row.id !== id) }))
    setStatus('Payroll entry deleted.')
  }

  function saveManual() {
    const employee = employees.find(item => item.id === manual.employee_id)
    const name = employee?.name || manual.employee_name.trim()
    if (!name) return setStatus('Select or enter an employee name.')
    if (!manual.period_start || !manual.period_end || manual.period_start > manual.period_end) return setStatus('Select a valid manual payroll start and end date.')
    if (num(manual.extra_pay) > 0 && !manual.extra_reason.trim()) return setStatus('Extra Pay Reason is required.')
    const tips = originalTips(manual)
    const withheld = manual.tip_deduction === '' ? round2(tips * tipRate / 100) : round2(manual.tip_deduction)
    const row = {
      id: createId('pay'), source: 'Manual Payroll', employee_id: employee?.id || '', employee_name: name,
      group_name: 'Manual Payroll', pay_date: manual.pay_date || manual.period_end || today(), period_start: manual.period_start, period_end: manual.period_end,
      hours: round2(manual.hours), regular_pay: round2(manual.regular_pay), overtime_pay: round2(manual.overtime_pay),
      original_tips: tips, total_tips: tips, tip_deduction: withheld, tips: round2(Math.max(0, tips - withheld)),
      extra_pay: round2(manual.extra_pay), extra_reason: manual.extra_reason.trim(), payroll_type: manual.payroll_type,
      check_number: manual.check_number.trim(), notes: manual.notes.trim(), approval_status: 'Pending', created_at: new Date().toISOString()
    }
    row.total_pay = finalPay(row)
    setData(prev => ({ ...prev, payrollEntries: [row, ...(prev.payrollEntries || [])] }))
    setManual(blankManual())
    setShowManual(false)
    setStatus(`Manual payroll added for ${name}.`)
  }

  function exportCsv() {
    const rows = filteredHistory
    if (!rows.length) return setStatus('No payroll rows to export.')
    const headers = ['Status','Period Start','Period End','Pay Date','Employee','Hours','Regular Pay','Overtime Pay','Original Tips','Tips Withheld','Net Tips','Extra Pay','Extra Reason','Payment Method','Check Number','Final Payroll']
    const values = rows.map(row => [isApproved(row) ? 'Approved' : 'Pending', row.period_start || '', row.period_end || '', entryDate(row), row.employee_name || '', money(row.hours), money(row.regular_pay), money(row.overtime_pay), money(originalTips(row)), money(row.tip_deduction), money(row.tips), money(row.extra_pay), row.extra_reason || '', row.payroll_type || '', row.check_number || '', money(finalPay(row))])
    const csv = [headers, ...values].map(cols => cols.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `payroll-${dateStart || 'all'}-to-${dateEnd || 'all'}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  const builderAllSelected = visibleBuilderRows.length > 0 && visibleBuilderRows.every(row => selectedBuilderIds.includes(row.id))

  return <div className="payroll-rc5-page">
    <div className="page-head payroll-rc5-head">
      <div><h1>Payroll</h1><p>Build employee payroll from Toast, make adjustments, approve, and export.</p></div>
      <div className="payroll-rc5-head-actions">
        <button className="btn secondary" onClick={() => setShowGroupPayroll(true)}><Icon name="users" /> Kitchen Group Payroll</button>
        <button className="btn secondary" onClick={() => setShowManual(true)}><Icon name="plus" /> Manual Payroll</button>
        <label className="btn primary payroll-upload-button"><Icon name="upload" /> Upload Toast Labor<input type="file" accept=".csv,.xlsx,.xls" onChange={handleToastFile} /></label>
      </div>
    </div>

    <DateControls start={dateStart} end={dateEnd} onStartChange={setDateStart} onEndChange={setDateEnd} onApply={() => setStatus(`Payroll range set to ${dateStart || 'first record'} through ${dateEnd || 'latest record'}.`)} onPreset={applyPreset} applyLabel="Use Date Range" />

    <section className="payroll-rc5-card payroll-rc5-filter-card">
      <div className="payroll-rc5-actions">
        <label className="payroll-rc5-filter-label"><span>Employee Search</span><input value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} placeholder="Type employee name" /></label>
        <label className="payroll-rc5-filter-label"><span>Imported Employee</span><select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} disabled={!importedRows.length}>
          <option value="">All imported employees</option>
          {importedEmployeeOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <button className="btn secondary" onClick={() => { setEmployeeFilter(''); setEmployeeSearch('') }}>Clear Employee</button>
      </div>
      <small>The employee search and date range filter both the Toast line entries, calculated payroll, summary totals, and payroll register.</small>
    </section>

    <div className="payroll-rc5-status">{status}</div>

    <section className="payroll-rc5-summary">
      <div><span>Employees</span><strong>{builderRows.length ? visibleBuilderRows.length : historyTotals.employees.size}</strong></div>
      <div><span>Total Hours</span><strong>{money(builderRows.length ? builderTotals.hours : historyTotals.hours)}</strong></div>
      <div><span>Original Tips</span><strong>${money(builderRows.length ? builderTotals.originalTips : historyTotals.originalTips)}</strong></div>
      <div><span>Withheld</span><strong>${money(builderRows.length ? builderTotals.withheld : historyTotals.withheld)}</strong></div>
      <div><span>Extra Pay</span><strong>${money(builderRows.length ? builderTotals.extra : historyTotals.extra)}</strong></div>
      <div className="payroll-rc5-final"><span>Final Payroll</span><strong>${money(builderRows.length ? builderTotals.final : historyTotals.final)}</strong></div>
    </section>

    {importedRows.length > 0 && <section className="payroll-rc5-card">
      <div className="payroll-rc5-card-head">
        <div><h2>Toast Labor Line Entries</h2><p>{filteredImportedRows.length} individual entries match the selected employee and date range.</p></div>
      </div>
      <div className="payroll-rc5-table-wrap"><table className="payroll-rc5-table history"><thead><tr><th>Date</th><th>Employee</th><th>Job</th><th>Hours</th><th>Regular Pay</th><th>OT Pay</th><th>Original Tips</th><th>Withheld</th><th>Net Tips</th></tr></thead><tbody>
        {filteredImportedRows.map((row, index) => <tr key={`${row.employee_external_id || row.employee_name}-${row.pay_date}-${index}`}><td>{row.pay_date || '—'}</td><td><b>{displayToastName(row.raw_name || row.employee_name)}</b></td><td>{row.job_type || '—'}</td><td>{money(row.hours)}</td><td>${money(row.regular_pay)}</td><td>${money(row.overtime_pay)}</td><td>${money(row.total_tips)}</td><td>${money(row.tip_deduction)}</td><td>${money(row.tips)}</td></tr>)}
        {!filteredImportedRows.length && <tr><td colSpan="9" className="empty-cell">No line entries match this employee and date range.</td></tr>}
      </tbody></table></div>
    </section>}

    {builderRows.length > 0 && <section className="payroll-rc5-card">
      <div className="payroll-rc5-card-head">
        <div><h2>Toast Payroll Builder</h2><p>One combined row per employee for {dateStart || 'the first date'} through {dateEnd || 'the last date'}.</p></div>
        <div className="payroll-rc5-actions"><button className="btn secondary" onClick={() => { setImportedRows([]); setBuilderRows([]); setSelectedBuilderIds([]); setEmployeeFilter('') }}>Clear Import</button><button className="btn primary" onClick={createPayroll}>Create Selected Payroll</button></div>
      </div>
      <div className="payroll-rc5-table-wrap"><table className="payroll-rc5-table"><thead><tr>
        <th><input type="checkbox" checked={builderAllSelected} onChange={toggleAllBuilder} /></th><th>Employee</th><th>Hours</th><th>Regular</th><th>OT</th><th>Original Tips</th><th>Withheld</th><th>Net Tips</th><th>Extra Pay</th><th>Reason</th><th>Method</th><th>Check #</th><th>Final</th>
      </tr></thead><tbody>{visibleBuilderRows.map(row => <tr key={row.id}>
        <td><input type="checkbox" checked={selectedBuilderIds.includes(row.id)} onChange={() => toggleBuilder(row.id)} /></td>
        <td><select value={row.employee_id} onChange={e => updateBuilder(row.id, 'employee_id', e.target.value)}><option value="">{row.employee_name} (new)</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select><small>{row.job_type || `${row.source_rows} Toast rows`}</small></td>
        <td><input type="number" step="0.01" value={row.hours} onChange={e => updateBuilder(row.id, 'hours', e.target.value)} /></td>
        <td><input type="number" step="0.01" value={row.regular_pay} onChange={e => updateBuilder(row.id, 'regular_pay', e.target.value)} /></td>
        <td><input type="number" step="0.01" value={row.overtime_pay} onChange={e => updateBuilder(row.id, 'overtime_pay', e.target.value)} /></td>
        <td><input type="number" step="0.01" value={originalTips(row)} onChange={e => updateBuilder(row.id, 'original_tips', e.target.value)} /></td>
        <td><input type="number" step="0.01" value={row.tip_deduction} onChange={e => updateBuilder(row.id, 'tip_deduction', e.target.value)} /></td>
        <td className="money-positive">${money(row.tips)}</td>
        <td><input type="number" step="0.01" value={row.extra_pay} onChange={e => updateBuilder(row.id, 'extra_pay', e.target.value)} /></td>
        <td><input value={row.extra_reason} onChange={e => updateBuilder(row.id, 'extra_reason', e.target.value)} placeholder={num(row.extra_pay) > 0 ? 'Required' : 'Optional'} /></td>
        <td><select value={row.payroll_type} onChange={e => updateBuilder(row.id, 'payroll_type', e.target.value)}>{PAY_METHODS.map(method => <option key={method}>{method}</option>)}</select></td>
        <td><input value={row.check_number} onChange={e => updateBuilder(row.id, 'check_number', e.target.value)} placeholder="Check #" /></td>
        <td className="payroll-rc5-money">${money(finalPay(row))}</td>
      </tr>)}</tbody></table></div>
    </section>}

    <section className="payroll-rc5-card">
      <div className="payroll-rc5-card-head">
        <div><h2>Payroll Register</h2><p>{filteredHistory.length} entries in the selected range.</p></div>
        <div className="payroll-rc5-actions"><input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Employee, check, method" /><button className="btn secondary" onClick={exportCsv}><Icon name="download" /> Export CSV</button><button className="btn success" onClick={() => approveRows()}><Icon name="check" /> Approve Pending</button></div>
      </div>
      <div className="payroll-rc5-table-wrap"><table className="payroll-rc5-table history"><thead><tr><th>Status</th><th>Employee</th><th>Period</th><th>Hours</th><th>Regular</th><th>Tips</th><th>Withheld</th><th>Extra Pay</th><th>Reason</th><th>Method</th><th>Check #</th><th>Final</th><th></th></tr></thead><tbody>
        {filteredHistory.map(row => { const editable = editingId === row.id && !isApproved(row); return <tr key={row.id}>
          <td><span className={`payroll-rc5-pill ${isApproved(row) ? 'approved' : 'pending'}`}>{isApproved(row) ? 'Approved' : 'Pending'}</span></td>
          <td><b>{row.employee_name}</b><small>{row.source || row.group_name || 'Payroll'}</small></td>
          <td>{row.period_start || entryDate(row)}<small>{row.period_end && row.period_end !== row.period_start ? `to ${row.period_end}` : ''}</small></td>
          <td>{editable ? <input type="number" value={row.hours} onChange={e => updateEntry(row.id, 'hours', e.target.value)} /> : money(row.hours)}</td>
          <td>{editable ? <input type="number" value={row.regular_pay} onChange={e => updateEntry(row.id, 'regular_pay', e.target.value)} /> : `$${money(row.regular_pay)}`}</td>
          <td>{editable ? <input type="number" value={originalTips(row)} onChange={e => updateEntry(row.id, 'original_tips', e.target.value)} /> : `$${money(originalTips(row))}`}</td>
          <td>{editable ? <input type="number" value={row.tip_deduction} onChange={e => updateEntry(row.id, 'tip_deduction', e.target.value)} /> : `$${money(row.tip_deduction)}`}</td>
          <td>{editable ? <input type="number" value={row.extra_pay} onChange={e => updateEntry(row.id, 'extra_pay', e.target.value)} /> : `$${money(row.extra_pay)}`}</td>
          <td>{editable ? <input value={row.extra_reason || ''} onChange={e => updateEntry(row.id, 'extra_reason', e.target.value)} /> : (row.extra_reason || '—')}</td>
          <td>{editable ? <select value={row.payroll_type || 'Check'} onChange={e => updateEntry(row.id, 'payroll_type', e.target.value)}>{PAY_METHODS.map(method => <option key={method}>{method}</option>)}</select> : (row.payroll_type || '—')}</td>
          <td>{editable ? <input value={row.check_number || ''} onChange={e => updateEntry(row.id, 'check_number', e.target.value)} /> : (row.check_number || '—')}</td>
          <td className="payroll-rc5-money">${money(finalPay(row))}</td>
          <td><div className="payroll-rc5-row-actions">{!isApproved(row) && <button onClick={() => setEditingId(editable ? '' : row.id)} title={editable ? 'Done' : 'Edit'}><Icon name={editable ? 'check' : 'edit'} size={14} /></button>}<button className="delete" onClick={() => deleteEntry(row.id)} title="Delete"><Icon name="trash" size={14} /></button></div></td>
        </tr> })}
        {!filteredHistory.length && <tr><td colSpan="13" className="empty-cell">No payroll entries in this date range.</td></tr>}
      </tbody></table></div>
    </section>

    {showGroupPayroll && <div className="payroll-rc5-overlay" onClick={() => setShowGroupPayroll(false)}><section className="payroll-rc5-modal payroll-rc5-group-modal" onClick={e => e.stopPropagation()}>
      <header><div><h2>Kitchen Manual Payroll Group</h2><p>Create one manual payroll entry for every kitchen employee.</p></div><button onClick={() => setShowGroupPayroll(false)}>×</button></header>
      <div className="payroll-rc5-group-toolbar">
        <label>Payroll Group<select value={selectedGroupId} onChange={e => { setSelectedGroupId(e.target.value); setGroupAdjustments({}) }}><option value="kitchen-auto">Kitchen Employees (automatic)</option>{payrollGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label>Period Start<input type="date" value={groupPeriodStart} onChange={e => setGroupPeriodStart(e.target.value)} /></label>
        <label>Period End<input type="date" value={groupPeriodEnd} onChange={e => setGroupPeriodEnd(e.target.value)} /></label>
        <label>Pay Date<input type="date" value={groupPayDate} onChange={e => setGroupPayDate(e.target.value)} /></label>
        <label>Search Employee<input value={groupEmployeeSearch} onChange={e => setGroupEmployeeSearch(e.target.value)} placeholder="Kitchen employee name" /></label>
      </div>
      <div className="payroll-rc5-table-wrap"><table className="payroll-rc5-table"><thead><tr><th>Employee</th><th>Job</th><th>Regular Pay</th><th>Extra Pay</th><th>Reason</th><th>Method</th><th>Check #</th><th>Final</th></tr></thead><tbody>
        {groupMembers.map(employee => <tr key={employee.id}><td><b>{employee.name}</b></td><td>{employee.job_type || employee.employee_type || 'Kitchen'}</td><td><input type="number" step="0.01" value={groupValue(employee, 'regular_pay')} onChange={e => updateGroupAdjustment(employee.id, 'regular_pay', e.target.value)} /></td><td><input type="number" step="0.01" value={groupValue(employee, 'extra_pay')} onChange={e => updateGroupAdjustment(employee.id, 'extra_pay', e.target.value)} /></td><td><input value={groupValue(employee, 'extra_reason')} onChange={e => updateGroupAdjustment(employee.id, 'extra_reason', e.target.value)} placeholder={num(groupValue(employee, 'extra_pay')) > 0 ? 'Required' : 'Optional'} /></td><td><select value={groupValue(employee, 'payroll_type')} onChange={e => updateGroupAdjustment(employee.id, 'payroll_type', e.target.value)}>{PAY_METHODS.map(method => <option key={method}>{method}</option>)}</select></td><td><input value={groupValue(employee, 'check_number')} onChange={e => updateGroupAdjustment(employee.id, 'check_number', e.target.value)} /></td><td className="payroll-rc5-money">${money(num(groupValue(employee, 'regular_pay')) + num(groupValue(employee, 'extra_pay')))}</td></tr>)}
        {!groupMembers.length && <tr><td colSpan="8" className="empty-cell">No kitchen employees match this group/search.</td></tr>}
      </tbody></table></div>
      <footer><button className="btn secondary" onClick={() => setShowGroupPayroll(false)}>Cancel</button><button className="btn primary" onClick={createGroupPayroll}>Create Kitchen Group Payroll</button></footer>
    </section></div>}

    {showManual && <div className="payroll-rc5-overlay" onClick={() => setShowManual(false)}><section className="payroll-rc5-modal" onClick={e => e.stopPropagation()}>
      <header><div><h2>Add Manual Payroll</h2><p>Add one employee or open group payroll without a Toast import.</p></div><button onClick={() => setShowManual(false)}>×</button></header>
      <div className="payroll-rc5-modal-switch"><button className="btn secondary" onClick={() => { setShowManual(false); setShowGroupPayroll(true) }}><Icon name="users" /> Add Group Payroll</button></div>
      <div className="payroll-rc5-form">
        <label>Employee<select value={manual.employee_id} onChange={e => setManual(value => ({ ...value, employee_id: e.target.value }))}><option value="">Enter manual name</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        <label>Manual Name<input value={manual.employee_name} onChange={e => setManual(value => ({ ...value, employee_name: e.target.value }))} /></label>
        <label>Period Start<input type="date" value={manual.period_start} onChange={e => setManual(value => ({ ...value, period_start: e.target.value }))} /></label>
        <label>Period End<input type="date" value={manual.period_end} onChange={e => setManual(value => ({ ...value, period_end: e.target.value }))} /></label>
        <label>Pay Date<input type="date" value={manual.pay_date} onChange={e => setManual(value => ({ ...value, pay_date: e.target.value }))} /></label>
        <label>Hours<input type="number" step="0.01" value={manual.hours} onChange={e => setManual(value => ({ ...value, hours: e.target.value }))} /></label>
        <label>Regular Pay<input type="number" step="0.01" value={manual.regular_pay} onChange={e => setManual(value => ({ ...value, regular_pay: e.target.value }))} /></label>
        <label>Overtime Pay<input type="number" step="0.01" value={manual.overtime_pay} onChange={e => setManual(value => ({ ...value, overtime_pay: e.target.value }))} /></label>
        <label>Original Tips<input type="number" step="0.01" value={manual.original_tips} onChange={e => setManual(value => ({ ...value, original_tips: e.target.value }))} /></label>
        <label>Tips Withheld<input type="number" step="0.01" value={manual.tip_deduction} placeholder={`${tipRate}% automatic`} onChange={e => setManual(value => ({ ...value, tip_deduction: e.target.value }))} /></label>
        <label>Extra Pay<input type="number" step="0.01" value={manual.extra_pay} onChange={e => setManual(value => ({ ...value, extra_pay: e.target.value }))} /></label>
        <label className="wide">Extra Pay Reason<input value={manual.extra_reason} onChange={e => setManual(value => ({ ...value, extra_reason: e.target.value }))} /></label>
        <label>Payment Method<select value={manual.payroll_type} onChange={e => setManual(value => ({ ...value, payroll_type: e.target.value }))}>{PAY_METHODS.map(method => <option key={method}>{method}</option>)}</select></label>
        <label>Check Number<input value={manual.check_number} onChange={e => setManual(value => ({ ...value, check_number: e.target.value }))} /></label>
        <label className="wide">Notes<input value={manual.notes} onChange={e => setManual(value => ({ ...value, notes: e.target.value }))} /></label>
      </div>
      <footer><button className="btn secondary" onClick={() => setShowManual(false)}>Cancel</button><button className="btn primary" onClick={saveManual}>Add Payroll</button></footer>
    </section></div>}
  </div>
}
