import React, { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { createId, sortByName } from '../lib/localStore'
import { parseToastLaborRows, laborImportDiagnostics, detectToastLaborPeriod } from '../engine/ToastLaborEngine'
import { isSupabaseReady, supabase } from '../lib/supabase'

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


function normalizeImportDate(value, fallback = today()) {
  if (!value) return fallback
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value).trim()
  if (!raw) return fallback
  const iso = raw.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)/)
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`
  const us = raw.match(/^([01]?\d)[-\/]([0-3]?\d)[-\/](\d{2}|\d{4})/)
  if (us) {
    const year = us[3].length === 2 ? `20${us[3]}` : us[3]
    return `${year}-${String(us[1]).padStart(2, '0')}-${String(us[2]).padStart(2, '0')}`
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10)
}

function importedRowDate(source = {}, fallback = today()) {
  const raw = source.raw && typeof source.raw === 'object' ? source.raw : source
  const candidate = source.pay_date || source.business_date || source.date || source.shift_date || source.clock_in_date || findValue(raw, [
    'Pay Date', 'Payroll Date', 'Business Date', 'Date', 'Shift Date', 'Clock In Date', 'Time Entry Date', 'Work Date'
  ])
  return normalizeImportDate(candidate, fallback)
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

function inferImportedPayType(employee, source = {}) {
  if (employee?.pay_type) return employee.pay_type
  const jobText = [source.job_type, source.employee_type, source.employee_name].map(value => String(value || '').toLowerCase()).join(' ')
  if (/manager|general manager|assistant manager|owner|salary/.test(jobText)) return /salary/.test(jobText) ? 'Salary' : 'Hourly'
  if (/server|waiter|waitress|bartender|front house|foh/.test(jobText)) return 'Tips'
  return 'Hourly'
}

function totalPayrollPay(row = {}) {
  const regular = num(row.regular_pay)
  const tips = num(row.tips)
  const deduction = num(row.tip_deduction)
  const extra = num(row.extra_pay)
  return regular + tips + extra
}

function employeeAssignmentLabel(employee, groups = []) {
  if (!employee) return 'Unmatched Import'
  const assignedGroups = groups.filter(group => (group.memberIds || []).includes(employee.id)).map(group => group.name).filter(Boolean)
  if (assignedGroups.length) return assignedGroups.join(', ')
  return employee.job_type || employee.employee_type || 'Employee List'
}

export default function Payroll({ data, setData, setActive }) {
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
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedEntryIds, setSelectedEntryIds] = useState([])
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [toastReviewRows, setToastReviewRows] = useState([])
  const [selectedToastIds, setSelectedToastIds] = useState([])
  const [toastReviewLoading, setToastReviewLoading] = useState(false)
  const [toastReviewError, setToastReviewError] = useState('')
  const [expandedEntryIds, setExpandedEntryIds] = useState([])

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
      if (employeeFilter !== 'all' && String(entry.employee_id || '') !== employeeFilter) return false
      const isToast = String(entry.group_name || '').startsWith('Toast:') || String(entry.source || '').toLowerCase().includes('toast')
      if (sourceFilter === 'toast' && !isToast) return false
      if (sourceFilter === 'manual' && isToast) return false
      if (query) {
        const searchable = [entry.employee_name, entry.employee_id, entry.group_name, entry.payroll_type, entry.pay_type, entry.check_number].join(' ').toLowerCase()
        if (!searchable.includes(query)) return false
      }
      return true
    }).sort((a, b) => {
      const aDate = String(a.pay_date || a.payroll_date || a.date || '')
      const bDate = String(b.pay_date || b.payroll_date || b.date || '')
      const dateCompare = sortOrder === 'oldest' ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate)
      return dateCompare || String(a.employee_name || '').localeCompare(String(b.employee_name || ''))
    })
  }, [entries, dateStart, dateEnd, employeeSearch, payMethodFilter, payClassFilter, employeeFilter, sourceFilter, sortOrder])
  const rangeLabel = `${dateStart || 'First record'} to ${dateEnd || 'Latest record'}`
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const pagedEntries = filteredEntries.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const allVisibleSelected = pagedEntries.length > 0 && pagedEntries.every(entry => selectedEntryIds.includes(entry.id))
  const activeFilterLabel = employeeSearch.trim() ? ` • Employee/search: ${employeeSearch.trim()}` : ''


  useEffect(() => { setPage(1) }, [dateStart, dateEnd, employeeSearch, payMethodFilter, payClassFilter, employeeFilter, sourceFilter, sortOrder, rowsPerPage])


  async function loadToastLaborReview() {
    if (!isSupabaseReady || !supabase) {
      setToastReviewError('Supabase is not configured in this browser.')
      return
    }
    setToastReviewLoading(true)
    setToastReviewError('')
    try {
      let query = supabase.from('toast_labor').select('*').order('business_date', { ascending: false }).order('employee_name', { ascending: true }).limit(1000)
      if (dateStart) query = query.gte('business_date', dateStart)
      if (dateEnd) query = query.lte('business_date', dateEnd)
      const { data: laborRows, error } = await query
      if (error) throw error
      const approvedToastIds = new Set((entries || []).map(row => String(row.source_toast_labor_id || '')).filter(Boolean))
      const review = (laborRows || []).filter(row => !approvedToastIds.has(String(row.id))).map(row => {
        const employee = employees.find(emp => nameMatches(emp.name, row.employee_name))
        const rawLabor = row.raw && typeof row.raw === 'object' ? row.raw : {}
        const rawOriginalTips = findValue(rawLabor, ['Total Tips', 'Tips', 'Non-Cash Tips', 'Declared Tips', 'Original Tips'])
        const rawWithheld = findValue(rawLabor, ['Tips Withheld', 'Tip Withheld', 'Withheld Tips', 'Tip Deduction'])
        const originalTips = round2(num(rawOriginalTips !== '' ? rawOriginalTips : row.tips))
        const withheld = round2(rawWithheld !== '' ? num(rawWithheld) : originalTips * (tipRate / 100))
        const netTips = round2(Math.max(0, originalTips - withheld))
        const regularPay = round2(num(row.regular_pay) + num(row.overtime_pay))
        return {
          ...row,
          employee_id: employee?.id || '',
          employee_name: employee?.name || displayToastName(row.employee_name),
          raw_employee_name: row.employee_name,
          hours: round2(num(row.regular_hours) + num(row.overtime_hours)),
          regular_pay: regularPay,
          original_tips: originalTips,
          tip_deduction: withheld,
          tips: netTips,
          extra_pay: 0,
          extra_reason: '',
          payroll_type: employee?.payroll_type || 'Check',
          pay_type: employee?.pay_type || (originalTips > 0 ? 'Tips' : 'Hourly'),
          payroll_classification: inferPayrollClassification(employee || { job_type: row.job_name, employee_name: row.employee_name, tips: originalTips }),
          check_number: employee?.default_check_number || '',
          total_pay: round2(regularPay + netTips),
          is_new_employee: !employee
        }
      })
      setToastReviewRows(review)
      setSelectedToastIds(review.map(row => row.id))
      setStatus(review.length ? `Loaded ${review.length} automatic Toast labor rows for review. Nothing is posted until you approve it.` : 'No unapproved Toast labor rows were found in this date range.')
    } catch (error) {
      setToastReviewError(error?.message || 'Unable to load Toast labor rows.')
      setStatus(`Toast labor review needs attention: ${error?.message || 'Unable to load rows.'}`)
    } finally {
      setToastReviewLoading(false)
    }
  }


  function updateToastReview(id, field, value) {
    setToastReviewRows(prev => prev.map(row => {
      if (row.id !== id) return row
      const next = { ...row, [field]: value }
      if (field === 'employee_id') {
        const employee = employees.find(emp => emp.id === value)
        if (employee) Object.assign(next, {
          employee_name: employee.name,
          payroll_type: employee.payroll_type || next.payroll_type,
          pay_type: employee.pay_type || next.pay_type,
          payroll_classification: inferPayrollClassification(employee),
          check_number: employee.default_check_number || next.check_number,
          is_new_employee: false
        })
      }
      const regular = round2(num(next.regular_pay))
      const netTips = round2(num(next.tips))
      const deduction = round2(num(next.tip_deduction))
      const extra = round2(num(next.extra_pay))
      return { ...next, original_tips: round2(netTips + deduction), total_pay: round2(regular + netTips + extra) }
    }))
  }

  function toggleToastSelection(id) {
    setSelectedToastIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  function approveToastRows() {
    const selectedRows = toastReviewRows.filter(row => selectedToastIds.includes(row.id))
    if (!selectedRows.length) return setStatus('Select at least one Toast payroll row to approve.')
    setData(prev => {
      const existingEmployees = prev.employees || []
      const newEmployees = []
      const payrollRows = selectedRows.map(row => {
        let employee = existingEmployees.find(emp => emp.id === row.employee_id)
        let employeeId = row.employee_id
        if (!employee) {
          employeeId = createId('emp')
          employee = {
            id: employeeId,
            name: row.employee_name || displayToastName(row.raw_employee_name),
            employee_type: normalizeType(row.job_name || 'Regular', employeeTypeOptions),
            job_type: row.job_name || 'Other',
            pay_type: row.pay_type || (num(row.original_tips) > 0 ? 'Tips' : 'Hourly'),
            payroll_type: row.payroll_type || 'Check',
            base_pay: 0,
            extra_pay: 0,
            extra_reason: '',
            is_active: true,
            created_from: 'toast_automatic_labor',
            payroll_classification: row.payroll_classification || inferPayrollClassification(row)
          }
          newEmployees.push(employee)
        }
        return {
          id: createId('pay'),
          source_toast_labor_id: row.id,
          source: 'Toast Automatic Labor',
          employee_id: employeeId,
          employee_name: employee.name,
          group_name: `Toast: ${row.job_name || 'Labor'}`,
          pay_date: row.business_date,
          pay_type: employee.pay_type || row.pay_type,
          payroll_type: row.payroll_type || employee.payroll_type || 'Check',
          payroll_classification: row.payroll_classification || inferPayrollClassification(employee),
          check_number: row.check_number || '',
          hours: num(row.hours),
          regular_pay: num(row.regular_pay),
          original_tips: num(row.original_tips),
          tips: num(row.tips),
          tip_deduction: num(row.tip_deduction),
          extra_pay: num(row.extra_pay),
          extra_reason: row.extra_reason || '',
          total_pay: num(row.total_pay),
          approved_at: new Date().toISOString(),
          approval_status: 'Approved'
        }
      })
      return {
        ...prev,
        employees: sortByName([...existingEmployees, ...newEmployees]),
        payrollEntries: [...payrollRows, ...(prev.payrollEntries || [])],
        payrollImports: [{ id: createId('toast-auto-import'), file_name: 'Toast automatic labor', row_count: payrollRows.length, created_at: new Date().toISOString() }, ...(prev.payrollImports || [])]
      }
    })
    const approvedIds = new Set(selectedRows.map(row => row.id))
    setToastReviewRows(prev => prev.filter(row => !approvedIds.has(row.id)))
    setSelectedToastIds([])
    setStatus(`Approved ${selectedRows.length} Toast labor rows. Payroll and tips are now posted to RESTAPAY.`)
  }

  function toggleEntrySelection(id) {
    setSelectedEntryIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  function toggleTabSelection(entries) {
    const ids = entries.map(entry => entry.id)
    const allSelected = ids.length > 0 && ids.every(id => selectedEntryIds.includes(id))
    setSelectedEntryIds(prev => allSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])))
  }

  function toggleVisibleSelection() {
    const ids = pagedEntries.map(entry => entry.id)
    setSelectedEntryIds(prev => allVisibleSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])))
  }

  function exportSelectedEntries() {
    const rows = (data.payrollEntries || []).filter(entry => selectedEntryIds.includes(entry.id))
    if (!rows.length) {
      setStatus('Select at least one payroll entry to export.')
      return
    }

    const headers = [
      'Pay Date', 'Employee', 'Group', 'Payroll Type', 'Payment Method', 'Hours',
      'Regular Pay', 'Overtime Pay', 'Original Tips', 'Tips Withheld',
      'Tips After Withholding', 'Extra Pay', 'Extra Reason', 'Final Check', 'Check Number'
    ]
    const csvEscape = value => `"${String(value ?? '').replace(/"/g, '""')}"`
    const csvRows = rows.map(entry => [
      entry.pay_date || '',
      entry.employee_name || '',
      entry.group_name || '',
      entry.payroll_classification || inferPayrollClassification(entry),
      entry.payroll_type || '',
      num(entry.hours).toFixed(2),
      num(entry.regular_pay).toFixed(2),
      num(entry.overtime_pay).toFixed(2),
      (num(entry.tips) + num(entry.tip_deduction)).toFixed(2),
      num(entry.tip_deduction).toFixed(2),
      num(entry.tips).toFixed(2),
      num(entry.extra_pay).toFixed(2),
      entry.extra_reason || '',
      num(entry.total_pay).toFixed(2),
      entry.check_number || ''
    ])

    const csv = [headers, ...csvRows].map(row => row.map(csvEscape).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payroll-selected-${startDate || 'start'}-to-${endDate || 'end'}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setStatus(`Exported ${rows.length} selected payroll entries.`)
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
      tip_deduction: deduction, extra_pay: extraPay, extra_reason: source.extra_reason || employee.extra_reason || '', total_pay: regularPay + tips + extraPay
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
      return { ...entry, pay_date: entryForm.pay_date || entry.pay_date || today(), check_number: entryForm.check_number?.trim() || '', payroll_classification: entryForm.payroll_classification || inferPayrollClassification(entry), hours: num(entryForm.hours), regular_pay: regularPay, tips, tip_deduction: deduction, extra_pay: extraPay, extra_reason: entryForm.extra_reason.trim(), total_pay: regularPay + tips + extraPay }
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
      const reportPeriod = detectToastLaborPeriod(XLSX, workbook)
      const laborRows = parseToastLaborRows(XLSX, workbook, { payDate: toastPayDate, tipRate, reportPeriod, fileName: file.name })
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
          pay_type: inferImportedPayType(employee, { ...source, employee_name: cleanName || rawName }),
          payroll_classification: inferPayrollClassification(employee || { pay_type: inferImportedPayType(null, source), job_type: source.job_type, employee_name: cleanName || rawName }),
          pay_date: importedRowDate(source, reportPeriod.end || toastPayDate),
          period_start: source.period_start || reportPeriod.start || '',
          period_end: source.period_end || reportPeriod.end || '',
          period_label: source.period_label || reportPeriod.label || '',
          source_sheet: source.source_sheet || '',
          source_file: file.name
        }
      }).filter(row => row.employee_name)
      const diag = laborImportDiagnostics(laborRows)
      setPreviewRows(parsed)
      setStatus(parsed.length
        ? `Imported ${parsed.length} labor rows from ${file.name}${reportPeriod.label ? ` for ${reportPeriod.label}` : ''}: ${diag.hours.toFixed(2)} hours, $${diag.regularPay.toFixed(2)} wages, $${diag.netTips.toFixed(2)} net tips, $${diag.withheld.toFixed(2)} withheld. Review before adding to payroll.`
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
      return { ...next, tip_deduction: field === 'tip_deduction' ? value : money(deduction), total_pay: money(regular + tips + extra) }
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
            pay_type: row.pay_type || inferImportedPayType(null, row),
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
          id: createId('pay'), employee_id: employeeId, employee_name: employee.name || employeeName, group_name: row.source_sheet ? `Toast: ${row.source_sheet}` : sourceLabel, pay_date: importedRowDate(row, toastPayDate),
          pay_type: employee.pay_type || row.pay_type, payroll_type: employee.payroll_type || row.payroll_type, payroll_classification: row.payroll_classification || employee.payroll_classification || inferPayrollClassification(employee), check_number: row.check_number || '', hours: num(row.hours), regular_pay: num(row.regular_pay), original_tips: num(row.total_tips || row.original_tips || (num(row.tips) + num(row.tip_deduction))), tips: num(row.tips),
          period_start: row.period_start || '', period_end: row.period_end || '',
          tip_deduction: num(row.tip_deduction), extra_pay: num(row.extra_pay), extra_reason: row.extra_reason || '', total_pay: num(row.total_pay)
        }
      })
      return {
        ...prev,
        employees: sortByName([...existingEmployees, ...newEmployees]),
        payrollEntries: [...rows, ...(prev.payrollEntries || [])],
        payrollImports: [{ id: importId, date: sourceRows[0]?.period_end || toastPayDate, period_start: sourceRows[0]?.period_start || '', period_end: sourceRows[0]?.period_end || '', file_name: sourceRows[0]?.source_file || '', row_count: rows.length, new_employee_count: newEmployees.length, created_at: new Date().toISOString() }, ...(prev.payrollImports || [])]
      }
    })
    setPreviewRows([])
    setStatus(`Saved ${sourceRows.length} imported payroll rows and added unmatched employees to the employee list`)
  }


  const toastTipsReviewRows = useMemo(() => toastReviewRows.filter(row => {
    const text = [row.payroll_classification, row.pay_type, row.job_name, row.employee_name, row.raw_employee_name].map(value => String(value || '').toLowerCase()).join(' ')
    return num(row.original_tips) > 0 || num(row.tips) > 0 || num(row.tip_deduction) > 0 || /server|waiter|waitress|bartender|front house|foh|customer tip/.test(text)
  }), [toastReviewRows])

  const toastKitchenReviewRows = useMemo(() => {
    const tipIds = new Set(toastTipsReviewRows.map(row => row.id))
    return toastReviewRows.filter(row => !tipIds.has(row.id))
  }, [toastReviewRows, toastTipsReviewRows])

  function renderToastReviewPanel(rows, title, description) {
    const rowIds = rows.map(row => row.id)
    const selectedInTab = selectedToastIds.filter(id => rowIds.includes(id))
    const allSelected = rows.length > 0 && selectedInTab.length === rows.length
    const toggleAll = () => {
      if (allSelected) setSelectedToastIds(current => current.filter(id => !rowIds.includes(id)))
      else setSelectedToastIds(current => Array.from(new Set([...current, ...rowIds])))
    }

    return <div className="tab-panel toast-payroll-review">
      <section className="table-card">
        <header><div><h2>{title}</h2><p>{description}</p></div><div className="actions"><button className="btn secondary" onClick={loadToastLaborReview} disabled={toastReviewLoading}><Icon name="refresh" /> {toastReviewLoading ? 'Loading...' : 'Refresh Toast Labor'}</button><button className="btn primary" onClick={approveToastRows} disabled={!selectedToastIds.length}><Icon name="check" /> Approve Selected ({selectedToastIds.length})</button></div></header>
        {toastReviewError && <div className="status-pill">{toastReviewError}</div>}
        <div className="payroll-bulk-row"><label><input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select All In This Tab</label><span className="review-note">{rows.length} pending rows. Original Toast values remain visible until approval.</span></div>
        <div className="payroll-table-wrap"><table className="payroll-enterprise-table toast-review-table"><thead><tr><th></th><th>Date</th><th>Toast Employee</th><th>Match Employee</th><th>Job</th><th>Hours</th><th>Wages</th><th>Original Tips</th><th>Withheld</th><th>Tips After WH</th><th>Extra Pay</th><th>Method</th><th>Check #</th><th>Total</th></tr></thead><tbody>
          {rows.map(row => <tr key={row.id} className={row.is_new_employee ? 'review-warning' : ''}><td><input type="checkbox" checked={selectedToastIds.includes(row.id)} onChange={() => toggleToastSelection(row.id)} /></td><td>{row.business_date}</td><td><b>{displayToastName(row.raw_employee_name)}</b>{row.is_new_employee && <small className="new-employee-flag">New employee</small>}</td><td><select value={row.employee_id} onChange={e => updateToastReview(row.id, 'employee_id', e.target.value)}><option value="">Create new employee</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></td><td>{row.job_name || '—'}</td><td><input type="number" step="0.01" value={row.hours} onChange={e => updateToastReview(row.id, 'hours', e.target.value)} /></td><td><input type="number" step="0.01" value={row.regular_pay} onChange={e => updateToastReview(row.id, 'regular_pay', e.target.value)} /></td><td>${money(row.original_tips)}</td><td><input type="number" step="0.01" value={row.tip_deduction} onChange={e => updateToastReview(row.id, 'tip_deduction', e.target.value)} /></td><td><input type="number" step="0.01" value={row.tips} onChange={e => updateToastReview(row.id, 'tips', e.target.value)} /></td><td><input type="number" step="0.01" value={row.extra_pay} onChange={e => updateToastReview(row.id, 'extra_pay', e.target.value)} /></td><td><select value={row.payroll_type} onChange={e => updateToastReview(row.id, 'payroll_type', e.target.value)}><option>Cash</option><option>Check</option></select></td><td><input value={row.check_number} onChange={e => updateToastReview(row.id, 'check_number', e.target.value)} /></td><td className="money-strong">${money(row.total_pay)}</td></tr>)}
          {!rows.length && <tr><td colSpan="14" className="empty-cell">{toastReviewLoading ? 'Loading automatic Toast labor...' : 'No pending employees in this payroll tab for the selected date range.'}</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  }

  const tabEntries = useMemo(() => {
    if (activeTab === 'tips') return filteredEntries.filter(entry => {
      const classification = String(entry.payroll_classification || inferPayrollClassification(entry)).toLowerCase()
      return classification.includes('tip') || num(entry.tips) > 0 || num(entry.tip_deduction) > 0
    })
    if (activeTab === 'kitchen') return filteredEntries.filter(entry => {
      const classification = String(entry.payroll_classification || inferPayrollClassification(entry)).toLowerCase()
      return !classification.includes('tip')
    })
    return filteredEntries
  }, [activeTab, filteredEntries])

  const viewTotals = useMemo(() => tabEntries.reduce((acc, entry) => {
    acc.hours += num(entry.hours)
    acc.regular += num(entry.regular_pay)
    acc.originalTips += num(entry.tips) + num(entry.tip_deduction)
    acc.withheld += num(entry.tip_deduction)
    acc.netTips += num(entry.tips)
    acc.extra += num(entry.extra_pay)
    acc.final += num(entry.total_pay)
    acc.employees.add(entry.employee_id || entry.employee_name)
    return acc
  }, { hours: 0, regular: 0, originalTips: 0, withheld: 0, netTips: 0, extra: 0, final: 0, employees: new Set() }), [tabEntries])

  const viewTotalPages = Math.max(1, Math.ceil(tabEntries.length / rowsPerPage))
  const viewCurrentPage = Math.min(page, viewTotalPages)
  const viewPagedEntries = tabEntries.slice((viewCurrentPage - 1) * rowsPerPage, viewCurrentPage * rowsPerPage)
  const allViewSelected = viewPagedEntries.length > 0 && viewPagedEntries.every(entry => selectedEntryIds.includes(entry.id))

  function toggleExpandedEntry(id) {
    setExpandedEntryIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  return <>
    <style>{`
      .payroll-modern{display:grid;gap:14px;color:#13213a}
      .payroll-modern *{box-sizing:border-box}
      .payroll-modern .page-head{margin-bottom:0}
      .payroll-modern .payroll-tabs{display:flex;align-items:center;gap:8px;padding:7px 8px;border:1px solid #dfe7f1;border-radius:12px;background:#eef3f8;overflow:auto}
      .payroll-modern .payroll-tabs button{border:1px solid transparent;background:transparent;padding:10px 14px;font-size:12px;font-weight:800;color:#43516a;border-radius:8px;white-space:nowrap}
      .payroll-modern .payroll-tabs button.active{color:#0f5fd8;background:#fff;border-color:#cfdbea;box-shadow:0 2px 8px rgba(22,52,92,.08)}
      .payroll-filter-card,.payroll-summary-card,.payroll-table-card,.payroll-dashboard-card{background:#fff;border:1px solid #e1e8f1;border-radius:13px;box-shadow:0 3px 14px rgba(22,39,74,.045)}
      .payroll-filter-card{display:grid;grid-template-columns:1.05fr 1fr 1fr 1.15fr auto;gap:18px;padding:18px 22px;align-items:end}
      .payroll-filter-card label{display:grid;gap:7px;font-size:10px;font-weight:900;letter-spacing:.035em;color:#52627c;text-transform:uppercase}
      .payroll-filter-card input,.payroll-filter-card select{height:42px;border:1px solid #d8e2ef;border-radius:9px;background:#fbfdff;padding:0 12px;color:#17233b;font-weight:700;min-width:0;width:100%}
      .payroll-filter-card .search-box{display:flex;align-items:center;gap:8px;height:42px;border:1px solid #d8e2ef;border-radius:9px;background:#fbfdff;padding:0 12px}
      .payroll-filter-card .search-box input{height:38px;border:0;background:transparent;padding:0;outline:0}
      .payroll-filter-card .reset-btn{height:42px;padding:0 14px;border:0;background:transparent;color:#1463e8;font-weight:800}
      .payroll-summary-card{display:grid;grid-template-columns:repeat(6,1fr);padding:18px 22px}
      .payroll-stat{display:flex;gap:12px;align-items:center;padding:2px 18px;border-right:1px solid #e5ebf3;min-width:0}
      .payroll-stat:first-child{padding-left:0}.payroll-stat:last-child{border-right:0;padding-right:0}
      .payroll-stat-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#edf4ff;color:#1769e8;flex:0 0 auto}
      .payroll-stat:nth-child(3) .payroll-stat-icon{background:#eaf8ef;color:#159447}.payroll-stat:nth-child(4) .payroll-stat-icon{background:#fff0f2;color:#e12b3d}.payroll-stat:nth-child(5) .payroll-stat-icon{background:#eef3ff;color:#255eea}.payroll-stat:nth-child(6) .payroll-stat-icon{background:#f4efff;color:#723ce6}
      .payroll-stat span{display:block;font-size:11px;font-weight:700;color:#5b6980;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.payroll-stat b{display:block;font-size:19px;margin-top:3px;white-space:nowrap}.payroll-stat small{display:block;color:#748197;font-size:10px;margin-top:3px}
      .payroll-actionbar{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #e8edf4}
      .payroll-actionbar .right{margin-left:auto;display:flex;gap:10px}
      .payroll-modern .btn{height:38px;border-radius:8px;padding:0 16px;font-weight:800;display:inline-flex;align-items:center;gap:8px}
      .payroll-modern .btn.primary{background:#1769e8;color:#fff;border:1px solid #1769e8}.payroll-modern .btn.secondary{background:#fff;color:#1e2b43;border:1px solid #d6e0ec}.payroll-modern .btn.success{background:#0b9b4b;color:#fff;border:1px solid #0b9b4b}.payroll-modern .btn.danger{background:#fff5f5;color:#d92d3d;border:1px solid #ffd0d5}
      .payroll-modern .file-button input{display:none}
      .import-review-scroll{overflow:auto}.labor-review-table{width:100%;min-width:1550px;border-collapse:collapse}.labor-review-table th{background:#fbfcfe;color:#42516a;text-transform:uppercase;letter-spacing:.035em;font-size:10px;padding:12px 10px;text-align:left;border-bottom:1px solid #e2e8f0;white-space:nowrap}.labor-review-table td{padding:12px 10px;border-bottom:1px solid #edf1f6;font-size:12px;vertical-align:middle;white-space:nowrap}.labor-review-table td small{display:block;color:#718096;margin-top:2px}
      .payroll-table-card{overflow:hidden}
      .payroll-clean-table{width:100%;border-collapse:collapse;table-layout:fixed}
      .payroll-clean-table th{background:#fbfcfe;color:#42516a;text-transform:uppercase;letter-spacing:.035em;font-size:10px;padding:12px 10px;text-align:left;border-bottom:1px solid #e2e8f0}.payroll-clean-table td{padding:13px 10px;border-bottom:1px solid #edf1f6;font-size:12px;vertical-align:middle}
      .payroll-clean-table th:nth-child(1),.payroll-clean-table td:nth-child(1){width:40px}.payroll-clean-table th:nth-child(2),.payroll-clean-table td:nth-child(2){width:30%}.payroll-clean-table th:nth-child(3),.payroll-clean-table td:nth-child(3){width:11%}.payroll-clean-table th:nth-child(4),.payroll-clean-table td:nth-child(4){width:14%}.payroll-clean-table th:nth-child(5),.payroll-clean-table td:nth-child(5){width:14%}.payroll-clean-table th:nth-child(6),.payroll-clean-table td:nth-child(6){width:12%}.payroll-clean-table th:nth-child(7),.payroll-clean-table td:nth-child(7){width:10%}.payroll-clean-table th:nth-child(8),.payroll-clean-table td:nth-child(8){width:82px;text-align:right}
      .employee-name-cell{display:flex;align-items:center;gap:10px}.employee-avatar{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#1769e8;color:#fff;font-weight:900;font-size:11px}.employee-name-cell b{display:block}.employee-name-cell small{display:block;color:#718096;margin-top:2px}
      .payroll-type-pill,.status-pill-modern{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:900}.payroll-type-pill.tips{background:#f2e9ff;color:#782ee8}.payroll-type-pill.kitchen{background:#eaf4ff;color:#1769e8}.status-pill-modern{background:#fff5e4;color:#dc7b00;border:1px solid #ffdfad}
      .money-final{font-weight:900;font-size:13px}.check-input{width:92px;height:34px;border:1px solid #d8e2ef;border-radius:7px;padding:0 9px}
      .row-actions{display:flex;justify-content:flex-end;gap:6px}.row-actions button{width:32px;height:32px;border:1px solid #d8e2ef;border-radius:7px;background:#fff;color:#1769e8;display:grid;place-items:center}
      .payroll-detail-row td{padding:0 12px 14px;background:#fbfcfe}.payroll-detail-grid{display:grid;grid-template-columns:repeat(8,1fr);border:1px solid #e3e9f1;border-radius:9px;background:#fff;padding:14px 18px;gap:0}.payroll-detail-item{padding:0 18px;border-right:1px solid #e4eaf2}.payroll-detail-item:first-child{padding-left:0}.payroll-detail-item:last-child{border-right:0}.payroll-detail-item span{display:block;color:#657188;font-size:10px;font-weight:800;margin-bottom:7px}.payroll-detail-item b{font-size:13px}.negative{color:#dc2b3e}.positive{color:#138d42}
      .payroll-pagination{display:flex;align-items:center;padding:12px 16px;gap:10px}.payroll-pagination .pages{margin:auto;display:flex;gap:6px}.payroll-pagination button{min-width:32px;height:32px;border:1px solid #d8e2ef;border-radius:7px;background:#fff}.payroll-pagination button.active{background:#1769e8;color:#fff;border-color:#1769e8}
      .payroll-footer-total{position:sticky;bottom:0;z-index:5;display:grid;grid-template-columns:repeat(6,1fr) 1.5fr;align-items:center;background:#fff;border:1px solid #dfe7f0;border-radius:12px;padding:14px 18px;box-shadow:0 -5px 18px rgba(15,31,60,.08)}.payroll-footer-total div{text-align:center;border-right:1px solid #e4eaf2}.payroll-footer-total div:last-of-type{border-right:0}.payroll-footer-total b{display:block;font-size:18px}.payroll-footer-total span{font-size:10px;color:#607087;font-weight:800}.payroll-footer-total .approve-box{margin-left:18px;border:0}.payroll-footer-total .approve-box button{width:100%;height:50px;justify-content:center}

      .payroll-edit-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.42);display:grid;place-items:center;padding:24px}
      .payroll-edit-modal{width:min(760px,96vw);background:#fff;border:1px solid #dfe7f1;border-radius:14px;box-shadow:0 24px 70px rgba(15,23,42,.24);overflow:hidden}
      .payroll-edit-modal header{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #e7edf4;background:#f8fafc}.payroll-edit-modal h2{margin:0;font-size:18px}.payroll-edit-modal p{margin:4px 0 0;color:#64748b;font-size:12px}.payroll-edit-modal .modal-close{border:0;background:#eef2f7;width:32px;height:32px;border-radius:8px;font-size:20px;cursor:pointer}
      .payroll-edit-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:20px}.payroll-edit-grid label{display:grid;gap:6px;font-size:11px;font-weight:800;color:#52627c}.payroll-edit-grid label.wide{grid-column:span 3}.payroll-edit-grid input,.payroll-edit-grid select{height:40px;border:1px solid #d8e2ef;border-radius:8px;padding:0 10px;background:#fff}
      .payroll-edit-modal footer{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #e7edf4;background:#f8fafc}
      .bulk-selected-count{font-size:11px;font-weight:800;color:#1463e8;background:#edf4ff;border:1px solid #cfe0ff;border-radius:999px;padding:6px 10px;white-space:nowrap}
      .payroll-dashboard-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.payroll-dashboard-card{padding:18px}.payroll-dashboard-card h3{margin:0 0 8px;font-size:13px}.payroll-dashboard-card b{font-size:24px}.payroll-dashboard-card p{color:#68768b;font-size:11px;margin:5px 0 14px}
      .manual-panel,.groups-panel{padding:18px}.manual-panel .employee-form-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.manual-panel label{display:grid;gap:6px;font-size:11px;font-weight:800;color:#52627c}.manual-panel input,.manual-panel select,.groups-panel input,.groups-panel select{height:40px;border:1px solid #d8e2ef;border-radius:8px;padding:0 10px;background:#fff}
      .group-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px}.group-card{border:1px solid #e1e8f1;border-radius:12px;padding:16px;background:#fff}.group-card header{display:flex;justify-content:space-between;align-items:center}.group-card ul{padding-left:18px;color:#52627c;font-size:12px;min-height:70px}
      .import-preview{margin-top:14px}
      @media(max-width:1250px){.payroll-summary-card{grid-template-columns:repeat(3,1fr);gap:14px}.payroll-stat{border-right:0;padding:0}.payroll-filter-card{grid-template-columns:repeat(2,1fr)}.payroll-filter-card .reset-btn{justify-self:start}.payroll-detail-grid{grid-template-columns:repeat(4,1fr);gap:14px}.payroll-detail-item{border-right:0;padding:0}.payroll-dashboard-grid{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:760px){.payroll-filter-card{grid-template-columns:1fr}.payroll-summary-card{grid-template-columns:1fr 1fr}.payroll-clean-table th:nth-child(3),.payroll-clean-table td:nth-child(3),.payroll-clean-table th:nth-child(4),.payroll-clean-table td:nth-child(4),.payroll-clean-table th:nth-child(6),.payroll-clean-table td:nth-child(6){display:none}.payroll-footer-total{grid-template-columns:repeat(2,1fr)}.payroll-footer-total .approve-box{grid-column:1/-1;margin:12px 0 0}.manual-panel .employee-form-grid{grid-template-columns:1fr}.group-cards{grid-template-columns:1fr}}
    `}</style>

    <div className="payroll-modern">
      <div className="page-head"><div><h1>Payroll</h1><p>Monday–Sunday payroll review, labor import and final check totals</p></div></div>

      <nav className="payroll-tabs">
        {[['dashboard','Payroll Dashboard'],['all','All Payroll'],['tips','Tips Payroll'],['kitchen','Kitchen Payroll'],['manual','Manual Payroll'],['groups','Payroll Groups'],['history','History']].map(([id,label]) => <button key={id} className={activeTab===id?'active':''} onClick={()=>setActiveTab(id)}>{label}</button>)}
      </nav>

      {['dashboard','all','tips','kitchen','history'].includes(activeTab) && <>
        <section className="payroll-filter-card">
          <label>Payroll Week (Mon–Sun)<div><DateControls start={dateStart} end={dateEnd} onStartChange={updateDateStart} onEndChange={updateDateEnd} onApply={()=>{saveGlobalDateRange(dateStart,dateEnd);setStatus(`Applied payroll date range: ${rangeLabel}`)}} onPreset={applyPreset}/></div></label>
          <label>Employee<select value={employeeFilter} onChange={e=>setEmployeeFilter(e.target.value)}><option value="all">All Employees</option>{employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></label>
          <label>Payroll Type<select value={payClassFilter} onChange={e=>setPayClassFilter(e.target.value)}><option value="all">All Types</option><option value="tips">Tips Payroll</option><option value="operating">Kitchen / Operating</option></select></label>
          <label>Search<div className="search-box"><Icon name="search" size={16}/><input value={employeeSearch} onChange={e=>setEmployeeSearch(e.target.value)} placeholder="Search employee..."/></div></label>
          <button className="reset-btn" onClick={()=>{setEmployeeFilter('all');setPayClassFilter('all');setPayMethodFilter('all');setSourceFilter('all');setEmployeeSearch('')}}>Reset</button>
        </section>

        <section className="payroll-summary-card">
          <div className="payroll-stat"><div className="payroll-stat-icon"><Icon name="users"/></div><div><span>Employees</span><b>{viewTotals.employees.size}</b><small>Included in range</small></div></div>
          <div className="payroll-stat"><div className="payroll-stat-icon"><Icon name="clock"/></div><div><span>Total Hours</span><b>{money(viewTotals.hours)}</b><small>Selected employees</small></div></div>
          <div className="payroll-stat"><div className="payroll-stat-icon"><Icon name="dollar"/></div><div><span>Original Tips</span><b>${money(viewTotals.originalTips)}</b><small>Before withholding</small></div></div>
          <div className="payroll-stat"><div className="payroll-stat-icon"><Icon name="percent"/></div><div><span>Tips Withheld</span><b>${money(viewTotals.withheld)}</b><small>{money(tipRate)}% withholding</small></div></div>
          <div className="payroll-stat"><div className="payroll-stat-icon"><Icon name="bag"/></div><div><span>Extra Pay</span><b>${money(viewTotals.extra)}</b><small>Selected range</small></div></div>
          <div className="payroll-stat"><div className="payroll-stat-icon"><Icon name="card"/></div><div><span>Final Checks</span><b>${money(viewTotals.final)}</b><small>Total to be paid</small></div></div>
        </section>
      </>}

      {activeTab === 'dashboard' && <div className="payroll-dashboard-grid">
        <div className="payroll-dashboard-card"><h3>Tips Payroll</h3><b>${money(filteredEntries.filter(e=>String(e.payroll_classification||inferPayrollClassification(e)).toLowerCase().includes('tip')).reduce((s,e)=>s+num(e.total_pay),0))}</b><p>Net tips, wages and extra pay</p><button className="btn secondary" onClick={()=>setActiveTab('tips')}>Review Tips Payroll</button></div>
        <div className="payroll-dashboard-card"><h3>Kitchen Payroll</h3><b>${money(filteredEntries.filter(e=>!String(e.payroll_classification||inferPayrollClassification(e)).toLowerCase().includes('tip')).reduce((s,e)=>s+num(e.total_pay),0))}</b><p>Operating and kitchen labor</p><button className="btn secondary" onClick={()=>setActiveTab('kitchen')}>Review Kitchen Payroll</button></div>
        <div className="payroll-dashboard-card"><h3>Labor Summary</h3><b>{filteredEntries.length}</b><p>Imported and manual payroll rows</p><label className="file-button btn primary"><Icon name="upload"/> Import Labor Summary<input type="file" accept=".csv,.xlsx,.xls" onChange={handleLaborFile}/></label></div>
        <div className="payroll-dashboard-card"><h3>Final Check Register</h3><b>${money(viewTotals.final)}</b><p>{viewTotals.employees.size} employee checks in selected range</p><button className="btn success" onClick={()=>setActiveTab('all')}>Open All Payroll</button></div>
      </div>}

      {['all','tips','kitchen','history'].includes(activeTab) && <section className="payroll-table-card">
        <div className="payroll-actionbar">
          <label className="file-button btn primary"><Icon name="upload"/> Import Labor Summary<input type="file" accept=".csv,.xlsx,.xls" onChange={handleLaborFile}/></label>
          <button className="btn secondary" onClick={()=>setActiveTab('manual')}><Icon name="plus"/> Add Manual Payroll</button>
          <button className="btn secondary" onClick={()=>toggleTabSelection(tabEntries)}>{tabEntries.length > 0 && tabEntries.every(entry=>selectedEntryIds.includes(entry.id)) ? `Clear All (${tabEntries.length})` : `Select All (${tabEntries.length})`}</button>
          <button className="btn secondary" onClick={toggleVisibleSelection}>{allVisibleSelected ? `Clear Page (${viewPagedEntries.length})` : `Select Page (${viewPagedEntries.length})`}</button>
          <span className="bulk-selected-count">{selectedEntryIds.length} selected</span>
          <div className="right"><button className="btn secondary" onClick={exportSelectedEntries}><Icon name="download"/> Export Selected</button><button className="btn danger" onClick={deleteSelectedEntries}>Delete Selected</button><button className="btn success">Approve Payroll</button></div>
        </div>
        <table className="payroll-clean-table"><thead><tr><th><input type="checkbox" checked={tabEntries.length>0 && tabEntries.every(entry=>selectedEntryIds.includes(entry.id))} onChange={()=>toggleTabSelection(tabEntries)} /></th><th>Date</th><th>Employee</th><th>Hours</th><th>Payroll Type</th><th>Final Check</th><th>Status</th><th>Check #</th><th>Actions</th></tr></thead><tbody>
          {viewPagedEntries.length ? viewPagedEntries.map((entry,index)=>{
            const open=expandedEntryIds.includes(entry.id)
            const isTips=String(entry.payroll_classification||inferPayrollClassification(entry)).toLowerCase().includes('tip') || num(entry.tips)>0
            const initials=String(entry.employee_name||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()
            return <React.Fragment key={entry.id}><tr><td><input type="checkbox" checked={selectedEntryIds.includes(entry.id)} onChange={()=>toggleEntrySelection(entry.id)}/></td><td className="pay-date-cell">{entry.pay_date||'—'}</td><td><div className="employee-name-cell"><span className="employee-avatar">{initials}</span><div><b>{entry.employee_name}</b><small>{entry.group_name||entry.pay_type||'Employee'}</small></div></div></td><td>{num(entry.hours)?money(entry.hours):'—'}</td><td><span className={`payroll-type-pill ${isTips?'tips':'kitchen'}`}>{isTips?'Tips Payroll':'Kitchen Payroll'}</span></td><td className="money-final">${money(entry.total_pay)}</td><td><span className="status-pill-modern">Pending</span></td><td><input className="check-input" value={entry.check_number||''} placeholder="—" onChange={e=>setData(prev=>({...prev,payrollEntries:(prev.payrollEntries||[]).map(row=>row.id===entry.id?{...row,check_number:e.target.value}:row)}))}/></td><td><div className="row-actions"><button title="Edit" onClick={()=>startEdit(entry)}><Icon name="edit" size={14}/></button><button title="Expand" onClick={()=>toggleExpandedEntry(entry.id)}><Icon name={open?'chevronUp':'chevronDown'} size={14}/></button></div></td></tr>{open&&<tr className="payroll-detail-row"><td colSpan="9"><div className="payroll-detail-grid"><div className="payroll-detail-item"><span>Regular Pay</span><b>${money(entry.regular_pay)}</b></div><div className="payroll-detail-item"><span>Overtime Pay</span><b>${money(entry.overtime_pay)}</b></div><div className="payroll-detail-item"><span>Original Tips</span><b>${money(num(entry.tips)+num(entry.tip_deduction))}</b></div><div className="payroll-detail-item"><span>Tips Withheld</span><b className="negative">${money(entry.tip_deduction)}</b></div><div className="payroll-detail-item"><span>Net Tips</span><b className="positive">${money(entry.tips)}</b></div><div className="payroll-detail-item"><span>Extra Pay</span><b>${money(entry.extra_pay)}</b></div><div className="payroll-detail-item"><span>Pay Date</span><b>{entry.pay_date||'—'}</b></div><div className="payroll-detail-item"><span>Method</span><b>{entry.payroll_type||'—'}</b></div></div></td></tr>}</React.Fragment>
          }) : <tr><td colSpan="9" className="empty-cell">No payroll entries in the selected date range.</td></tr>}
        </tbody></table>
        <div className="payroll-pagination"><span>Showing {tabEntries.length ? (viewCurrentPage-1)*rowsPerPage+1 : 0} to {Math.min(viewCurrentPage*rowsPerPage,tabEntries.length)} of {tabEntries.length}</span><div className="pages"><button onClick={()=>setPage(Math.max(1,viewCurrentPage-1))}>‹</button>{Array.from({length:Math.min(viewTotalPages,5)},(_,i)=>i+1).map(n=><button key={n} className={viewCurrentPage===n?'active':''} onClick={()=>setPage(n)}>{n}</button>)}<button onClick={()=>setPage(Math.min(viewTotalPages,viewCurrentPage+1))}>›</button></div><label>Rows: <select value={rowsPerPage} onChange={e=>setRowsPerPage(Number(e.target.value))}><option>10</option><option>25</option><option>50</option></select></label></div>
      </section>}

      {activeTab === 'manual' && <section className="payroll-table-card manual-panel"><div className="payroll-actionbar"><h2>Manual Payroll</h2><div className="right"><label className="file-button btn primary"><Icon name="upload"/> Upload CSV / Excel<input type="file" accept=".csv,.xlsx,.xls" onChange={handleLaborFile}/></label></div></div><div className="employee-form-grid"><label>Employee<select value={manualForm.employee_id} onChange={e=>updateManualForm('employee_id',e.target.value)}><option value="">Select employee</option>{employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></label><label>Manual Name<input value={manualForm.employee_name} onChange={e=>updateManualForm('employee_name',e.target.value)}/></label><label>Payroll Date<input type="date" value={manualForm.pay_date} onChange={e=>updateManualForm('pay_date',e.target.value)}/></label><label>Payment Method<select value={manualForm.payroll_type} onChange={e=>updateManualForm('payroll_type',e.target.value)}><option>Cash</option><option>Check</option></select></label><label>Check #<input value={manualForm.check_number} onChange={e=>updateManualForm('check_number',e.target.value)}/></label><label>Hours<input type="number" value={manualForm.hours} onChange={e=>updateManualForm('hours',e.target.value)}/></label><label>Regular Pay<input type="number" value={manualForm.regular_pay} onChange={e=>updateManualForm('regular_pay',e.target.value)}/></label><label>Net Tips<input type="number" value={manualForm.tips} onChange={e=>updateManualForm('tips',e.target.value)}/></label><label>Tips Withheld<input type="number" value={manualForm.tip_deduction} onChange={e=>updateManualForm('tip_deduction',e.target.value)}/></label><label>Extra Pay<input type="number" value={manualForm.extra_pay} onChange={e=>updateManualForm('extra_pay',e.target.value)}/></label><label>Extra Reason<input value={manualForm.extra_reason} onChange={e=>updateManualForm('extra_reason',e.target.value)}/></label><label>&nbsp;<button className="btn primary" onClick={addManualPayroll}><Icon name="plus"/> Add Payroll</button></label></div></section>}

      {activeTab === 'groups' && <section className="payroll-table-card groups-panel"><div className="payroll-actionbar"><h2>Payroll Groups</h2><div className="right"><input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="New group name"/><button className="btn primary" onClick={createGroup}><Icon name="plus"/> Add Group</button></div></div><div className="group-cards">{groups.map(group=>{const members=employees.filter(emp=>(group.memberIds||[]).includes(emp.id));return <div className="group-card" key={group.id}><header><h3>{group.name}</h3><span>{members.length} members</span></header><p><b>Method:</b> {group.payroll_type||'Cash'}</p><ul>{members.slice(0,6).map(emp=><li key={emp.id}>{emp.name} — {emp.job_type||emp.pay_type}</li>)}</ul><div className="row-actions"><button onClick={()=>setSelectedGroupId(group.id)}><Icon name="edit" size={14}/></button><button className="delete" onClick={()=>{setSelectedGroupId(group.id);setTimeout(deleteGroup,0)}}><Icon name="trash" size={14}/></button></div></div>})}</div></section>}

      {previewRows.length>0 && <section className="payroll-table-card import-preview"><div className="payroll-actionbar"><div><h2>Labor Summary Review</h2><small>{previewRows.length} rows ready to add{previewRows[0]?.period_label ? ` • Toast report: ${previewRows[0].period_label}` : ''}</small></div><div className="right"><button className="btn secondary" onClick={()=>setPreviewRows([])}>Cancel</button><button className="btn primary" onClick={savePreviewToPayroll}>Add To Payroll</button></div></div><div className="import-review-scroll"><table className="labor-review-table"><thead><tr><th>Pay Date</th><th>Toast Period</th><th>Employee</th><th>Hours</th><th>Regular Pay</th><th>Original Tips</th><th>3.5% Withheld</th><th>Final Tips</th><th>Extra Pay</th><th>Final Check</th><th>Pay Type</th><th>Payment</th><th>Check #</th><th>Status</th></tr></thead><tbody>{previewRows.map(row=><tr key={row.id}><td className="pay-date-cell">{row.pay_date||toastPayDate}</td><td>{row.period_label||row.pay_date||'—'}</td><td><b>{row.employee_name}</b><small>{row.job_type||row.source_sheet}</small></td><td>{row.hours}</td><td>${money(row.regular_pay)}</td><td>${money(row.total_tips)}</td><td className="negative">-${money(row.tip_deduction)}</td><td className="positive">${money(row.tips)}</td><td>${money(row.extra_pay)}</td><td className="money-final">${money(row.total_pay)}</td><td>{row.pay_type}</td><td>{row.payroll_type}</td><td>{row.check_number||'—'}</td><td><span className="status-pill-modern">Review</span></td></tr>)}</tbody></table></div></section>}

      {editingEntryId && <div className="payroll-edit-overlay" onClick={()=>setEditingEntryId(null)}><section className="payroll-edit-modal" onClick={e=>e.stopPropagation()}><header><div><h2>Edit Payroll Entry</h2><p>Update the employee's weekly payroll details.</p></div><button className="modal-close" onClick={()=>setEditingEntryId(null)}>×</button></header><div className="payroll-edit-grid"><label>Pay Date<input type="date" value={entryForm.pay_date||''} onChange={e=>setEntryForm(prev=>({...prev,pay_date:e.target.value}))}/></label><label>Hours<input type="number" step="0.01" value={entryForm.hours||''} onChange={e=>setEntryForm(prev=>({...prev,hours:e.target.value}))}/></label><label>Regular Pay<input type="number" step="0.01" value={entryForm.regular_pay||''} onChange={e=>setEntryForm(prev=>({...prev,regular_pay:e.target.value}))}/></label><label>Net Tips<input type="number" step="0.01" value={entryForm.tips||''} onChange={e=>setEntryForm(prev=>({...prev,tips:e.target.value}))}/></label><label>Tips Withheld<input type="number" step="0.01" value={entryForm.tip_deduction||''} onChange={e=>setEntryForm(prev=>({...prev,tip_deduction:e.target.value}))}/></label><label>Extra Pay<input type="number" step="0.01" value={entryForm.extra_pay||''} onChange={e=>setEntryForm(prev=>({...prev,extra_pay:e.target.value}))}/></label><label>Check Number<input value={entryForm.check_number||''} onChange={e=>setEntryForm(prev=>({...prev,check_number:e.target.value}))}/></label><label className="wide">Extra Pay Reason<input value={entryForm.extra_reason||''} onChange={e=>setEntryForm(prev=>({...prev,extra_reason:e.target.value}))}/></label></div><footer><button className="btn secondary" onClick={()=>setEditingEntryId(null)}>Cancel</button><button className="btn primary" onClick={saveEntryEdit}>Save Changes</button></footer></section></div>}

      {['all','tips','kitchen','history'].includes(activeTab) && <div className="payroll-footer-total"><div><b>{viewTotals.employees.size}</b><span>Employees</span></div><div><b>{money(viewTotals.hours)}</b><span>Total Hours</span></div><div><b className="positive">${money(viewTotals.originalTips)}</b><span>Original Tips</span></div><div><b className="negative">${money(viewTotals.withheld)}</b><span>Tips Withheld</span></div><div><b>${money(viewTotals.extra)}</b><span>Extra Pay</span></div><div><b>${money(viewTotals.final)}</b><span>Final Checks</span></div><div className="approve-box"><button className="btn success"><Icon name="check"/> Approve Payroll</button></div></div>}
    </div>
  </>
}
