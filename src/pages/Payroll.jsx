import React, { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { createId, sortByName } from '../lib/localStore'
import { parseToastLaborRows, laborImportDiagnostics } from '../engine/ToastLaborEngine'

function today() { return new Date().toISOString().slice(0, 10) }
function startOfMonthISO(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10) }
function readSavedDateRange() { return { start: startOfMonthISO(), end: today() } }
function saveGlobalDateRange(start, end) {
  try { localStorage.setItem('restapay_payroll_date_range', JSON.stringify({ start, end })) } catch {}
}
function money(value) { return Number(value || 0).toFixed(2) }
function round2(value) { return Number(money(value)) }
function num(value) { return Number(String(value ?? '').replace(/[$,%]/g, '').trim()) || 0 }
function findValue(row, keys) {
  const map = Object.fromEntries(Object.entries(row).map(([k, v]) => [String(k).toLowerCase().replace(/[^a-z0-9]/g, ''), v]))
  for (const key of keys) {
    const found = map[String(key).toLowerCase().replace(/[^a-z0-9]/g, '')]
    if (found !== undefined) return found
  }
  return ''
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9, ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function displayToastName(value) {
  const raw = String(value || '').trim()
  if (!raw.includes(',')) return raw
  const [last, first] = raw.split(',').map(part => part.trim()).filter(Boolean)
  return [first, last].filter(Boolean).join(' ')
}

function nameMatches(employeeName, toastName) {
  const emp = normalizeName(employeeName)
  const raw = normalizeName(toastName)
  const displayed = normalizeName(displayToastName(toastName))
  return emp === raw || emp === displayed || raw.includes(emp) || displayed.includes(emp) || emp.includes(displayed)
}

function defaultRegularPay(employee, imported = {}) {
  if (imported.base_pay !== undefined) return num(imported.base_pay)
  if (employee?.pay_type === 'Hourly') return num(imported.hours) * num(imported.rate || employee.base_pay)
  if (employee?.pay_type === 'Salary') return num(employee.base_pay)
  return num(imported.gross_pay)
}

function normalizeType(value, options = []) {
  const raw = String(value || '').trim()
  if (!raw) return options[0] || 'Regular'
  const match = options.find(item => String(item).toLowerCase() === raw.toLowerCase())
  return match || raw
}


function inferPayrollClassification(source = {}) {
  const text = [source.payroll_classification, source.classification, source.pay_type, source.employee_type, source.job_type, source.group_name, source.employee_name, source.name]
    .map(value => String(value || '').toLowerCase())
    .join(' ')
  if (text.includes('operating labor') || text.includes('kitchen') || text.includes('manager') || text.includes('dish') || text.includes('cook') || text.includes('prep')) return 'Operating Labor'
  if (text.includes('customer tip') || text.includes('server') || text.includes('waiter') || text.includes('waitress') || text.includes('front house') || text.includes('foh') || text.includes('bartender') || text.includes('tip')) return 'Customer Tips'
  return 'Operating Labor'
}

function totalPayrollPay(row = {}) {
  const regular = num(row.regular_pay)
  const tips = num(row.tips)
  const deduction = num(row.tip_deduction)
  const extra = num(row.extra_pay)
  return regular + tips - deduction + extra
}

function employeeAssignmentLabel(employee, groups = []) {
  if (!employee) return 'Unmatched Import'
  const assignedGroups = groups.filter(group => (group.memberIds || []).includes(employee.id)).map(group => group.name).filter(Boolean)
  if (assignedGroups.length) return assignedGroups.join(', ')
  return employee.job_type || employee.employee_type || 'Employee List'
}

export default function Payroll({ data, setData }) {
  const employees = sortByName((data.employees || []).filter(emp => emp.is_active !== false))
  const employeeTypeOptions = data.employeeTypes?.length ? data.employeeTypes : ['Regular', 'Manager', 'Kitchen', 'Front House', 'Seasonal', 'Other']
  const groups = sortByName(data.payrollGroups || [])
  const entries = data.payrollEntries || []
  const tipRate = num(data.settings?.tipWithholdingRate ?? 3.5)

  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || '')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employees[0]?.id || '')
  const [groupName, setGroupName] = useState('')
  const [groupPayrollType, setGroupPayrollType] = useState('Cash')
  const [groupNotes, setGroupNotes] = useState('')
  const [payDate, setPayDate] = useState(today())
  const [toastPayDate, setToastPayDate] = useState(today())
  const [groupPayDate, setGroupPayDate] = useState(today())
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [entryForm, setEntryForm] = useState({ regular_pay: '', hours: '', tips: '', tip_deduction: '', extra_pay: '', extra_reason: '', payroll_classification: 'Operating Labor' })
  const [manualForm, setManualForm] = useState({ employee_id: '', employee_name: '', pay_date: today(), payroll_type: 'Cash', check_number: '', pay_type: 'Hourly', payroll_classification: 'Operating Labor', hours: '', regular_pay: '', tips: '', tip_deduction: '', extra_pay: '', extra_reason: '' })
  const [previewRows, setPreviewRows] = useState([])
  const [status, setStatus] = useState('Local auto-save is active. Payroll groups and entries will not disappear.')
  const [dateStart, setDateStart] = useState(() => readSavedDateRange().start)
  const [dateEnd, setDateEnd] = useState(() => readSavedDateRange().end)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [payMethodFilter, setPayMethodFilter] = useState('all')
  const [payClassFilter, setPayClassFilter] = useState('all')

  function updateDateStart(value) {
    setDateStart(value)
    saveGlobalDateRange(value, dateEnd)
  }

  function updateDateEnd(value) {
    setDateEnd(value)
    saveGlobalDateRange(dateStart, value)
  }

  function applyPayrollRange(start, end, label = 'custom range') {
    setDateStart(start)
    setDateEnd(end)
    saveGlobalDateRange(start, end)
    setStatus(`Applied payroll date range: ${label}`)
  }

  function applyPreset(preset) {
    const now = new Date()
    if (preset === 'today') return applyPayrollRange(today(), today(), 'today')
    if (preset === 'thisMonth') return applyPayrollRange(startOfMonthISO(), today(), 'this month')
    if (preset === 'lastMonth') return applyPayrollRange(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10), new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10), 'last month')
    if (preset === 'lastWeek') {
      const day = now.getDay() || 7
      const thisMonday = new Date(now)
      thisMonday.setDate(now.getDate() - day + 1)
      const lastMonday = new Date(thisMonday)
      lastMonday.setDate(thisMonday.getDate() - 7)
      const lastSunday = new Date(lastMonday)
      lastSunday.setDate(lastMonday.getDate() + 6)
      return applyPayrollRange(lastMonday.toISOString().slice(0, 10), lastSunday.toISOString().slice(0, 10), 'last week')
    }
    return applyPayrollRange('', '', 'all dates')
  }

  function inSelectedRange(dateText) {
    const d = String(dateText || '').slice(0, 10)
    if (!d) return false
    if (dateStart && d < dateStart) return false
    if (dateEnd && d > dateEnd) return false
    return true
  }

  const filteredEntries = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase()
    return entries.filter(entry => {
      const entryDate = entry.pay_date || entry.payroll_date || entry.date
      if (!inSelectedRange(entryDate)) return false
      const method = String(entry.payroll_type || entry.payment_method || '').toLowerCase()
      const classification = String(entry.payroll_classification || inferPayrollClassification(entry)).toLowerCase()
      if (payMethodFilter !== 'all' && method !== payMethodFilter) return false
      if (payClassFilter === 'operating' && classification.includes('tip')) return false
      if (payClassFilter === 'tips' && !classification.includes('tip')) return false
      if (query) {
        const searchable = [entry.employee_name, entry.employee_id, entry.group_name, entry.payroll_type, entry.pay_type, entry.check_number].join(' ').toLowerCase()
        if (!searchable.includes(query)) return false
      }
      return true
    }).sort((a, b) => String(a.pay_date || a.payroll_date || a.date || '').localeCompare(String(b.pay_date || b.payroll_date || b.date || '')) || String(a.employee_name || '').localeCompare(String(b.employee_name || '')))
  }, [entries, dateStart, dateEnd, employeeSearch, payMethodFilter, payClassFilter])
  const rangeLabel = `${dateStart || 'First record'} to ${dateEnd || 'Latest record'}`
  const activeFilterLabel = employeeSearch.trim() ? ` • Employee/search: ${employeeSearch.trim()}` : ''

  const selectedGroup = groups.find(group => group.id === selectedGroupId) || groups[0]
  const memberIds = new Set(selectedGroup?.memberIds || [])
  const groupMembers = employees.filter(emp => memberIds.has(emp.id))
  const availableEmployees = employees.filter(emp => !memberIds.has(emp.id))

  useEffect(() => {
    if (!selectedGroup && groups.length) {
      setSelectedGroupId(groups[0].id)
      return
    }

    if (availableEmployees.length && !availableEmployees.some(emp => emp.id === selectedEmployeeId)) {
      setSelectedEmployeeId(availableEmployees[0].id)
      return
    }

    if (!availableEmployees.length && selectedEmployeeId) {
      setSelectedEmployeeId('')
    }
  }, [selectedGroupId, selectedGroup, groups, availableEmployees, selectedEmployeeId])

  const totals = useMemo(() => filteredEntries.reduce((acc, entry) => {
    const amount = num(entry.total_pay)
    const classification = entry.payroll_classification || inferPayrollClassification(entry)
    const isTips = String(classification).toLowerCase().includes('tip')
    acc.total += amount
    acc.operating += isTips ? 0 : amount
    acc.customerTips += isTips ? amount : 0
    acc.cash += entry.payroll_type === 'Cash' ? amount : 0
    acc.check += entry.payroll_type === 'Check' ? amount : 0
    acc.withheld += num(entry.tip_deduction)
    return acc
  }, { total: 0, operating: 0, customerTips: 0, cash: 0, check: 0, withheld: 0 }), [filteredEntries])

  function createGroup() {
    const name = groupName.trim()
    if (!name) return setStatus('Enter group name first')
    const group = { id: createId('grp'), name, payroll_type: groupPayrollType, notes: groupNotes.trim(), memberIds: [] }
    setData(prev => ({ ...prev, payrollGroups: sortByName([...prev.payrollGroups, group]) }))
    setSelectedGroupId(group.id)
    setGroupName('')
    setGroupNotes('')
    setStatus(`Group saved locally: ${name}`)
  }

  function renameSelectedGroup() {
    if (!selectedGroup) return
    const name = groupName.trim()
    if (!name) return setStatus('Enter new group name first')
    setData(prev => ({ ...prev, payrollGroups: prev.payrollGroups.map(group => group.id === selectedGroup.id ? { ...group, name, payroll_type: groupPayrollType, notes: groupNotes.trim() } : group) }))
    setGroupName('')
    setGroupNotes('')
    setStatus('Group renamed and saved locally')
  }

  function deleteGroup() {
    if (!selectedGroup) return
    setData(prev => ({ ...prev, payrollGroups: prev.payrollGroups.filter(group => group.id !== selectedGroup.id) }))
    const next = groups.find(group => group.id !== selectedGroup.id)
    setSelectedGroupId(next?.id || '')
    setStatus('Group deleted locally')
  }

  function addEmployeeToGroup() {
    if (!selectedGroup) return setStatus('Select a payroll group first')
    if (!selectedEmployeeId) return setStatus('Select an employee first')

    const employeeToAdd = employees.find(emp => emp.id === selectedEmployeeId)
    if (!employeeToAdd) return setStatus('Selected employee was not found')

    const alreadyInGroup = (selectedGroup.memberIds || []).includes(selectedEmployeeId)
    if (alreadyInGroup) {
      const nextAvailable = availableEmployees.find(emp => emp.id !== selectedEmployeeId)
      setSelectedEmployeeId(nextAvailable?.id || '')
      return setStatus(`${employeeToAdd.name} is already in this group`)
    }

    setData(prev => ({
      ...prev,
      payrollGroups: prev.payrollGroups.map(group => {
        if (group.id !== selectedGroup.id) return group
        return {
          ...group,
          memberIds: Array.from(new Set([...(group.memberIds || []), selectedEmployeeId]))
        }
      })
    }))

    const nextAvailable = availableEmployees.find(emp => emp.id !== selectedEmployeeId)
    setSelectedEmployeeId(nextAvailable?.id || '')
    setStatus(`${employeeToAdd.name} added to ${selectedGroup.name} and saved locally`)
  }

  function removeFromGroup(employeeId) {
    if (!selectedGroup) return
    setData(prev => ({ ...prev, payrollGroups: prev.payrollGroups.map(group => group.id === selectedGroup.id ? { ...group, memberIds: (group.memberIds || []).filter(id => id !== employeeId) } : group) }))
    setStatus('Employee removed from group and saved locally')
  }

  function makePayrollRow(employee, source = {}) {
    const hours = num(source.hours)
    const tips = num(source.tips)
    const regularPay = defaultRegularPay(employee, source)
    const extraPay = num(source.extra_pay ?? employee.extra_pay)
    const deduction = employee.pay_type === 'Tips' || tips > 0 ? tips * (tipRate / 100) : 0
    return {
      id: createId('pay'), employee_id: employee.id, employee_name: employee.name, group_name: selectedGroup?.name || source.group_name || 'Imported', pay_date: source.pay_date || groupPayDate || payDate,
      pay_type: employee.pay_type, payroll_type: selectedGroup?.payroll_type || employee.payroll_type, payroll_classification: inferPayrollClassification(employee), check_number: source.check_number || '', hours, regular_pay: regularPay, tips,
      tip_deduction: deduction, extra_pay: extraPay, extra_reason: source.extra_reason || employee.extra_reason || '', total_pay: regularPay + tips - deduction + extraPay
    }
  }

  function addGroupPayroll() {
    if (!selectedGroup) return setStatus('Select a payroll group first')
    if (!groupMembers.length) return setStatus('This group has no employees')
    const rows = groupMembers.map(emp => makePayrollRow(emp, { pay_date: groupPayDate }))
    setData(prev => ({ ...prev, payrollEntries: [...rows, ...prev.payrollEntries] }))
    setStatus(`Added ${rows.length} payroll rows from ${selectedGroup.name} for ${groupPayDate}`)
  }


  function updateManualForm(field, value) {
    setManualForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'employee_id') {
        const employee = employees.find(emp => emp.id === value)
        if (employee) {
          next.employee_name = employee.name
          next.payroll_type = employee.payroll_type || next.payroll_type
          next.pay_type = employee.pay_type || next.pay_type
          next.payroll_classification = inferPayrollClassification(employee)
          if (!next.regular_pay && employee.pay_type === 'Salary') next.regular_pay = money(employee.base_pay)
        }
      }
      return next
    })
  }

  function clearManualForm() {
    setManualForm({ employee_id: '', employee_name: '', pay_date: today(), payroll_type: 'Cash', check_number: '', pay_type: 'Hourly', payroll_classification: 'Operating Labor', hours: '', regular_pay: '', tips: '', tip_deduction: '', extra_pay: '', extra_reason: '' })
  }

  function addManualPayroll() {
    const employee = employees.find(emp => emp.id === manualForm.employee_id)
    const employeeName = (employee?.name || manualForm.employee_name || '').trim()
    if (!employeeName) return setStatus('Select or enter an employee name first')
    const regularPay = num(manualForm.regular_pay)
    const tips = num(manualForm.tips)
    const extraPay = num(manualForm.extra_pay)
    const tipDeduction = num(manualForm.tip_deduction)
    const row = {
      id: createId('pay'),
      employee_id: employee?.id || '',
      employee_name: employeeName,
      group_name: 'Manual Payroll Entry',
      pay_date: manualForm.pay_date || payDate,
      pay_type: employee?.pay_type || manualForm.pay_type || 'Hourly',
      payroll_type: manualForm.payroll_type || employee?.payroll_type || 'Cash',
      payroll_classification: manualForm.payroll_classification || inferPayrollClassification(employee || manualForm),
      check_number: manualForm.check_number.trim(),
      hours: num(manualForm.hours),
      regular_pay: regularPay,
      tips,
      tip_deduction: tipDeduction,
      extra_pay: extraPay,
      extra_reason: manualForm.extra_reason.trim(),
      total_pay: regularPay + tips - tipDeduction + extraPay
    }
    setData(prev => ({ ...prev, payrollEntries: [row, ...(prev.payrollEntries || [])] }))
    clearManualForm()
    setStatus(`Manual payroll row added for ${employeeName} for ${manualForm.pay_date || payDate}`)
  }

  function startEdit(entry) {
    setEditingEntryId(entry.id)
    setEntryForm({
      pay_date: entry.pay_date || today(),
      regular_pay: money(entry.regular_pay),
      hours: money(entry.hours || 0),
      tips: money(entry.tips),
      tip_deduction: money(entry.tip_deduction),
      extra_pay: money(entry.extra_pay),
      extra_reason: entry.extra_reason || '',
      check_number: entry.check_number || '',
      payroll_classification: entry.payroll_classification || inferPayrollClassification(entry)
    })
  }

  function saveEntryEdit() {
    setData(prev => ({ ...prev, payrollEntries: prev.payrollEntries.map(entry => {
      if (entry.id !== editingEntryId) return entry
      const regularPay = num(entryForm.regular_pay)
      const tips = num(entryForm.tips)
      const extraPay = num(entryForm.extra_pay)
      const deduction = num(entryForm.tip_deduction)
      return { ...entry, pay_date: entryForm.pay_date || entry.pay_date || today(), check_number: entryForm.check_number?.trim() || '', payroll_classification: entryForm.payroll_classification || inferPayrollClassification(entry), hours: num(entryForm.hours), regular_pay: regularPay, tips, tip_deduction: deduction, extra_pay: extraPay, extra_reason: entryForm.extra_reason.trim(), total_pay: regularPay + tips - deduction + extraPay }
    }) }))
    setEditingEntryId(null)
    setStatus('Payroll row updated and saved locally')
  }

  function deleteEntry(id) {
    setData(prev => ({ ...prev, payrollEntries: prev.payrollEntries.filter(entry => entry.id !== id) }))
    setStatus('Payroll row deleted locally')
  }

  async function handleLaborFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const laborRows = parseToastLaborRows(XLSX, workbook, { payDate: toastPayDate, tipRate })
      const parsed = laborRows.map(source => {
        const rawName = String(source.raw_name || source.employee_name || '').trim()
        const cleanName = displayToastName(rawName)
        const employee = employees.find(emp => nameMatches(emp.name, rawName))
        const regular = round2(num(source.regular_pay) || defaultRegularPay(employee, source))
        const tipsAfterWithholding = round2(num(source.tips))
        const tipDeduction = round2(num(source.tip_deduction))
        return {
          id: createId('imp'),
          employee_id: employee?.id || '',
          employee_name: employee?.name || cleanName || rawName,
          raw_name: rawName,
          is_new_employee: !employee,
          employee_type: normalizeType(employee?.employee_type || source.job_type, employeeTypeOptions),
          job_type: employee?.job_type || source.job_type || '',
          assignment_label: employeeAssignmentLabel(employee, groups),
          hours: money(source.hours),
          rate: money(source.rate),
          regular_pay: money(regular),
          gross_pay: money(source.gross_pay),
          total_tips: money(source.total_tips),
          tips: money(tipsAfterWithholding),
          tip_deduction: money(tipDeduction),
          extra_pay: '0.00',
          extra_reason: '',
          total_pay: money(regular + tipsAfterWithholding),
          check_number: source.check_number || '',
          payroll_type: employee?.payroll_type || 'Check',
          pay_type: employee?.pay_type || (num(source.total_tips) > 0 ? 'Tips' : 'Hourly'),
          payroll_classification: inferPayrollClassification(employee || { pay_type: num(source.total_tips) > 0 ? 'Tips' : 'Hourly', job_type: source.job_type, employee_name: cleanName || rawName }),
          pay_date: source.pay_date || toastPayDate,
          source_sheet: source.source_sheet || '',
          source_file: file.name
        }
      }).filter(row => row.employee_name)
      const diag = laborImportDiagnostics(laborRows)
      setPreviewRows(parsed)
      setStatus(parsed.length
        ? `Imported ${parsed.length} labor rows from ${file.name}: ${diag.hours.toFixed(2)} hours, $${diag.regularPay.toFixed(2)} wages, $${diag.netTips.toFixed(2)} net tips, $${diag.withheld.toFixed(2)} withheld. Review before adding to payroll.`
        : `No employee labor rows were found in ${file.name}. Confirm this is a Toast Labor Summary, Employee Time, or Payroll workbook.`)
    } catch (error) {
      console.error(error)
      setStatus(error?.message || 'Labor import failed. Review the workbook and try again.')
    } finally {
      event.target.value = ''
    }
  }

  function updatePreview(id, field, value) {
    setPreviewRows(prev => prev.map(row => {
      if (row.id !== id) return row
      const next = { ...row, [field]: value }
      if (field === 'employee_id') {
        const emp = employees.find(item => item.id === value)
        if (emp) Object.assign(next, { employee_name: emp.name, pay_type: emp.pay_type, payroll_type: emp.payroll_type, payroll_classification: inferPayrollClassification(emp), employee_type: emp.employee_type || next.employee_type, job_type: emp.job_type || next.job_type, assignment_label: employeeAssignmentLabel(emp, groups), is_new_employee: false })
        if (!value) Object.assign(next, { is_new_employee: true, assignment_label: 'New Employee Import' })
      }
      if (field === 'employee_type') next.employee_type = normalizeType(value, employeeTypeOptions)
      const regular = round2(num(next.regular_pay))
      const tips = round2(num(next.tips))
      const deduction = round2(num(next.tip_deduction))
      const extra = round2(num(next.extra_pay))
      return { ...next, tip_deduction: field === 'tip_deduction' ? value : money(deduction), total_pay: money(regular + tips - deduction + extra) }
    }))
  }

  function savePreviewToPayroll() {
    const importId = createId('import')
    const sourceRows = previewRows.filter(row => String(row.employee_name || '').trim())
    setData(prev => {
      const existingEmployees = prev.employees || []
      const newEmployees = []
      const rows = sourceRows.map(row => {
        let employee = existingEmployees.find(emp => emp.id === row.employee_id)
        let employeeId = row.employee_id
        let employeeName = String(row.employee_name || '').trim()
        if (!employee) {
          employeeId = createId('emp')
          const employeeType = normalizeType(row.employee_type, employeeTypeOptions)
          employee = {
            id: employeeId,
            name: employeeName,
            employee_type: employeeType,
            job_type: row.job_type || employeeType,
            pay_type: row.pay_type || 'Tips',
            payroll_type: row.payroll_type || 'Check',
            base_pay: num(row.rate),
            extra_pay: 0,
            extra_reason: '',
            is_active: true,
            created_from: 'payroll_import',
            payroll_classification: row.payroll_classification || inferPayrollClassification(row)
          }
          newEmployees.push(employee)
        }
        const sourceLabel = employeeAssignmentLabel(employee, prev.payrollGroups || [])
        return {
          id: createId('pay'), employee_id: employeeId, employee_name: employee.name || employeeName, group_name: row.source_sheet ? `Toast: ${row.source_sheet}` : sourceLabel, pay_date: row.pay_date || toastPayDate,
          pay_type: employee.pay_type || row.pay_type, payroll_type: employee.payroll_type || row.payroll_type, payroll_classification: row.payroll_classification || employee.payroll_classification || inferPayrollClassification(employee), check_number: row.check_number || '', hours: num(row.hours), regular_pay: num(row.regular_pay), tips: num(row.tips),
          tip_deduction: num(row.tip_deduction), extra_pay: num(row.extra_pay), extra_reason: row.extra_reason || '', total_pay: num(row.total_pay)
        }
      })
      return {
        ...prev,
        employees: sortByName([...existingEmployees, ...newEmployees]),
        payrollEntries: [...rows, ...(prev.payrollEntries || [])],
        payrollImports: [{ id: importId, date: toastPayDate, file_name: sourceRows[0]?.source_file || '', row_count: rows.length, new_employee_count: newEmployees.length, created_at: new Date().toISOString() }, ...(prev.payrollImports || [])]
      }
    })
    setPreviewRows([])
    setStatus(`Saved ${sourceRows.length} imported payroll rows and added unmatched employees to the employee list`)
  }

  return <>

    <style>{`
      .payroll-table-card {
        overflow: visible;
      }
      .payroll-entries-fit-table {
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
        font-size: 11px;
      }
      .payroll-entries-list {
        display: grid;
        gap: 10px;
        padding: 12px;
      }
      .payroll-entry-card {
        display: grid;
        grid-template-columns: minmax(150px, 1.1fr) minmax(125px, .9fr) minmax(125px, .9fr) 72px 72px 88px 88px 88px minmax(130px, 1fr) 86px 140px;
        gap: 0;
        align-items: center;
        border: 1px solid #dbe5f1;
        border-radius: 14px;
        background: #fff;
        padding: 10px 12px;
        min-height: 86px;
      }
      .payroll-entry-card.editing-row {
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, .08);
      }
      .payroll-entry-main {
        min-width: 0;
      }
      .payroll-entry-main b,
      .payroll-entry-cell b {
        display: block;
        color: #0f172a;
        font-size: 13px;
        line-height: 1.15;
        overflow-wrap: anywhere;
      }
      .payroll-entry-main small,
      .payroll-entry-cell span {
        display: block;
        color: #64748b;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .04em;
        text-transform: uppercase;
        margin-bottom: 3px;
      }
      .payroll-entry-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 6px;
      }
      .payroll-entry-cell {
        min-width: 0;
        border-left: 1px solid #eef2f7;
        padding-left: 8px;
      }
      .payroll-entry-actions {
        display: flex;
        flex-direction: row;
        gap: 8px;
        justify-content: flex-end;
        align-items: center;
        min-width: 145px;
        border-left: 1px solid #eef2f7;
        padding-left: 10px;
      }
      .payroll-entry-actions button,
      .payroll-entry-actions .delete-link,
      .payroll-entry-actions .save-link {
        width: auto;
        min-width: 62px;
        min-height: 32px;
        height: 32px;
        padding: 0 12px;
        font-size: 12px;
        border-radius: 8px;
      }
      .payroll-entry-card .inline-edit-input {
        width: 100%;
        min-width: 0;
        height: 32px;
        padding: 6px 8px;
        font-size: 12px;
      }
      .payroll-entry-card .inline-edit-input.reason {
        min-width: 0;
      }
      @media (max-width: 1380px) {
        .payroll-entry-card {
          grid-template-columns: minmax(135px, 1fr) minmax(130px, .95fr) 68px 68px 82px 82px 82px minmax(115px, .9fr) 82px 138px;
          gap: 0;
          padding: 9px;
        }
        .payroll-entry-cell { padding-left: 7px; }
        .payroll-entry-main b, .payroll-entry-cell b { font-size: 12px; }
        .payroll-entry-actions { min-width: 132px; }
      }
      @media (max-width: 1120px) {
        .payroll-entry-card {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .payroll-entry-cell {
          border-left: 0;
          border-top: 1px solid #eef2f7;
          padding-left: 0;
          padding-top: 8px;
        }
        .payroll-entry-actions {
          grid-column: 1 / -1;
          flex-direction: row;
        }
      }
      .payroll-entries-fit-table th,
      .payroll-entries-fit-table td {
        padding: 6px 5px;
        vertical-align: middle;
        line-height: 1.2;
      }
      .payroll-entries-fit-table th {
        white-space: nowrap;
        font-size: 11px;
        letter-spacing: .04em;
      }
      .payroll-entries-fit-table .date-cell,
      .payroll-entries-fit-table .money-cell,
      .payroll-entries-fit-table .total-cell {
        white-space: nowrap;
        word-break: keep-all;
        overflow-wrap: normal;
      }
      .payroll-entries-fit-table .date-cell {
        font-size: 12px;
      }
      .payroll-entries-fit-table .total-cell {
        font-weight: 800;
      }
      .payroll-entries-fit-table .employee-name-cell,
      .payroll-entries-fit-table .source-cell {
        white-space: normal;
        word-break: normal;
        overflow-wrap: anywhere;
      }
      .payroll-entries-fit-table .tag {
        white-space: nowrap;
        padding: 4px 8px;
        font-size: 11px;
      }
      .payroll-entries-fit-table .row-actions {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .payroll-entries-fit-table .row-actions button {
        padding: 7px 10px;
        min-width: 0;
      }
      .toast-import-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .toast-import-row .group-payroll-date-label {
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
      }
      .toast-import-row input[type="date"] {
        min-width: 150px;
      }
    `}</style>

    <div className="page-head employee-head">
      <div><h1>Payroll</h1><p>Persistent payroll groups, editable members, one-click group payroll, and Toast Labor CSV/XLSX import.</p></div>
      <div className="employee-head-actions"><div className="date-pill"><Icon name="calendar" /> <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div></div>
    </div>
    <div className="status-pill">{status}</div>

    <div className="page-filter-shell payroll-filter-shell">
      <DateControls start={dateStart} end={dateEnd} onStartChange={updateDateStart} onEndChange={updateDateEnd} onApply={() => { saveGlobalDateRange(dateStart, dateEnd); setStatus(`Applied payroll date range: ${rangeLabel}${activeFilterLabel}`) }} onPreset={applyPreset} />
      <label className="search-box payroll-employee-search emphasized-search">
        <span>Employee / Check Search</span>
        <input value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} placeholder="Search employee, group, method, check #" />
      </label>
      <div className="filter-dropdown-group payroll-dropdown-filters"><label>Payment<select value={payMethodFilter} onChange={e => setPayMethodFilter(e.target.value)}><option value="all">All methods</option><option value="cash">Cash</option><option value="check">Check</option></select></label><label>Class<select value={payClassFilter} onChange={e => setPayClassFilter(e.target.value)}><option value="all">All classes</option><option value="operating">Operating labor</option><option value="tips">Customer tips</option></select></label></div>
      {(employeeSearch || payMethodFilter !== 'all' || payClassFilter !== 'all') && <button type="button" className="btn ghost clear-filter-btn" onClick={() => { setEmployeeSearch(''); setPayMethodFilter('all'); setPayClassFilter('all') }}>Clear Filters</button>}
      <span className="filter-note">Showing {filteredEntries.length} payroll rows • {rangeLabel}{activeFilterLabel}</span>
    </div>

    <div className="payroll-summary-row">
      <div><span>Operating Payroll</span><b>${money(totals.operating)}</b><small>Counts in profit</small></div><div><span>Server Tips</span><b>${money(totals.customerTips)}</b><small>Separate from payroll cost</small></div><div><span>Cash Paid</span><b>${money(totals.cash)}</b></div><div><span>Check Paid</span><b>${money(totals.check)}</b></div><div><span>Tips Withheld</span><b>${money(totals.withheld)}</b></div>
    </div>

    <div className="payroll-grid clean-payroll-grid">
      <section className="form-card payroll-card tight-card">
        <h2>Payroll Groups</h2>
        <div className="payroll-row"><input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name or rename" /><select value={groupPayrollType} onChange={e => setGroupPayrollType(e.target.value)}><option>Cash</option><option>Check</option></select></div>
        <div className="payroll-row"><input value={groupNotes} onChange={e => setGroupNotes(e.target.value)} placeholder="Group notes optional" /><button className="btn primary" onClick={createGroup} type="button">Create</button><button className="btn secondary" onClick={renameSelectedGroup} type="button">Rename</button><button className="btn danger" onClick={deleteGroup} type="button">Delete</button></div>
        <div className="payroll-row group-select-row"><select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>{groups.map(group => <option key={group.id} value={group.id}>{group.name} - {group.payroll_type}</option>)}</select></div>
        <div className="payroll-row"><select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} disabled={!availableEmployees.length}>{availableEmployees.length ? availableEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} - {emp.job_type}</option>) : <option value="">All active employees are already in this group</option>}</select><button className="btn secondary" onClick={addEmployeeToGroup} disabled={!selectedGroup || !selectedEmployeeId || !availableEmployees.length} type="button">Add To Group</button></div>
      </section>

      <section className="table-card payroll-members compact-table-card group-editor-card">
        <header><h2>{selectedGroup?.name || 'No Group Selected'}</h2><span>{groupMembers.length} members</span></header>
        {selectedGroup ? <>
          <div className="group-editor-summary">
            <span><b>Method:</b> {selectedGroup.payroll_type || 'Cash'}</span>
            <span><b>Notes:</b> {selectedGroup.notes || 'No notes'}</span>
          </div>
          <table><thead><tr><th>Name</th><th>Job</th><th>Pay</th><th>Base</th><th>Action</th></tr></thead><tbody>{groupMembers.length ? groupMembers.map(emp => <tr key={emp.id}><td><b>{emp.name}</b><small>{emp.payroll_type}</small></td><td>{emp.job_type}</td><td><span className={`tag ${String(emp.pay_type).toLowerCase()}`}>{emp.pay_type}</span></td><td>${money(emp.base_pay)}</td><td><button className="delete-link" type="button" onClick={() => removeFromGroup(emp.id)}>Delete</button></td></tr>) : <tr><td colSpan="5" className="empty-cell">No employees in this group yet. Add employees from the selector on the left.</td></tr>}</tbody></table>
          <div className="group-payroll-action-row">
            <label className="group-payroll-date-label">Payroll date <input type="date" value={groupPayDate} onChange={e => setGroupPayDate(e.target.value)} /></label>
            <button className="btn primary" onClick={addGroupPayroll} type="button"><Icon name="plus" /> Add Group To Payroll</button>
            <span>Creates payroll rows for the selected group using the selected payroll date.</span>
          </div>
        </> : <div className="empty-cell">Create or select a payroll group to manage members.</div>}
      </section>
    </div>

    <section className="form-card tight-card manual-payroll-card">
      <h2>Manual Payroll Entry</h2>
      <div className="employee-form-grid clean-grid manual-payroll-grid">
        <label>Employee
          <select value={manualForm.employee_id} onChange={e => updateManualForm('employee_id', e.target.value)}>
            <option value="">Manual / Select employee</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} - {emp.pay_type}</option>)}
          </select>
        </label>
        <label>Manual name
          <input value={manualForm.employee_name} onChange={e => updateManualForm('employee_name', e.target.value)} placeholder="Employee name" />
        </label>
        <label>Payroll date
          <input type="date" value={manualForm.pay_date} onChange={e => updateManualForm('pay_date', e.target.value)} />
        </label>
        <label>Method
          <select value={manualForm.payroll_type} onChange={e => updateManualForm('payroll_type', e.target.value)}><option>Cash</option><option>Check</option></select>
        </label>
        <label>Check # / Ref
          <input value={manualForm.check_number} onChange={e => updateManualForm('check_number', e.target.value)} placeholder="Check number" />
        </label>
        <label>Pay type
          <select value={manualForm.pay_type} onChange={e => updateManualForm('pay_type', e.target.value)}><option>Hourly</option><option>Salary</option><option>Tips</option></select>
        </label>
        <label>Payroll classification
          <select value={manualForm.payroll_classification} onChange={e => updateManualForm('payroll_classification', e.target.value)}><option>Operating Labor</option><option>Customer Tips</option></select>
        </label>
        <label>Hours
          <input type="number" step="0.01" value={manualForm.hours} onChange={e => updateManualForm('hours', e.target.value)} placeholder="0.00" />
        </label>
        <label>Regular pay
          <input type="number" step="0.01" value={manualForm.regular_pay} onChange={e => updateManualForm('regular_pay', e.target.value)} onBlur={e => updateManualForm('regular_pay', money(e.target.value))} placeholder="0.00" />
        </label>
        <label>Tips after withheld
          <input type="number" step="0.01" value={manualForm.tips} onChange={e => updateManualForm('tips', e.target.value)} onBlur={e => updateManualForm('tips', money(e.target.value))} placeholder="0.00" />
        </label>
        <label>Tips withheld
          <input type="number" step="0.01" value={manualForm.tip_deduction} onChange={e => updateManualForm('tip_deduction', e.target.value)} onBlur={e => updateManualForm('tip_deduction', money(e.target.value))} placeholder="0.00" />
        </label>
        <label>Extra pay
          <input type="number" step="0.01" value={manualForm.extra_pay} onChange={e => updateManualForm('extra_pay', e.target.value)} onBlur={e => updateManualForm('extra_pay', money(e.target.value))} placeholder="0.00" />
        </label>
        <label className="wide-2">Extra reason
          <input value={manualForm.extra_reason} onChange={e => updateManualForm('extra_reason', e.target.value)} placeholder="Reason for extra work/pay" />
        </label>
        <div className="form-actions-inline">
          <button className="btn secondary" onClick={clearManualForm} type="button">Clear</button>
          <button className="btn primary" onClick={addManualPayroll} type="button"><Icon name="plus" /> Add Payroll</button>
        </div>
      </div>
    </section>

    <section className="form-card tight-card import-card">
      <h2>Toast Labor Summary Import</h2>
      <div className="import-row toast-import-row">
        <label className="group-payroll-date-label">Toast payroll date <input type="date" value={toastPayDate} onChange={e => setToastPayDate(e.target.value)} /></label>
        <label className="file-button"><Icon name="upload" /> Upload CSV/XLSX<input type="file" accept=".csv,.xlsx,.xls" onChange={handleLaborFile} /></label>
        <span>Extracts employees, hours, tips, gross pay, uses Toast Tips Withheld when present, otherwise applies {tipRate}% withholding, then matches employees to your project employee list and lets you choose a project employee type before saving.</span>
      </div>
    </section>

    {previewRows.length > 0 && <section className="table-card compact-table-card import-preview-card">
      <header><h2>Import Preview</h2><span>{previewRows.length} rows <button className="btn primary small-btn" onClick={savePreviewToPayroll} type="button">Add To Payroll</button></span></header>
      <table className="import-preview-table"><thead><tr><th>Employee</th><th>Employee Type</th><th>Payroll Class</th><th>Assignment Source</th><th>Check #</th><th>Hours</th><th>Regular</th><th>Tips After Withheld</th><th>Tips Withheld</th><th>Extra</th><th>Reason</th><th>Total</th><th></th></tr></thead><tbody>{previewRows.map(row => <tr key={row.id}>
        <td><select value={row.employee_id} onChange={e => updatePreview(row.id, 'employee_id', e.target.value)}><option value="">{row.employee_name || 'New / unmatched employee'}</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></td>
        <td><select value={row.employee_type || 'Regular'} onChange={e => updatePreview(row.id, 'employee_type', e.target.value)}>{employeeTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}</select></td>
        <td><span className={row.is_new_employee ? 'tag seasonal' : 'tag regular'}>{row.is_new_employee ? 'Add to Employee List' : row.assignment_label}</span></td>
        <td><input className="data-input check-number-input" value={row.check_number || ''} onChange={e => updatePreview(row.id, 'check_number', e.target.value)} placeholder="Check #" /></td>
        <td><input className="data-input hours-input" type="number" step="0.01" value={row.hours} onChange={e => updatePreview(row.id, 'hours', e.target.value)} onBlur={e => updatePreview(row.id, 'hours', money(e.target.value))} /></td><td><input className="data-input money-input" type="number" step="0.01" value={row.regular_pay} onChange={e => updatePreview(row.id, 'regular_pay', e.target.value)} onBlur={e => updatePreview(row.id, 'regular_pay', money(e.target.value))} /></td><td><input className="data-input tips-input" type="number" step="0.01" value={row.tips} onChange={e => updatePreview(row.id, 'tips', e.target.value)} onBlur={e => updatePreview(row.id, 'tips', money(e.target.value))} /></td><td><input className="data-input money-input" type="number" step="0.01" value={row.tip_deduction} onChange={e => updatePreview(row.id, 'tip_deduction', e.target.value)} onBlur={e => updatePreview(row.id, 'tip_deduction', money(e.target.value))} /></td><td><input className="data-input extra-input" type="number" step="0.01" value={row.extra_pay} onChange={e => updatePreview(row.id, 'extra_pay', e.target.value)} onBlur={e => updatePreview(row.id, 'extra_pay', money(e.target.value))} /></td><td><input className="data-input reason-input" value={row.extra_reason} onChange={e => updatePreview(row.id, 'extra_reason', e.target.value)} placeholder="Optional" /></td><td><b>${money(row.total_pay)}</b></td><td><button className="delete-link" type="button" onClick={() => setPreviewRows(prev => prev.filter(item => item.id !== row.id))}>Remove</button></td>
      </tr>)}</tbody></table>
    </section>}

    <section className="table-card payroll-table-card compact-table-card">
      <header><h2>Payroll Entries</h2><span>{filteredEntries.length} rows • Total ${money(totals.total)} • {rangeLabel}{activeFilterLabel}</span></header>
      <div className="payroll-entries-list">
        {filteredEntries.length ? filteredEntries.map(entry => {
          const isEditing = editingEntryId === entry.id
          const editTotal = money(num(entryForm.regular_pay) + num(entryForm.tips) - num(entryForm.tip_deduction) + num(entryForm.extra_pay))
          return <article key={entry.id} className={`payroll-entry-card ${isEditing ? 'editing-row' : ''}`}>
            <div className="payroll-entry-main">
              <span>Employee / Date</span>
              <b>{entry.employee_name}</b>
              {isEditing ? <input className="inline-edit-input date" type="date" value={entryForm.pay_date} onChange={e => setEntryForm(prev => ({ ...prev, pay_date: e.target.value }))} /> : <small>{entry.pay_date || '-'}</small>}
              <div className="payroll-entry-tags"><span className={`tag ${String(entry.pay_type).toLowerCase()}`}>{entry.pay_type}</span><span className={entry.payroll_type === 'Cash' ? 'tag cash' : 'tag check'}>{entry.payroll_type}</span><span className={String(entry.payroll_classification || inferPayrollClassification(entry)).includes('Tip') ? 'tag orange' : 'tag teal'}>{entry.payroll_classification || inferPayrollClassification(entry)}</span></div>
            </div>
            <div className="payroll-entry-cell"><span>Source</span><b>{entry.group_name || '-'}</b></div>
            <div className="payroll-entry-cell"><span>Class</span>{isEditing ? <select className="inline-edit-input" value={entryForm.payroll_classification || 'Operating Labor'} onChange={e => setEntryForm(prev => ({ ...prev, payroll_classification: e.target.value }))}><option>Operating Labor</option><option>Customer Tips</option></select> : <b>{entry.payroll_classification || inferPayrollClassification(entry)}</b>}</div>
            <div className="payroll-entry-cell"><span>Check #</span>{isEditing ? <input className="inline-edit-input short" value={entryForm.check_number || ''} onChange={e => setEntryForm(prev => ({ ...prev, check_number: e.target.value }))} placeholder="Check #" /> : <b>{entry.check_number || '-'}</b>}</div>
            <div className="payroll-entry-cell"><span>Hours</span>{isEditing ? <input className="inline-edit-input short" type="number" step="0.01" value={entryForm.hours} onChange={e => setEntryForm(prev => ({ ...prev, hours: e.target.value }))} /> : <b>{money(entry.hours)}</b>}</div>
            <div className="payroll-entry-cell"><span>Regular</span>{isEditing ? <input className="inline-edit-input" type="number" step="0.01" value={entryForm.regular_pay} onChange={e => setEntryForm(prev => ({ ...prev, regular_pay: e.target.value }))} /> : <b>${money(entry.regular_pay)}</b>}</div>
            <div className="payroll-entry-cell"><span>Net Tips</span>{isEditing ? <input className="inline-edit-input" type="number" step="0.01" value={entryForm.tips} onChange={e => setEntryForm(prev => ({ ...prev, tips: e.target.value }))} /> : <b>${money(entry.tips)}</b>}</div>
            <div className="payroll-entry-cell"><span>Withheld</span>{isEditing ? <input className="inline-edit-input" type="number" step="0.01" value={entryForm.tip_deduction} onChange={e => setEntryForm(prev => ({ ...prev, tip_deduction: e.target.value }))} /> : <b>${money(entry.tip_deduction)}</b>}</div>
            <div className="payroll-entry-cell"><span>Extra / Reason</span>{isEditing ? <><input className="inline-edit-input" type="number" step="0.01" value={entryForm.extra_pay} onChange={e => setEntryForm(prev => ({ ...prev, extra_pay: e.target.value }))} /><input className="inline-edit-input reason" value={entryForm.extra_reason} onChange={e => setEntryForm(prev => ({ ...prev, extra_reason: e.target.value }))} placeholder="Reason" /></> : <b>${money(entry.extra_pay)} {entry.extra_reason ? `• ${entry.extra_reason}` : ''}</b>}</div>
            <div className="payroll-entry-cell"><span>Total</span><b>${isEditing ? editTotal : money(entry.total_pay)}</b></div>
            <div className="payroll-entry-actions">{isEditing ? <><button className="save-link" onClick={saveEntryEdit} type="button">Save</button><button type="button" onClick={() => setEditingEntryId(null)}>Cancel</button></> : <><button type="button" onClick={() => startEdit(entry)}>Edit</button><button className="delete-link" type="button" onClick={() => deleteEntry(entry.id)}>Delete</button></>}</div>
          </article>
        }) : <div className="empty-cell">No payroll entries in the selected date range.</div>}
      </div>
    </section>
  </>
}
