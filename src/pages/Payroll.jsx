import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { markPayrollDeleted, createId, sortByName } from '../lib/localStore'
import { detectToastLaborPeriod, laborImportDiagnostics, parseToastLaborRows } from '../engine/ToastLaborEngine'

const PAY_METHODS = ['Cash', 'Check', 'ACH', 'Card', 'Other']

function today() { return new Date().toISOString().slice(0, 10) }
function isoDateUTC(date) { return date.toISOString().slice(0, 10) }
function mondaySundayWeek(dateValue) {
  const raw = String(dateValue || '').slice(0, 10)
  const date = new Date(`${raw}T12:00:00Z`)
  if (!raw || Number.isNaN(date.getTime())) return { start: raw, end: raw }
  const day = date.getUTCDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() - daysFromMonday)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return { start: isoDateUTC(monday), end: isoDateUTC(sunday) }
}
function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }
function num(value) { return Number(String(value ?? '').replace(/[$,%]/g, '').trim()) || 0 }
function round2(value) { return Math.round((num(value) + Number.EPSILON) * 100) / 100 }
function money(value) { return round2(value).toFixed(2) }
function openDatePicker(event) {
  const input = event.currentTarget
  try {
    if (typeof input.showPicker === 'function') input.showPicker()
    else input.focus()
  } catch {
    input.focus()
  }
}
function normalizeName(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/[^a-z0-9]/g, '') }
function nameTokens(value) {
  const raw = displayToastName(value)
  return String(raw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)
}
function employeeMatchScore(employee = {}, row = {}) {
  const rowName = row.employee_name || row.raw_name || row.name || ''
  const employeeName = employee.name || employee.employee_name || ''
  const employeeExternal = String(employee.toast_employee_id || employee.external_id || employee.employee_external_id || '')
  const rowExternal = String(row.employee_external_id || row.toast_employee_id || row.external_id || '')
  if (employeeExternal && rowExternal && employeeExternal === rowExternal) return 100
  const left = normalizeName(employeeName)
  const right = normalizeName(rowName)
  if (!left || !right) return 0
  if (left === right) return 95
  const leftTokens = nameTokens(employeeName)
  const rightTokens = nameTokens(rowName)
  const common = leftTokens.filter(token => rightTokens.includes(token))
  if (common.length >= 2 && common.length === Math.min(leftTokens.length, rightTokens.length)) return 88
  if (common.length >= 2) return 80
  if (left.includes(right) || right.includes(left)) return 72
  return 0
}
function findEmployeeMatch(row, employeeList = []) {
  return employeeList
    .map(employee => ({ employee, score: employeeMatchScore(employee, row), hasRate: employeeHourlyRate(employee) > 0, generated: employee.created_from === 'toast_payroll_builder' }))
    .filter(match => match.score >= 72)
    .sort((a, b) => b.score - a.score || Number(b.hasRate) - Number(a.hasRate) || Number(a.generated) - Number(b.generated))[0]?.employee || null
}
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
function payrollFilterDate(row) {
  // Filter the register by one actual payroll date. Toast rows use pay_date or
  // payroll_date; manual/group entries fall back to the period start/end date.
  return String(entryDate(row) || row.period_start || row.period_end || '').slice(0, 10)
}
function rowInSelectedRange(row, start, end) {
  const fallback = payrollFilterDate(row)
  const rowStart = String(row.period_start || fallback || '').slice(0, 10)
  const rowEnd = String(row.period_end || fallback || rowStart || '').slice(0, 10)
  if (!rowStart && !rowEnd) return !start && !end
  // Weekly payroll rows represent the complete payroll period. Filter them by
  // period overlap instead of only the pay date so selecting the same Toast
  // report range never drops or misstates an approved weekly row.
  if (start && rowEnd && rowEnd < start) return false
  if (end && rowStart && rowStart > end) return false
  return true
}
function isApproved(row) { return String(row.approval_status || '').toLowerCase() === 'approved' || Boolean(row.approved_at) }
function firstNonZeroAmount(row, keys = []) {
  for (const key of keys) {
    const value = num(row?.[key])
    if (value !== 0) return value
  }
  return 0
}
function storedGrossTips(row = {}) {
  return round2(firstNonZeroAmount(row, ['credit_card_tips', 'original_tips', 'total_tips', 'gross_tips']))
}
function storedNetTips(row = {}) {
  return round2(firstNonZeroAmount(row, ['tips_after_withheld', 'tips_after_withholding', 'final_tips', 'net_tips', 'tips']))
}
function tipWithheld(row = {}) {
  const explicit = firstNonZeroAmount(row, ['tip_deduction', 'tips_withheld', 'tips_withholding', 'withheld_tips'])
  if (explicit !== 0) return round2(explicit)
  const gross = storedGrossTips(row)
  const net = storedNetTips(row)
  return round2(gross > 0 && net >= 0 ? Math.max(0, gross - net) : 0)
}
function originalTips(row = {}) {
  const explicit = storedGrossTips(row)
  if (explicit !== 0) return round2(explicit)
  const net = storedNetTips(row)
  const withheld = tipWithheld(row)
  return round2(net + withheld)
}
function finalTips(row = {}) {
  const stored = storedNetTips(row)
  if (stored !== 0) return stored
  return round2(Math.max(0, originalTips(row) - tipWithheld(row)))
}
function employeePayType(employee = {}) {
  return String(employee.pay_type || employee.employee_type || '').trim().toLowerCase()
}
function isTipEmployee(employee = {}) {
  return /tip|server|bartender|front.?of.?house|foh|waiter|waitress/.test(employeePayType(employee))
}
function isHourlyEmployee(employee = {}) {
  const type = employeePayType(employee)
  return !isTipEmployee(employee) && !/salary|fixed|weekly|annual/.test(type)
}

function employeeHourlyRate(employee = {}) {
  const payType = String(employee.pay_type || employee.employee_type || '').toLowerCase()
  const explicit = num(employee.hourly_rate ?? employee.pay_rate ?? employee.rate)
  if (explicit > 0) return explicit
  // Older employee records often stored the hourly rate only in base_pay.
  // Treat it as an hourly rate unless the employee is explicitly salary/fixed.
  if (!/salary|fixed|weekly|annual/.test(payType)) return num(employee.base_pay)
  return 0
}
function resolvedRegularPay(row, employee = {}) {
  // Tipped employees can still earn hourly wages. Never discard imported or
  // calculated wages merely because an employee also receives tips.
  const stored = num(row.regular_pay ?? row.regularPay ?? row.base_pay)
  if (stored > 0) return round2(stored)
  const rate = num(row.rate) || employeeHourlyRate(employee)
  const regularHours = num(row.regular_hours)
  const overtimeHours = num(row.overtime_hours)
  const totalHours = num(row.hours)
  const payableRegularHours = regularHours > 0 ? regularHours : Math.max(totalHours - overtimeHours, 0)
  return round2(payableRegularHours > 0 && rate > 0 ? payableRegularHours * rate : 0)
}
function resolvedOvertimePay(row, employee = {}) {
  const stored = num(row.overtime_pay)
  if (stored > 0) return round2(stored)
  const overtimeHours = num(row.overtime_hours)
  const rate = num(row.rate) || employeeHourlyRate(employee)
  return round2(overtimeHours > 0 && rate > 0 ? overtimeHours * rate * 1.5 : 0)
}
function finalPay(row, employee = {}) {
  // Existing Supabase rows may store the completed amount under `total`
  // while newer rows use `total_pay`. Prefer any populated saved total first.
  const storedTotal = firstNonZeroAmount(row, ['total_pay', 'final_pay', 'payroll_total', 'total'])
  if (storedTotal !== 0) return round2(storedTotal)
  if (isTipEmployee(employee) || /tip|server|bartender|waiter|waitress|front.?of.?house|foh/i.test(String(row.pay_type || row.job_type || '')) || originalTips(row) > 0) {
    return round2(finalTips(row) + num(row.extra_pay))
  }
  return round2(resolvedRegularPay(row, employee) + resolvedOvertimePay(row, employee) + num(row.extra_pay))
}

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
  const allEmployees = sortByName(data.employees || [])
  const employees = allEmployees.filter(item => item.is_active !== false)
  const entries = data.payrollEntries || []
  const tipRate = num(data.settings?.tipWithholdingRate ?? 3.5)
  const payrollGroups = sortByName(data.payrollGroups || [])
  const employeeForRow = row => allEmployees.find(employee => employee.id === row.employee_id) || findEmployeeMatch(row, allEmployees) || {}

  const defaultPayrollRange = presetRange('lastWeek')
  const [dateStart, setDateStart] = useState(defaultPayrollRange[0])
  const [dateEnd, setDateEnd] = useState(defaultPayrollRange[1])
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
  const [mergeWeekly, setMergeWeekly] = useState(true)
  const initializedRangeRef = useRef(false)
  const importGenerationRef = useRef(0)
  const uploadInputRef = useRef(null)


  useEffect(() => {
    if (initializedRangeRef.current) return
    const imports = [...(data.payrollImports || [])]
      .filter(item => item?.period_start && item?.period_end)
      .sort((a, b) => String(b.period_end).localeCompare(String(a.period_end)))
    const latestImport = imports[0]
    if (latestImport) {
      setDateStart(String(latestImport.period_start).slice(0, 10))
      setDateEnd(String(latestImport.period_end).slice(0, 10))
      initializedRangeRef.current = true
      return
    }
    const datedEntries = [...entries]
      .filter(row => entryDate(row))
      .sort((a, b) => entryDate(b).localeCompare(entryDate(a)))
    if (datedEntries[0]) {
      const latest = datedEntries[0]
      setDateStart(String(latest.period_start || entryDate(latest)).slice(0, 10))
      setDateEnd(String(latest.period_end || entryDate(latest)).slice(0, 10))
    }
    initializedRangeRef.current = true
  }, [data.payrollImports, entries])

  function clearImportWorkspace(message='Import workspace cleared.') {
    importGenerationRef.current += 1
    setImportedRows([])
    setBuilderRows([])
    setSelectedBuilderIds([])
    setEmployeeFilter('')
    setEmployeeSearch('')
    setSourceFile('')
    if (uploadInputRef.current) uploadInputRef.current.value = ''
    if (message) setStatus(message)
  }

  const importedEmployeeOptions = useMemo(() => {
    const names = importedRows.map(row => displayToastName(row.raw_name || row.employee_name)).filter(Boolean)
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
  }, [importedRows])

  const filteredImportedRows = useMemo(() => importedRows.filter(row => {
    const date = String(row.pay_date || row.business_date || '').slice(0, 10)
    const rowStart = String(row.period_start || date || '').slice(0, 10)
    const rowEnd = String(row.period_end || date || rowStart || '').slice(0, 10)
    if (dateStart && rowEnd && rowEnd < dateStart) return false
    if (dateEnd && rowStart && rowStart > dateEnd) return false
    if (employeeFilter && !sameEmployee(employeeFilter, row.raw_name || row.employee_name)) return false
    if (employeeSearch && !normalizeName(displayToastName(row.raw_name || row.employee_name)).includes(normalizeName(employeeSearch))) return false
    return true
  }), [importedRows, dateStart, dateEnd, employeeFilter, employeeSearch])

  useEffect(() => {
    const generation = importGenerationRef.current
    if (!importedRows.length) {
      setBuilderRows([])
      setSelectedBuilderIds([])
      return
    }
    const groups = new Map()
    filteredImportedRows.forEach(source => {
      const rawName = source.raw_name || source.employee_name || ''
      const employee = findEmployeeMatch({ ...source, employee_name: rawName }, allEmployees)
      const name = employee?.name || displayToastName(rawName)
      if (!name) return
      const workDate = String(source.pay_date || source.business_date || '').slice(0, 10)
      if (!workDate) return
      const employeeKey = employee?.id || normalizeName(name)
      const week = mondaySundayWeek(workDate)
      const periodStart = mergeWeekly ? week.start : workDate
      const periodEnd = mergeWeekly ? week.end : workDate
      // A weekly row is unique by employee AND Sunday week-ending date.
      // Never merge an entire multi-week Toast report into one employee row.
      const key = mergeWeekly ? `${employeeKey}::${periodEnd}` : `${employeeKey}::${workDate}`
      const current = groups.get(key) || {
        id: createId('build'), employee_id: employee?.id || '', employee_name: name,
        job_type: employee?.job_type || source.job_type || '', pay_type: employee?.pay_type || employee?.employee_type || source.pay_type || source.job_type || '', pay_date: periodEnd, hours: 0, regular_hours: 0, overtime_hours: 0, regular_pay: 0, overtime_pay: 0,
        credit_card_tips: 0, original_tips: 0, total_tips: 0, tip_deduction: 0, tips: 0, extra_pay: 0, extra_reason: '',
        payroll_type: employee?.payroll_type || 'Check', check_number: employee?.default_check_number || '', notes: '',
        period_start: periodStart, period_end: periodEnd,
        source_file: sourceFile, source_rows: 0
      }
      const sourceHours = num(source.hours)
      const sourceRegularHours = num(source.regular_hours)
      const sourceOvertimeHours = num(source.overtime_hours)
      const sourceRate = num(source.rate) || employeeHourlyRate(employee)
      const importedRegularPay = num(source.regular_pay)
      const importedOvertimePay = num(source.overtime_pay)
      const calculatedRegularPay = sourceRate > 0
        ? (sourceRegularHours > 0 ? sourceRegularHours : Math.max(sourceHours - sourceOvertimeHours, 0)) * sourceRate
        : 0
      const calculatedOvertimePay = sourceRate > 0 && sourceOvertimeHours > 0 ? sourceOvertimeHours * sourceRate * 1.5 : 0
      const wageFallback = num(source.gross_pay) > 0 && !importedRegularPay && !importedOvertimePay ? num(source.gross_pay) : 0
      current.hours = round2(current.hours + sourceHours)
      current.regular_hours = round2(current.regular_hours + sourceRegularHours)
      current.overtime_hours = round2(current.overtime_hours + sourceOvertimeHours)
      current.regular_pay = round2(current.regular_pay + (importedRegularPay || calculatedRegularPay || wageFallback))
      current.overtime_pay = round2(current.overtime_pay + (importedOvertimePay || calculatedOvertimePay))
      current.rate = sourceRate || current.rate || 0
      current.credit_card_tips = round2(current.credit_card_tips + num(source.credit_card_tips ?? source.total_tips))
      current.original_tips = current.credit_card_tips
      current.total_tips = current.credit_card_tips
      current.tip_deduction = round2(current.tip_deduction + num(source.tip_deduction))
      current.tips = round2(Math.max(0, current.credit_card_tips - current.tip_deduction))
      current.source_rows += 1
      current.total_pay = finalPay(current)
      groups.set(key, current)
    })
    const rows = Array.from(groups.values()).sort((a, b) => String(a.pay_date).localeCompare(String(b.pay_date)) || a.employee_name.localeCompare(b.employee_name))
    if (generation !== importGenerationRef.current) return
    setBuilderRows(rows)
    setSelectedBuilderIds(rows.map(row => row.id))
    const diag = laborImportDiagnostics(filteredImportedRows)
    const missingPay = rows.filter(row => { const employee = employeeForRow(row); return num(row.hours) > 0 && isHourlyEmployee(employee) && num(row.regular_pay) === 0 }).length
    const missingTips = rows.filter(row => num(row.credit_card_tips) === 0).length
    setStatus(rows.length
      ? `Showing ${rows.length} ${mergeWeekly ? 'weekly' : 'daily'} payroll rows from ${filteredImportedRows.length} Toast rows: ${money(diag.hours)} hours and $${money(diag.totalTips)} credit card tips.${missingPay ? ` ${missingPay} employee${missingPay === 1 ? '' : 's'} hourly employee${missingPay === 1 ? '' : 's'} still have no wage amount; add an hourly rate or import a Toast report containing pay.` : ''}${missingTips === rows.length ? ' This Toast report contains no credit-card tip values; use a Labor Summary export that includes Non-Cash/Credit Card Tips.' : ''}`
      : 'No Toast labor line entries match this employee and date range.')
  }, [filteredImportedRows, importedRows.length, allEmployees, dateStart, dateEnd, sourceFile, mergeWeekly])

  const filteredHistory = useMemo(() => {
    const query = normalizeName([historySearch, employeeSearch].filter(Boolean).join(' '))
    return entries
      .filter(row => {
        if (!rowInSelectedRange(row, dateStart, dateEnd)) return false
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
    acc.withheld += tipWithheld(row)
    acc.netTips += finalTips(row)
    acc.extra += num(row.extra_pay)
    acc.final += finalPay(row, employeeForRow(row))
    return acc
  }, { employees: 0, hours: 0, regular: 0, overtime: 0, originalTips: 0, withheld: 0, netTips: 0, extra: 0, final: 0 }), [visibleBuilderRows])

  const historyTotals = useMemo(() => filteredHistory.reduce((acc, row) => {
    acc.employees.add(normalizeName(row.employee_name))
    acc.hours += num(row.hours)
    acc.originalTips += originalTips(row)
    acc.withheld += tipWithheld(row)
    acc.extra += num(row.extra_pay)
    acc.final += finalPay(row, employeeForRow(row))
    return acc
  }, { employees: new Set(), hours: 0, originalTips: 0, withheld: 0, extra: 0, final: 0 }), [filteredHistory])

  const payrollDiagnostics = useMemo(() => {
    const rowsWithHours = filteredHistory.filter(row => num(row.hours) > 0)
    const hourlyRows = rowsWithHours.filter(row => isHourlyEmployee(employeeForRow(row)))
    const tippedRows = filteredHistory.filter(row => isTipEmployee(employeeForRow(row)))
    const missingRegular = hourlyRows.filter(row => resolvedRegularPay(row, employeeForRow(row)) === 0)
    const missingTips = tippedRows.filter(row => originalTips(row) === 0)
    const unmatched = rowsWithHours.filter(row => !employeeForRow(row)?.id)
    const missingRate = hourlyRows.filter(row => { const employee = employeeForRow(row); return employee?.id && employeeHourlyRate(employee) === 0 && num(row.regular_pay) === 0 })
    return {
      rows: filteredHistory.length,
      missingRegular: missingRegular.length,
      missingTips: missingTips.length,
      tippedRows: tippedRows.length,
      unmatched: unmatched.length,
      missingRate: missingRate.length,
      canRepairRegular: rowsWithHours.filter(row => num(row.regular_pay) === 0 && resolvedRegularPay(row, employeeForRow(row)) > 0).length
    }
  }, [filteredHistory, employees])

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

  function recalculateSelectedRange() {
    let repaired = 0
    setData(prev => ({
      ...prev,
      payrollEntries: (prev.payrollEntries || []).map(row => {
        if (!rowInSelectedRange(row, dateStart, dateEnd)) return row
        const employee = (prev.employees || []).find(item => item.id === row.employee_id) || findEmployeeMatch(row, prev.employees || []) || {}
        const regularPay = isHourlyEmployee(employee) ? resolvedRegularPay(row, employee) : num(row.regular_pay)
        const tips = finalTips(row)
        if (num(row.regular_pay) === 0 && regularPay > 0) repaired += 1
        return { ...row, employee_id: row.employee_id || employee.id || '', employee_name: employee.name || row.employee_name, regular_pay: regularPay, rate: num(row.rate) || employeeHourlyRate(employee), tips, final_tips: tips, total_pay: finalPay({ ...row, regular_pay: regularPay, tips }, employee) }
      })
    }))
    setStatus(repaired
      ? `Recalculated ${repaired} payroll row${repaired === 1 ? '' : 's'} from employee hourly rates. Tip amounts remain zero when the imported Toast file has no credit-card tip column.`
      : 'No additional wage amounts could be calculated. Add hourly rates on Employees or import a Toast Labor Summary containing wages and Non-Cash/Credit Card Tips.')
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
        const employee = allEmployees.find(item => item.id === value)
        if (employee) {
          next.employee_name = employee.name
          next.payroll_type = employee.payroll_type || next.payroll_type
          next.check_number = employee.default_check_number || next.check_number
          next.job_type = employee.job_type || next.job_type
          next.rate = isHourlyEmployee(employee) ? employeeHourlyRate(employee) : 0
          if (isHourlyEmployee(employee) && num(next.regular_pay) === 0 && num(next.hours) > 0) next.regular_pay = round2(num(next.hours) * employeeHourlyRate(employee))
        }
      }
      if (field === 'original_tips' || field === 'credit_card_tips' || field === 'tip_deduction') {
        const original = field === 'original_tips' || field === 'credit_card_tips' ? num(value) : originalTips(next)
        const withheld = field === 'tip_deduction' ? num(value) : tipWithheld(next)
        next.credit_card_tips = round2(original)
        next.original_tips = round2(original)
        next.total_tips = round2(original)
        next.tips = round2(Math.max(0, original - withheld))
          next.tips_withheld = round2(withheld)
          next.tips_after_withheld = next.tips
      }
      next.final_tips = finalTips(next)
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
      importGenerationRef.current += 1
      const parsedStart = parsed.map(row => String(row.period_start || '').slice(0,10)).filter(Boolean).sort()[0] || detected.start
      const parsedEnd = parsed.map(row => String(row.period_end || '').slice(0,10)).filter(Boolean).sort().slice(-1)[0] || detected.end
      setSourceFile(file.name)
      setImportedRows(parsed)
      setEmployeeFilter('')
      setEmployeeSearch('')
      if (parsedStart && parsedEnd) {
        setDateStart(parsedStart)
        setDateEnd(parsedEnd)
      }
      const diag = laborImportDiagnostics(parsed)
      setStatus(parsed.length
        ? `Imported ${parsed.length} Toast labor entries from ${file.name}: ${money(diag.hours)} hours, $${money(diag.totalTips)} original tips, $${money(diag.withheld)} withheld, and $${money(diag.netTips)} final tips. Payroll totals are calculated automatically and ready for review.`
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
        let employee = (prev.employees || []).find(item => item.id === row.employee_id) || findEmployeeMatch(row, prev.employees || [])
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
      const replacementRows = resolved.map(({ row, employee }) => ({
        employeeId: String(employee.id || ''),
        employeeName: normalizeName(employee.name || row.employee_name),
        periodStart: String(row.period_start || row.pay_date || dateStart || '').slice(0, 10),
        periodEnd: String(row.period_end || row.pay_date || dateEnd || '').slice(0, 10)
      }))
      const kept = oldEntries.filter(entry => {
        const entryStart = String(entry.period_start || entryDate(entry) || '').slice(0, 10)
        const entryEnd = String(entry.period_end || entryDate(entry) || entryStart || '').slice(0, 10)
        const entryEmployeeId = String(entry.employee_id || '')
        const entryEmployeeName = normalizeName(entry.employee_name)
        const duplicate = replacementRows.some(candidate => {
          const samePeriod = candidate.periodStart === entryStart && candidate.periodEnd === entryEnd
          const sameEmployee = Boolean(
            (candidate.employeeId && entryEmployeeId && candidate.employeeId === entryEmployeeId) ||
            (candidate.employeeName && entryEmployeeName && candidate.employeeName === entryEmployeeName)
          )
          return samePeriod && sameEmployee
        })
        return !duplicate
      })
      const created = resolved.map(({ row, employee }) => ({
        id: createId('pay'), import_id: createId('import'), source: 'Toast Payroll Builder', source_file: row.source_file || sourceFile,
        employee_id: employee.id, employee_name: employee.name, group_name: `Toast Payroll ${row.period_start} to ${row.period_end}`,
        pay_date: row.pay_date || row.period_end || dateEnd || today(), period_start: row.period_start || dateStart || row.pay_date, period_end: row.period_end || dateEnd || row.pay_date,
        job_type: row.job_type || employee.job_type || '', pay_type: row.pay_type || employee.pay_type || employee.employee_type || 'Hourly', payroll_type: row.payroll_type || employee.payroll_type || 'Check',
        check_number: row.check_number || '', hours: round2(row.hours), rate: num(row.rate) || employeeHourlyRate(employee), regular_hours: round2(row.regular_hours), overtime_hours: round2(row.overtime_hours), regular_pay: round2(resolvedRegularPay(row, employee)), overtime_pay: round2(resolvedOvertimePay(row, employee)),
        credit_card_tips: originalTips(row), original_tips: originalTips(row), total_tips: originalTips(row), tip_deduction: tipWithheld(row), tips_withheld: tipWithheld(row), tips: finalTips(row), final_tips: finalTips(row), tips_after_withheld: finalTips(row),
        extra_pay: round2(row.extra_pay), extra_reason: String(row.extra_reason || '').trim(), notes: String(row.notes || '').trim(),
        total_pay: finalPay({ ...row, regular_pay: resolvedRegularPay(row, employee), overtime_pay: resolvedOvertimePay(row, employee) }, employee), total: finalPay({ ...row, regular_pay: resolvedRegularPay(row, employee), overtime_pay: resolvedOvertimePay(row, employee) }, employee), approval_status: 'Pending', created_at: new Date().toISOString()
      }))
      return {
        ...prev,
        employees: sortByName([...(prev.employees || []), ...newEmployees]),
        payrollEntries: [...created, ...kept],
        payrollImports: [{ id: createId('import'), file_name: sourceFile, period_start: dateStart, period_end: dateEnd, row_count: created.length, created_at: new Date().toISOString() }, ...(prev.payrollImports || [])]
      }
    })
    const createdStart=selected.map(row=>String(row.period_start||row.pay_date||'').slice(0,10)).filter(Boolean).sort()[0]||dateStart
    const createdEnd=selected.map(row=>String(row.period_end||row.pay_date||'').slice(0,10)).filter(Boolean).sort().slice(-1)[0]||dateEnd
    setDateStart(createdStart)
    setDateEnd(createdEnd)
    clearImportWorkspace(`Created payroll for ${selected.length} employees. Import workspace cleared; the new pending rows are ready below for approval.`)
  }

  function approveRows(ids) {
    const visiblePending = filteredHistory.filter(row => !isApproved(row))
    const selectedIds = ids?.length ? ids : visiblePending.map(row => row.id)
    if (!selectedIds.length) return setStatus('No pending payroll rows are available to approve.')
    const approvedAt = new Date().toISOString()
    setData(prev => ({
      ...prev,
      payrollEntries: (prev.payrollEntries || []).map(row => selectedIds.includes(row.id)
        ? { ...row, approval_status: 'Approved', approved_at: approvedAt, total_pay: finalPay(row), total: finalPay(row), original_tips: originalTips(row), credit_card_tips: originalTips(row), total_tips: originalTips(row), tip_deduction: tipWithheld(row), tips_withheld: tipWithheld(row), tips: finalTips(row), final_tips: finalTips(row), tips_after_withheld: finalTips(row) }
        : row)
    }))
    clearImportWorkspace(`Approved ${selectedIds.length} payroll entries. Import workspace cleared; they are now available on the Approved Payroll page.`)
  }

  function updateEntry(id, field, value) {
    setData(prev => ({
      ...prev,
      payrollEntries: (prev.payrollEntries || []).map(row => {
        if (row.id !== id) return row
        const next = { ...row, [field]: value }
        if (field === 'original_tips' || field === 'credit_card_tips' || field === 'tip_deduction') {
          const original = field === 'original_tips' || field === 'credit_card_tips' ? num(value) : originalTips(next)
          const withheld = field === 'tip_deduction' ? num(value) : tipWithheld(next)
          next.credit_card_tips = round2(original)
          next.original_tips = round2(original)
          next.total_tips = round2(original)
          next.tips = round2(Math.max(0, original - withheld))
          next.tips_withheld = round2(withheld)
          next.tips_after_withheld = next.tips
        }
        next.final_tips = finalTips(next)
        next.tips_after_withheld = next.final_tips
        next.tips_withheld = tipWithheld(next)
        next.total_pay = finalPay(next)
        next.total = next.total_pay
        return next
      })
    }))
  }

  function deleteEntry(id) {
    markPayrollDeleted([id])
    setData(prev => ({
      ...prev,
      deletedPayrollIds: Array.from(new Set([...(prev.deletedPayrollIds || []), String(id)])),
      payrollEntries: (prev.payrollEntries || []).filter(row => String(row.id) !== String(id)),
      approvedPayroll: (prev.approvedPayroll || []).filter(row => String(row.id) !== String(id) && String(row.source_payroll_entry_id || '') !== String(id))
    }))
    setStatus('Payroll entry permanently deleted.')
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
      credit_card_tips: tips, original_tips: tips, total_tips: tips, tip_deduction: withheld, tips_withheld: withheld, tips: round2(Math.max(0, tips - withheld)), final_tips: round2(Math.max(0, tips - withheld)), tips_after_withheld: round2(Math.max(0, tips - withheld)),
      extra_pay: round2(manual.extra_pay), extra_reason: manual.extra_reason.trim(), payroll_type: manual.payroll_type,
      check_number: manual.check_number.trim(), notes: manual.notes.trim(), approval_status: 'Pending', created_at: new Date().toISOString()
    }
    row.total_pay = finalPay(row)
    row.total = row.total_pay
    setData(prev => ({ ...prev, payrollEntries: [row, ...(prev.payrollEntries || [])] }))
    setManual(blankManual())
    setShowManual(false)
    setStatus(`Manual payroll added for ${name}.`)
  }

  function exportCsv() {
    const rows = filteredHistory
    if (!rows.length) return setStatus('No payroll rows to export.')
    const headers = ['Status','Period Start','Period End','Pay Date','Employee','Hours','Regular Pay','Overtime Pay','Original Tips','Tips Withheld','Net Tips','Extra Pay','Extra Reason','Payment Method','Check Number','Final Payroll']
    const values = rows.map(row => [isApproved(row) ? 'Approved' : 'Pending', row.period_start || '', row.period_end || '', entryDate(row), row.employee_name || '', money(row.hours), money(resolvedRegularPay(row, employeeForRow(row))), money(row.overtime_pay), money(originalTips(row)), money(tipWithheld(row)), money(finalTips(row)), money(row.extra_pay), row.extra_reason || '', row.payroll_type || '', row.check_number || '', money(finalPay(row, employeeForRow(row)))])
    const csv = [headers, ...values].map(cols => cols.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `payroll-${dateStart || 'all'}-to-${dateEnd || 'all'}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  const builderAllSelected = visibleBuilderRows.length > 0 && visibleBuilderRows.every(row => selectedBuilderIds.includes(row.id))

  return <div className="payroll-rc5-page">
    <div className="page-head payroll-rc5-head">
      <div><h1>Payroll</h1><p>Build employee payroll from Toast, make adjustments, approve, and export.</p></div>
      <div className="payroll-rc5-head-actions">
        <button type="button" className="btn secondary" onClick={() => setShowGroupPayroll(true)}><Icon name="users" /> Kitchen Group Payroll</button>
        <button type="button" className="btn secondary" onClick={() => setShowManual(true)}><Icon name="plus" /> Manual Payroll</button>
        <label className="btn primary payroll-upload-button"><Icon name="upload" /> Upload Toast Labor<input type="file" accept=".csv,.xlsx,.xls" onChange={handleToastFile} /></label>
      </div>
    </div>

    <DateControls start={dateStart} end={dateEnd} onStartChange={setDateStart} onEndChange={setDateEnd} onApply={() => setStatus(`Payroll range set to ${dateStart || 'first record'} through ${dateEnd || 'latest record'}.`)} onPreset={applyPreset} applyLabel="Use Date Range" />

    <section className="payroll-rc5-card payroll-rc5-filter-card">
      <div className="payroll-rc5-actions">
        <label className="payroll-rc5-week-toggle"><input type="checkbox" checked={mergeWeekly} onChange={e => setMergeWeekly(e.target.checked)} /><span><b>Merge into weekly payroll</b><small>One row per employee ending on the selected end date</small></span></label>
        <label className="payroll-rc5-filter-label"><span>Employee Search</span><input value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} placeholder="Type employee name" /></label>
        <label className="payroll-rc5-filter-label"><span>Imported Employee</span><select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} disabled={!importedRows.length}>
          <option value="">All imported employees</option>
          {importedEmployeeOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <button type="button" className="btn secondary" onClick={() => { setEmployeeFilter(''); setEmployeeSearch('') }}>Clear Employee</button>
      </div>
      <small>The employee search and date range filter both the Toast line entries, calculated payroll, summary totals, and payroll register.</small>
    </section>

    <div className="payroll-rc5-status">{status}</div>

    <section className="payroll-rc5-summary payroll-modern-summary">
      <div className="payroll-modern-card tone-blue"><div className="payroll-modern-card-head"><span>Employees</span><span className="payroll-modern-card-icon"><Icon name="users" size={18}/></span></div><strong>{builderRows.length ? visibleBuilderRows.length : historyTotals.employees.size}</strong><small>In selected range</small></div>
      <div className="payroll-modern-card tone-slate"><div className="payroll-modern-card-head"><span>Total Hours</span><span className="payroll-modern-card-icon"><Icon name="history" size={18}/></span></div><strong>{money(builderRows.length ? builderTotals.hours : historyTotals.hours)}</strong><small>Visible payroll rows</small></div>
      <div className="payroll-modern-card tone-purple"><div className="payroll-modern-card-head"><span>Original Tips</span><span className="payroll-modern-card-icon"><Icon name="card" size={18}/></span></div><strong>${money(builderRows.length ? builderTotals.originalTips : historyTotals.originalTips)}</strong><small>Before withholding</small></div>
      <div className="payroll-modern-card tone-red"><div className="payroll-modern-card-head"><span>Withheld</span><span className="payroll-modern-card-icon"><Icon name="shield" size={18}/></span></div><strong>${money(builderRows.length ? builderTotals.withheld : historyTotals.withheld)}</strong><small>Tip deductions</small></div>
      <div className="payroll-modern-card tone-orange"><div className="payroll-modern-card-head"><span>Extra Pay</span><span className="payroll-modern-card-icon"><Icon name="plus" size={18}/></span></div><strong>${money(builderRows.length ? builderTotals.extra : historyTotals.extra)}</strong><small>Additional payroll</small></div>
      <div className="payroll-modern-card tone-green payroll-rc5-final"><div className="payroll-modern-card-head"><span>Final Payroll</span><span className="payroll-modern-card-icon"><Icon name="dollar" size={18}/></span></div><strong>${money(builderRows.length ? builderTotals.final : historyTotals.final)}</strong><small>Selected range total</small></div>
    </section>

    {importedRows.length > 0 && <section className="payroll-rc5-card">
      <div className="payroll-rc5-card-head">
        <div><h2>Toast Labor Line Entries</h2><p>{filteredImportedRows.length} individual entries match the selected employee and date range.</p></div>
      </div>
      <div className="payroll-rc5-table-wrap"><table className="payroll-rc5-table history"><thead><tr><th>Date</th><th>Employee</th><th>Job</th><th>Hours</th><th>Regular Pay</th><th>OT Pay</th><th>Original Tips</th><th>Withheld</th><th>Net Tips</th></tr></thead><tbody>
        {filteredImportedRows.map((row, index) => <tr key={`${row.employee_external_id || row.employee_name}-${row.pay_date}-${index}`}><td>{row.pay_date || '—'}</td><td><b>{displayToastName(row.raw_name || row.employee_name)}</b></td><td>{row.job_type || '—'}</td><td>{money(row.hours)}</td><td>${money(row.regular_pay)}</td><td>${money(row.overtime_pay)}</td><td>${money(row.total_tips)}</td><td>${money(tipWithheld(row))}</td><td>${money(finalTips(row))}</td></tr>)}
        {!filteredImportedRows.length && <tr><td colSpan="9" className="empty-cell">No line entries match this employee and date range.</td></tr>}
      </tbody></table></div>
    </section>}

    {builderRows.length > 0 && <section className="payroll-rc5-card">
      <div className="payroll-rc5-card-head">
        <div><h2>{mergeWeekly ? 'Toast Weekly Payroll Builder' : 'Toast Daily Payroll Builder'}</h2><p>{mergeWeekly ? `One row per employee for each Monday-Sunday payroll week in ${dateStart} through ${dateEnd}. Every row uses Sunday as its week-ending pay date.` : 'One editable row per employee per workday. Multiple shifts on the same day are combined.'}</p></div>
        <div className="payroll-rc5-actions"><button type="button" className="btn secondary" onClick={() => clearImportWorkspace()}>Clear Import</button><button type="button" className="btn primary" onClick={createPayroll}>Create Selected Payroll</button></div>
      </div>
      <div className="payroll-rc5-table-wrap"><table className="payroll-rc5-table"><thead><tr>
        <th><input type="checkbox" checked={builderAllSelected} onChange={toggleAllBuilder} /></th><th>Date</th><th>Employee</th><th>Hours</th><th>Regular</th><th>OT</th><th>Credit Card Tips</th><th>Withheld</th><th>Final Tips</th><th>Extra Pay</th><th>Reason</th><th>Method</th><th>Check #</th><th>Final</th>
      </tr></thead><tbody>{visibleBuilderRows.map(row => <tr key={row.id}>
        <td><input type="checkbox" checked={selectedBuilderIds.includes(row.id)} onChange={() => toggleBuilder(row.id)} /></td>
        <td>{row.pay_date || row.period_start}</td>
        <td><select value={row.employee_id} onChange={e => updateBuilder(row.id, 'employee_id', e.target.value)}><option value="">{row.employee_name} (new)</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select><small>{row.job_type || `${row.source_rows} Toast rows`}</small></td>
        <td><input type="number" step="0.01" value={row.hours} onChange={e => updateBuilder(row.id, 'hours', e.target.value)} /></td>
        <td><input type="number" step="0.01" value={row.regular_pay} onChange={e => updateBuilder(row.id, 'regular_pay', e.target.value)} /></td>
        <td><input type="number" step="0.01" value={row.overtime_pay} onChange={e => updateBuilder(row.id, 'overtime_pay', e.target.value)} /></td>
        <td><input type="number" step="0.01" value={originalTips(row)} onChange={e => updateBuilder(row.id, 'credit_card_tips', e.target.value)} /></td>
        <td><input type="number" step="0.01" value={tipWithheld(row)} onChange={e => updateBuilder(row.id, 'tip_deduction', e.target.value)} /></td>
        <td className="money-positive">${money(finalTips(row))}</td>
        <td><input type="number" step="0.01" value={row.extra_pay} onChange={e => updateBuilder(row.id, 'extra_pay', e.target.value)} /></td>
        <td><input value={row.extra_reason} onChange={e => updateBuilder(row.id, 'extra_reason', e.target.value)} placeholder={num(row.extra_pay) > 0 ? 'Required' : 'Optional'} /></td>
        <td><select value={row.payroll_type} onChange={e => updateBuilder(row.id, 'payroll_type', e.target.value)}>{PAY_METHODS.map(method => <option key={method}>{method}</option>)}</select></td>
        <td><input value={row.check_number} onChange={e => updateBuilder(row.id, 'check_number', e.target.value)} placeholder="Check #" /></td>
        <td className="payroll-rc5-money">${money(finalPay(row, employeeForRow(row)))}</td>
      </tr>)}</tbody></table></div>
    </section>}

    {payrollDiagnostics.rows > 0 && (payrollDiagnostics.missingRegular > 0 || (payrollDiagnostics.tippedRows > 0 && payrollDiagnostics.missingTips === payrollDiagnostics.tippedRows)) && <div className="payroll-rc5-diagnostic">
      <div><b>Payroll source check</b><span>{payrollDiagnostics.unmatched > 0 ? `${payrollDiagnostics.unmatched} row(s) are not matched to an Employee record. ` : ''}{payrollDiagnostics.missingRate > 0 ? `${payrollDiagnostics.missingRate} matched employee(s) have no hourly rate. ` : ''}{payrollDiagnostics.missingRegular > 0 ? `${payrollDiagnostics.missingRegular} row(s) have hours but no wage amount. ` : ''}{payrollDiagnostics.tippedRows > 0 && payrollDiagnostics.missingTips === payrollDiagnostics.tippedRows ? 'The selected Toast data has no credit-card tips. Shifts Closed reports usually contain hours only; import Labor Summary for tips.' : ''}</span></div>
      <button type="button" className="btn secondary" onClick={recalculateSelectedRange}><Icon name="refresh" size={15} /> Recalculate from Employee Rates</button>
    </div>}

    <section className="payroll-rc5-card">
      <div className="payroll-rc5-card-head">
        <div><h2>Payroll Register</h2><p>{filteredHistory.length} entries in the selected range.</p></div>
        <div className="payroll-rc5-actions"><input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Employee, check, method" /><button type="button" className="btn secondary" onClick={exportCsv}><Icon name="download" /> Export CSV</button><button type="button" className="btn success" onClick={() => approveRows()}><Icon name="check" /> Approve Pending</button></div>
      </div>
      <div className="payroll-rc5-table-wrap"><table className="payroll-rc5-table history"><thead><tr><th>Status</th><th>Employee</th><th>Date</th><th>Hours</th><th>Regular</th><th>Credit Card Tips</th><th>Withheld</th><th>Extra Pay</th><th>Reason</th><th>Final Tips</th><th>Method</th><th>Check #</th><th>Final Payroll</th><th></th></tr></thead><tbody>
        {filteredHistory.map(row => { const editable = editingId === row.id && !isApproved(row); return <tr key={row.id}>
          <td><span className={`payroll-rc5-pill ${isApproved(row) ? 'approved' : 'pending'}`}>{isApproved(row) ? 'Approved' : 'Pending'}</span></td>
          <td><b>{row.employee_name}</b><small>{employeeForRow(row)?.id ? `${row.source || row.group_name || 'Payroll'} · $${money(employeeHourlyRate(employeeForRow(row)))} rate` : `${row.source || row.group_name || 'Payroll'} · Unmatched employee`}</small></td>
          <td>{row.period_start || entryDate(row)}<small>{row.period_end && row.period_end !== row.period_start ? `to ${row.period_end}` : ''}</small></td>
          <td>{editable ? <input type="number" value={row.hours} onChange={e => updateEntry(row.id, 'hours', e.target.value)} /> : money(row.hours)}</td>
          <td>{editable ? <input type="number" value={row.regular_pay} onChange={e => updateEntry(row.id, 'regular_pay', e.target.value)} /> : `$${money(resolvedRegularPay(row, employeeForRow(row)))}`}</td>
          <td>{editable ? <input type="number" value={originalTips(row)} onChange={e => updateEntry(row.id, 'credit_card_tips', e.target.value)} /> : `$${money(originalTips(row))}`}</td>
          <td>{editable ? <input type="number" value={tipWithheld(row)} onChange={e => updateEntry(row.id, 'tip_deduction', e.target.value)} /> : `$${money(tipWithheld(row))}`}</td>
          <td>{editable ? <input type="number" value={row.extra_pay} onChange={e => updateEntry(row.id, 'extra_pay', e.target.value)} /> : `$${money(row.extra_pay)}`}</td>
          <td>{editable ? <input value={row.extra_reason || ''} onChange={e => updateEntry(row.id, 'extra_reason', e.target.value)} /> : (row.extra_reason || '—')}</td>
          <td className="money-positive">${money(finalTips(row))}</td>
          <td>{editable ? <select value={row.payroll_type || 'Check'} onChange={e => updateEntry(row.id, 'payroll_type', e.target.value)}>{PAY_METHODS.map(method => <option key={method}>{method}</option>)}</select> : (row.payroll_type || '—')}</td>
          <td>{editable ? <input value={row.check_number || ''} onChange={e => updateEntry(row.id, 'check_number', e.target.value)} /> : (row.check_number || '—')}</td>
          <td className="payroll-rc5-money">${money(finalPay(row, employeeForRow(row)))}</td>
          <td><div className="payroll-rc5-row-actions">{!isApproved(row) && <button type="button" onClick={() => setEditingId(editable ? '' : row.id)} title={editable ? 'Done' : 'Edit'}><Icon name={editable ? 'check' : 'edit'} size={14} /></button>}<button type="button" className="delete" onClick={() => deleteEntry(row.id)} title="Delete"><Icon name="trash" size={14} /></button></div></td>
        </tr> })}
        {!filteredHistory.length && <tr><td colSpan="14" className="empty-cell">No payroll entries in this date range.</td></tr>}
      </tbody></table></div>
    </section>

    {showGroupPayroll && <div className="payroll-rc5-overlay" onClick={() => setShowGroupPayroll(false)}><section className="payroll-rc5-modal payroll-rc5-group-modal" onClick={e => e.stopPropagation()}>
      <header><div><h2>Kitchen Manual Payroll Group</h2><p>Create one manual payroll entry for every kitchen employee.</p></div><button type="button" onClick={() => setShowGroupPayroll(false)}>×</button></header>
      <div className="payroll-rc5-group-toolbar">
        <label>Payroll Group<select value={selectedGroupId} onChange={e => { setSelectedGroupId(e.target.value); setGroupAdjustments({}) }}><option value="kitchen-auto">Kitchen Employees (automatic)</option>{payrollGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label>Period Start<input type="date" value={groupPeriodStart} onClick={openDatePicker} onFocus={openDatePicker} onChange={e => setGroupPeriodStart(e.target.value)} /></label>
        <label>Period End<input type="date" value={groupPeriodEnd} onClick={openDatePicker} onFocus={openDatePicker} onChange={e => setGroupPeriodEnd(e.target.value)} /></label>
        <label>Pay Date<input type="date" value={groupPayDate} onClick={openDatePicker} onFocus={openDatePicker} onChange={e => setGroupPayDate(e.target.value)} /></label>
        <label>Search Employee<input value={groupEmployeeSearch} onChange={e => setGroupEmployeeSearch(e.target.value)} placeholder="Kitchen employee name" /></label>
      </div>
      <div className="payroll-rc5-table-wrap"><table className="payroll-rc5-table"><thead><tr><th>Employee</th><th>Job</th><th>Regular Pay</th><th>Extra Pay</th><th>Reason</th><th>Method</th><th>Check #</th><th>Final</th></tr></thead><tbody>
        {groupMembers.map(employee => <tr key={employee.id}><td><b>{employee.name}</b></td><td>{employee.job_type || employee.employee_type || 'Kitchen'}</td><td><input type="number" step="0.01" value={groupValue(employee, 'regular_pay')} onChange={e => updateGroupAdjustment(employee.id, 'regular_pay', e.target.value)} /></td><td><input type="number" step="0.01" value={groupValue(employee, 'extra_pay')} onChange={e => updateGroupAdjustment(employee.id, 'extra_pay', e.target.value)} /></td><td><input value={groupValue(employee, 'extra_reason')} onChange={e => updateGroupAdjustment(employee.id, 'extra_reason', e.target.value)} placeholder={num(groupValue(employee, 'extra_pay')) > 0 ? 'Required' : 'Optional'} /></td><td><select value={groupValue(employee, 'payroll_type')} onChange={e => updateGroupAdjustment(employee.id, 'payroll_type', e.target.value)}>{PAY_METHODS.map(method => <option key={method}>{method}</option>)}</select></td><td><input value={groupValue(employee, 'check_number')} onChange={e => updateGroupAdjustment(employee.id, 'check_number', e.target.value)} /></td><td className="payroll-rc5-money">${money(num(groupValue(employee, 'regular_pay')) + num(groupValue(employee, 'extra_pay')))}</td></tr>)}
        {!groupMembers.length && <tr><td colSpan="8" className="empty-cell">No kitchen employees match this group/search.</td></tr>}
      </tbody></table></div>
      <footer><button type="button" className="btn secondary" onClick={() => setShowGroupPayroll(false)}>Cancel</button><button type="button" className="btn primary" onClick={createGroupPayroll}>Create Kitchen Group Payroll</button></footer>
    </section></div>}

    {showManual && <div className="payroll-rc5-overlay" onClick={() => setShowManual(false)}><section className="payroll-rc5-modal" onClick={e => e.stopPropagation()}>
      <header><div><h2>Add Manual Payroll</h2><p>Add one employee or open group payroll without a Toast import.</p></div><button type="button" onClick={() => setShowManual(false)}>×</button></header>
      <div className="payroll-rc5-modal-switch"><button type="button" className="btn secondary" onClick={() => { setShowManual(false); setShowGroupPayroll(true) }}><Icon name="users" /> Add Group Payroll</button></div>
      <div className="payroll-rc5-form">
        <label>Employee<select value={manual.employee_id} onChange={e => setManual(value => ({ ...value, employee_id: e.target.value }))}><option value="">Enter manual name</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        <label>Manual Name<input value={manual.employee_name} onChange={e => setManual(value => ({ ...value, employee_name: e.target.value }))} /></label>
        <label>Period Start<input type="date" value={manual.period_start} onClick={openDatePicker} onFocus={openDatePicker} onChange={e => setManual(value => ({ ...value, period_start: e.target.value }))} /></label>
        <label>Period End<input type="date" value={manual.period_end} onClick={openDatePicker} onFocus={openDatePicker} onChange={e => setManual(value => ({ ...value, period_end: e.target.value }))} /></label>
        <label>Pay Date<input type="date" value={manual.pay_date} onClick={openDatePicker} onFocus={openDatePicker} onChange={e => setManual(value => ({ ...value, pay_date: e.target.value }))} /></label>
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
      <footer><button type="button" className="btn secondary" onClick={() => setShowManual(false)}>Cancel</button><button type="button" className="btn primary" onClick={saveManual}>Add Payroll</button></footer>
    </section></div>}
  </div>
}
