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
  const [activeTab, setActiveTab] = useState('all')
  const [selectedEntryIds, setSelectedEntryIds] = useState([])
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

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
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const pagedEntries = filteredEntries.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const allVisibleSelected = pagedEntries.length > 0 && pagedEntries.every(entry => selectedEntryIds.includes(entry.id))
  const activeFilterLabel = employeeSearch.trim() ? ` • Employee/search: ${employeeSearch.trim()}` : ''


  useEffect(() => { setPage(1) }, [dateStart, dateEnd, employeeSearch, payMethodFilter, payClassFilter, rowsPerPage])

  function toggleEntrySelection(id) {
    setSelectedEntryIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  function toggleVisibleSelection() {
    const ids = pagedEntries.map(entry => entry.id)
    setSelectedEntryIds(prev => allVisibleSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])))
  }

  function deleteSelectedEntries() {
    if (!selectedEntryIds.length) return
    if (!window.confirm(`Delete ${selectedEntryIds.length} selected payroll entries? This cannot be undone.`)) return
    setData(prev => ({ ...prev, payrollEntries: (prev.payrollEntries || []).filter(entry => !selectedEntryIds.includes(entry.id)) }))
    setStatus(`Deleted ${selectedEntryIds.length} payroll entries`)
    setSelectedEntryIds([])
  }

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
      .payroll-enterprise { display:grid; gap:16px; }
      .payroll-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
      .payroll-toolbar .date-range-box { min-width:330px; border:1px solid #dbe3ef; border-radius:12px; background:#fff; padding:10px 14px; }
      .payroll-toolbar-actions { margin-left:auto; display:flex; gap:10px; flex-wrap:wrap; }
      .payroll-kpis { display:grid; grid-template-columns:repeat(6,minmax(150px,1fr)); gap:12px; }
      .payroll-kpi { border:1px solid #e3e9f2; border-radius:14px; background:#fff; padding:16px; display:flex; gap:12px; align-items:center; min-height:98px; }
      .payroll-kpi-icon { width:46px; height:46px; border-radius:12px; display:grid; place-items:center; flex:0 0 46px; }
      .payroll-kpi:nth-child(1) .payroll-kpi-icon { background:#e7efff; color:#2563eb; }
      .payroll-kpi:nth-child(2) .payroll-kpi-icon { background:#e8f7eb; color:#16863c; }
      .payroll-kpi:nth-child(3) .payroll-kpi-icon { background:#f2e9ff; color:#7c3aed; }
      .payroll-kpi:nth-child(4) .payroll-kpi-icon { background:#fff1dd; color:#ea8a00; }
      .payroll-kpi:nth-child(5) .payroll-kpi-icon { background:#e2f7fb; color:#0891b2; }
      .payroll-kpi:nth-child(6) .payroll-kpi-icon { background:#eaf7e7; color:#3b9b2e; }
      .payroll-kpi span { color:#64748b; font-size:12px; font-weight:700; }
      .payroll-kpi b { display:block; font-size:24px; color:#0f172a; line-height:1.15; margin:3px 0; }
      .payroll-kpi small { color:#64748b; }
      .payroll-tabs { display:flex; gap:24px; border-bottom:1px solid #e2e8f0; padding:0 8px; }
      .payroll-tabs button { border:0; background:transparent; padding:12px 8px; font-weight:800; color:#334155; border-bottom:3px solid transparent; }
      .payroll-tabs button.active { color:#ea7000; border-bottom-color:#ea7000; }
      .payroll-content-grid { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:14px; align-items:start; }
      .payroll-main-panel, .payroll-side-panel { border:1px solid #e0e7f0; border-radius:14px; background:#fff; }
      .payroll-filter-row { display:grid; grid-template-columns:minmax(260px,1.35fr) repeat(4,minmax(145px,.8fr)) auto auto; gap:10px; padding:14px; align-items:end; }
      .payroll-search { background:#fffaf0; border:1px solid #efc56b; border-radius:10px; display:flex; align-items:center; gap:9px; padding:0 12px; height:48px; }
      .payroll-search input { border:0; background:transparent; width:100%; outline:0; height:100%; }
      .payroll-filter-row label { display:grid; gap:4px; color:#64748b; font-size:11px; font-weight:800; }
      .payroll-filter-row select { height:48px; border:1px solid #dbe3ef; border-radius:10px; background:#f7faff; padding:0 12px; font-weight:700; }
      .payroll-bulk-row { display:flex; gap:10px; align-items:center; padding:10px 14px; border-top:1px solid #eef2f7; border-bottom:1px solid #eef2f7; }
      .payroll-bulk-row .sort-control { margin-left:auto; display:flex; gap:8px; align-items:center; }
      .payroll-table-wrap { overflow:auto; }
      .payroll-enterprise-table { width:100%; min-width:1100px; border-collapse:collapse; font-size:12px; }
      .payroll-enterprise-table th { color:#334155; font-size:11px; text-transform:uppercase; letter-spacing:.03em; padding:11px 10px; text-align:left; background:#fbfcfe; border-bottom:1px solid #e5ebf3; white-space:nowrap; }
      .payroll-enterprise-table td { padding:11px 10px; border-bottom:1px solid #edf1f6; color:#172033; white-space:nowrap; }
      .payroll-enterprise-table td.employee-cell { font-weight:800; }
      .payroll-enterprise-table .money-strong { font-weight:900; }
      .payroll-mini-actions { display:flex; gap:6px; }
      .payroll-mini-actions button { border:0; background:transparent; padding:3px; color:#2563eb; }
      .payroll-mini-actions button.delete { color:#ef4444; }
      .payroll-pagination { display:flex; align-items:center; gap:8px; padding:12px 14px; }
      .payroll-pagination .pages { margin:auto; display:flex; gap:6px; }
      .payroll-pagination button { min-width:34px; height:32px; border:1px solid #dbe3ef; border-radius:8px; background:#fff; }
      .payroll-pagination button.active { background:#ea7000; color:#fff; border-color:#ea7000; }
      .payroll-side-panel header { display:flex; justify-content:space-between; align-items:center; padding:14px; border-bottom:1px solid #e7edf4; }
      .group-accordion { border-bottom:1px solid #edf1f6; }
      .group-accordion > button { width:100%; display:flex; justify-content:space-between; border:0; background:#fff; padding:14px; font-weight:900; }
      .group-detail { padding:0 14px 14px; }
      .group-detail table { width:100%; border-collapse:collapse; font-size:11px; }
      .group-detail th,.group-detail td { padding:7px 4px; border-bottom:1px solid #eef2f7; text-align:left; }
      .group-tools { display:flex; gap:8px; margin-top:10px; }
      .tab-panel { padding:16px; }
      @media (max-width:1450px){ .payroll-kpis{grid-template-columns:repeat(3,1fr)} .payroll-content-grid{grid-template-columns:1fr} .payroll-side-panel{order:2} }
      @media (max-width:900px){ .payroll-kpis{grid-template-columns:repeat(2,1fr)} .payroll-filter-row{grid-template-columns:1fr 1fr} .payroll-search{grid-column:1/-1} }
    `}</style>

    <div className="payroll-enterprise">
      <div className="page-head employee-head">
        <div><h1>Payroll</h1><p>Manage payroll groups, manual payroll, tips and history</p></div>
      </div>
      <div className="status-pill">{status}</div>

      <div className="payroll-toolbar">
        <div className="date-range-box"><DateControls start={dateStart} end={dateEnd} onStartChange={updateDateStart} onEndChange={updateDateEnd} onApply={() => { saveGlobalDateRange(dateStart, dateEnd); setStatus(`Applied payroll date range: ${rangeLabel}`) }} onPreset={applyPreset} /></div>
        <button className="btn secondary" onClick={() => applyPreset('today')}>Today</button>
        <button className="btn secondary" onClick={() => applyPreset('lastWeek')}>Last 7 Days</button>
        <button className="btn primary" onClick={() => applyPreset('thisMonth')}>This Month</button>
        <button className="btn secondary" onClick={() => applyPreset('lastMonth')}>Last Month</button>
        <div className="payroll-toolbar-actions">
          <button className="btn primary" onClick={() => setActiveTab('manual')}><Icon name="plus" /> Add Manual Payroll</button>
          <label className="file-button"><Icon name="upload" /> Import Labor Summary<input type="file" accept=".csv,.xlsx,.xls" onChange={handleLaborFile} /></label>
        </div>
      </div>

      <div className="payroll-kpis">
        <div className="payroll-kpi"><div className="payroll-kpi-icon"><Icon name="users" /></div><div><span>Total Payroll Cost</span><b>${money(totals.total)}</b><small>{new Set(filteredEntries.map(e=>e.employee_name)).size} Employees</small></div></div>
        <div className="payroll-kpi"><div className="payroll-kpi-icon"><Icon name="dollar" /></div><div><span>Regular Pay</span><b>${money(filteredEntries.reduce((s,e)=>s+num(e.regular_pay),0))}</b><small>{money(filteredEntries.reduce((s,e)=>s+num(e.hours),0))} Hours</small></div></div>
        <div className="payroll-kpi"><div className="payroll-kpi-icon"><Icon name="bag" /></div><div><span>Tips After Withholding</span><b>${money(totals.customerTips)}</b><small>Withheld: ${money(totals.withheld)}</small></div></div>
        <div className="payroll-kpi"><div className="payroll-kpi-icon"><Icon name="person" /></div><div><span>Extra Pay</span><b>${money(filteredEntries.reduce((s,e)=>s+num(e.extra_pay),0))}</b><small>{filteredEntries.filter(e=>num(e.extra_pay)>0).length} Entries</small></div></div>
        <div className="payroll-kpi"><div className="payroll-kpi-icon"><Icon name="card" /></div><div><span>Checks Issued</span><b>${money(totals.check)}</b><small>{filteredEntries.filter(e=>e.payroll_type==='Check').length} Payments</small></div></div>
        <div className="payroll-kpi"><div className="payroll-kpi-icon"><Icon name="dollar" /></div><div><span>Cash Payments</span><b>${money(totals.cash)}</b><small>{filteredEntries.filter(e=>e.payroll_type==='Cash').length} Payments</small></div></div>
      </div>

      <div className="payroll-tabs">
        {[['all','All Payroll'],['groups','Payroll Groups'],['manual','Manual Payroll'],['tips','Tips Summary'],['history','History']].map(([id,label])=><button key={id} className={activeTab===id?'active':''} onClick={()=>setActiveTab(id)}>{label}</button>)}
      </div>

      {activeTab === 'all' && <div className="payroll-content-grid">
        <section className="payroll-main-panel">
          <div className="payroll-filter-row">
            <label className="payroll-search"><Icon name="search" /><input value={employeeSearch} onChange={e=>setEmployeeSearch(e.target.value)} placeholder="Search employee, group, method, check #..." /></label>
            <label>Employee<select><option>All Employees</option></select></label>
            <label>Payroll Type<select value={payClassFilter} onChange={e=>setPayClassFilter(e.target.value)}><option value="all">All Types</option><option value="operating">Operating Labor</option><option value="tips">Customer Tips</option></select></label>
            <label>Payment Method<select value={payMethodFilter} onChange={e=>setPayMethodFilter(e.target.value)}><option value="all">All Methods</option><option value="cash">Cash</option><option value="check">Check</option></select></label>
            <label>Source<select><option>All Sources</option><option>Toast Labor</option><option>Manual</option></select></label>
            <button className="btn secondary" onClick={()=>{setEmployeeSearch('');setPayMethodFilter('all');setPayClassFilter('all')}}><Icon name="refresh" /> Clear Filters</button>
            <button className="btn secondary"><Icon name="download" /> Export</button>
          </div>
          <div className="payroll-bulk-row">
            <label><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} /> Select All ({filteredEntries.length})</label>
            <button className="btn secondary" disabled={!selectedEntryIds.length}>Archive Selected</button>
            <button className="btn danger" disabled={!selectedEntryIds.length} onClick={deleteSelectedEntries}>Delete Selected</button>
            <button className="btn secondary" disabled={!selectedEntryIds.length}><Icon name="download" /> Export Selected</button>
            <div className="sort-control"><span>Sort by:</span><select><option>Date (Newest)</option><option>Date (Oldest)</option></select></div>
          </div>
          <div className="payroll-table-wrap"><table className="payroll-enterprise-table"><thead><tr><th></th><th>Date</th><th>Employee</th><th>Group</th><th>Type</th><th>Hours</th><th>Regular Pay</th><th>Tips After WH</th><th>Extra Pay</th><th>Total Pay</th><th>Payment</th><th>Source</th><th>Check #</th><th>Actions</th></tr></thead><tbody>
            {pagedEntries.length ? pagedEntries.map(entry=><tr key={entry.id}><td><input type="checkbox" checked={selectedEntryIds.includes(entry.id)} onChange={()=>toggleEntrySelection(entry.id)} /></td><td>{entry.pay_date||'-'}</td><td className="employee-cell">{entry.employee_name}</td><td><span className="tag regular">{entry.group_name||'—'}</span></td><td><span className={`tag ${String(entry.pay_type||'').toLowerCase()}`}>{entry.pay_type||'—'}</span></td><td>{num(entry.hours)?money(entry.hours):'—'}</td><td>${money(entry.regular_pay)}</td><td>${money(entry.tips)}</td><td>${money(entry.extra_pay)}</td><td className="money-strong">${money(entry.total_pay)}</td><td><span className={entry.payroll_type==='Cash'?'tag cash':'tag check'}>{entry.payroll_type||'—'}</span></td><td>{entry.group_name?.startsWith('Toast:')?'Toast Labor':'Manual'}</td><td>{entry.check_number||'—'}</td><td><div className="payroll-mini-actions"><button onClick={()=>startEdit(entry)}>✎</button><button className="delete" onClick={()=>deleteEntry(entry.id)}>🗑</button></div></td></tr>) : <tr><td colSpan="14" className="empty-cell">No payroll entries in the selected date range.</td></tr>}
          </tbody></table></div>
          <div className="payroll-pagination"><span>Showing {filteredEntries.length ? (currentPage-1)*rowsPerPage+1 : 0} to {Math.min(currentPage*rowsPerPage,filteredEntries.length)} of {filteredEntries.length} entries</span><div className="pages"><button onClick={()=>setPage(Math.max(1,currentPage-1))}>‹</button>{Array.from({length:Math.min(totalPages,5)},(_,i)=>i+1).map(n=><button key={n} className={currentPage===n?'active':''} onClick={()=>setPage(n)}>{n}</button>)}<button onClick={()=>setPage(Math.min(totalPages,currentPage+1))}>›</button></div><label>Rows per page: <select value={rowsPerPage} onChange={e=>setRowsPerPage(Number(e.target.value))}><option>10</option><option>25</option><option>50</option></select></label></div>
        </section>
        <aside className="payroll-side-panel"><header><h3><Icon name="users" /> Payroll Groups</h3><button className="btn secondary small-btn" onClick={()=>setActiveTab('groups')}><Icon name="plus" /> Add Group</button></header>{groups.map(group=>{const members=employees.filter(emp=>(group.memberIds||[]).includes(emp.id)); const open=group.id===(selectedGroup?.id); return <div className="group-accordion" key={group.id}><button onClick={()=>setSelectedGroupId(group.id)}><span>{group.name}</span><small>{members.length} members⌄</small></button>{open&&<div className="group-detail"><p><b>Method:</b> {group.payroll_type||'Cash'} &nbsp; <b>Notes:</b> {group.notes||'No notes'}</p><table><thead><tr><th>Employee</th><th>Job</th><th>Pay Type</th></tr></thead><tbody>{members.map(emp=><tr key={emp.id}><td>{emp.name}</td><td>{emp.job_type}</td><td><span className={`tag ${String(emp.pay_type).toLowerCase()}`}>{emp.pay_type}</span></td></tr>)}</tbody></table><div className="group-tools"><button className="btn danger" onClick={deleteGroup}>Delete Group</button></div></div>}</div>})}</aside>
      </div>}

      {activeTab === 'groups' && <div className="tab-panel"><div className="payroll-grid clean-payroll-grid"><section className="form-card payroll-card tight-card"><h2>Payroll Groups</h2><div className="payroll-row"><input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Group name" /><select value={groupPayrollType} onChange={e=>setGroupPayrollType(e.target.value)}><option>Cash</option><option>Check</option></select></div><div className="payroll-row"><input value={groupNotes} onChange={e=>setGroupNotes(e.target.value)} placeholder="Group notes optional" /><button className="btn primary" onClick={createGroup}>Create</button><button className="btn secondary" onClick={renameSelectedGroup}>Rename</button></div><div className="payroll-row"><select value={selectedGroupId} onChange={e=>setSelectedGroupId(e.target.value)}>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select><select value={selectedEmployeeId} onChange={e=>setSelectedEmployeeId(e.target.value)}>{availableEmployees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}</select><button className="btn secondary" onClick={addEmployeeToGroup}>Add To Group</button></div></section><section className="table-card"><header><h2>{selectedGroup?.name||'Select Group'}</h2><span>{groupMembers.length} members</span></header><table><thead><tr><th>Name</th><th>Job</th><th>Pay</th><th>Action</th></tr></thead><tbody>{groupMembers.map(emp=><tr key={emp.id}><td>{emp.name}</td><td>{emp.job_type}</td><td>{emp.pay_type}</td><td><button className="delete-link" onClick={()=>removeFromGroup(emp.id)}>Delete</button></td></tr>)}</tbody></table></section></div></div>}

      {activeTab === 'manual' && <div className="tab-panel"><section className="form-card tight-card"><h2>Manual Payroll Entry</h2><div className="employee-form-grid clean-grid manual-payroll-grid"><label>Employee<select value={manualForm.employee_id} onChange={e=>updateManualForm('employee_id',e.target.value)}><option value="">Manual / Select employee</option>{employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></label><label>Manual name<input value={manualForm.employee_name} onChange={e=>updateManualForm('employee_name',e.target.value)} /></label><label>Payroll date<input type="date" value={manualForm.pay_date} onChange={e=>updateManualForm('pay_date',e.target.value)} /></label><label>Method<select value={manualForm.payroll_type} onChange={e=>updateManualForm('payroll_type',e.target.value)}><option>Cash</option><option>Check</option></select></label><label>Check #<input value={manualForm.check_number} onChange={e=>updateManualForm('check_number',e.target.value)} /></label><label>Hours<input type="number" value={manualForm.hours} onChange={e=>updateManualForm('hours',e.target.value)} /></label><label>Regular pay<input type="number" value={manualForm.regular_pay} onChange={e=>updateManualForm('regular_pay',e.target.value)} /></label><label>Tips after withheld<input type="number" value={manualForm.tips} onChange={e=>updateManualForm('tips',e.target.value)} /></label><label>Tips withheld<input type="number" value={manualForm.tip_deduction} onChange={e=>updateManualForm('tip_deduction',e.target.value)} /></label><label>Extra pay<input type="number" value={manualForm.extra_pay} onChange={e=>updateManualForm('extra_pay',e.target.value)} /></label><label>Extra reason<input value={manualForm.extra_reason} onChange={e=>updateManualForm('extra_reason',e.target.value)} /></label><div><button className="btn primary" onClick={addManualPayroll}><Icon name="plus" /> Add Payroll</button></div></div></section></div>}

      {activeTab === 'tips' && <div className="tab-panel"><section className="table-card"><header><h2>Tips Summary</h2><span>Customer tips are separate from operating payroll cost</span></header><table><thead><tr><th>Date</th><th>Employee</th><th>Tips After WH</th><th>Withheld</th><th>Total Tips</th></tr></thead><tbody>{filteredEntries.filter(e=>String(e.payroll_classification||inferPayrollClassification(e)).toLowerCase().includes('tip')).map(e=><tr key={e.id}><td>{e.pay_date}</td><td>{e.employee_name}</td><td>${money(e.tips)}</td><td>${money(e.tip_deduction)}</td><td>${money(num(e.tips)+num(e.tip_deduction))}</td></tr>)}</tbody></table></section></div>}

      {activeTab === 'history' && <div className="tab-panel"><section className="table-card"><header><h2>Payroll History</h2><span>{filteredEntries.length} records</span></header><div className="payroll-table-wrap"><table className="payroll-enterprise-table"><thead><tr><th>Date</th><th>Employee</th><th>Type</th><th>Total</th><th>Method</th><th>Check #</th></tr></thead><tbody>{filteredEntries.map(e=><tr key={e.id}><td>{e.pay_date}</td><td>{e.employee_name}</td><td>{e.pay_type}</td><td>${money(e.total_pay)}</td><td>{e.payroll_type}</td><td>{e.check_number||'—'}</td></tr>)}</tbody></table></div></section></div>}

      {previewRows.length>0 && <section className="table-card"><header><h2>Import Preview</h2><button className="btn primary" onClick={savePreviewToPayroll}>Add To Payroll</button></header><div className="payroll-table-wrap"><table className="payroll-enterprise-table"><thead><tr><th>Employee</th><th>Date</th><th>Hours</th><th>Regular</th><th>Tips</th><th>Withheld</th><th>Total</th></tr></thead><tbody>{previewRows.map(row=><tr key={row.id}><td>{row.employee_name}</td><td>{row.pay_date}</td><td>{row.hours}</td><td>${money(row.regular_pay)}</td><td>${money(row.tips)}</td><td>${money(row.tip_deduction)}</td><td>${money(row.total_pay)}</td></tr>)}</tbody></table></div></section>}
    </div>
  </>
}
