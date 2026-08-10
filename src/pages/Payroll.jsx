import { useEffect, useMemo, useState } from 'react'
import {
  Banknote, CalendarRange, ChefHat, ChevronDown, ChevronLeft, ChevronRight, Clock3, Copy,
  Edit2, Eye, FileUp, Filter, Plus, Save, Search, Trash2, Users, WalletCards
} from 'lucide-react'
import DateToolbar from '../components/DateToolbar'
import DetailDrawer from '../components/DetailDrawer'
import Modal from '../components/Modal'
import ToastReportImport from '../components/ToastReportImport'
import { formatMoney, summarizePayroll, toPayrollViewRow } from '../core/adapters/payrollAdapter.js'
import { normalizePayrollRecord, normalizePayrollRecords } from '../core/adapters/payrollSchemaAdapter.js'
import { buildKitchenWeeklyPayroll, buildWeeklyPayroll, endOfPayrollWeek, isMondayToSunday, startOfPayrollWeek } from '../core/engines/WeeklyPayrollEngine.js'
import usePersistentState from '../hooks/usePersistentState'
import { useFeedback } from '../components/AppFeedback'
import useGlobalDateRange, { inDateRange } from '../hooks/useGlobalDateRange'

const emptyForm = {
  employee_name:'', pay_date:new Date().toISOString().slice(0,10), job_type:'Kitchen', hours:'', regular_pay:'',
  credit_card_tips:'', tip_deduction:'', tips_after_withholding:'', extra_pay:'', extra_reason:'',
  payment_method:'Cash', check_number:'', ach_reference:'', payment_status:'Draft', payment_date:'',
  payroll_week_start:'', payroll_week_end:'', group_name:'', notes:''
}

export default function Payroll(){
  const [query,setQuery] = useState('')
  const [method,setMethod] = useState('All Methods')
  const [drawer,setDrawer] = useState(null)
  const [manual,setManual] = useState(false)
  const [paymentOpen,setPaymentOpen] = useState(false)
  const [paymentId,setPaymentId] = useState(null)
  const [paymentForm,setPaymentForm] = useState({payment_method:'Check',check_number:'',ach_reference:'',payment_date:new Date().toISOString().slice(0,10),payment_status:'Paid',notes:''})
  const [editingId,setEditingId] = useState(null)
  const [savingPayroll,setSavingPayroll] = useState(false)
  const [importOpen,setImportOpen] = useState(false)
  const [kitchenOpen,setKitchenOpen] = useState(false)
  const [kitchenWeekOpen,setKitchenWeekOpen] = useState(false)
  const [kitchenWeekStart,setKitchenWeekStart] = useState(() => startOfPayrollWeek(new Date().toISOString().slice(0,10)))
  const [kitchenWeekEnd,setKitchenWeekEnd] = useState(() => endOfPayrollWeek(new Date().toISOString().slice(0,10)))
  const [kitchenWeekGroupId,setKitchenWeekGroupId] = useState('')
  const [selectedKitchenEmployeeIds,setSelectedKitchenEmployeeIds] = useState([])
  const [savingKitchenPayroll,setSavingKitchenPayroll] = useState(false)
  const [weekOpen,setWeekOpen] = useState(false)
  const [weekStart,setWeekStart] = useState(() => startOfPayrollWeek(new Date().toISOString().slice(0,10)))
  const [weekEnd,setWeekEnd] = useState(() => endOfPayrollWeek(new Date().toISOString().slice(0,10)))
  const [selectedWeeklyEmployees,setSelectedWeeklyEmployees] = useState([])
  const [activeTab,setActiveTab] = useState('Imported Labor')
  const [groupType,setGroupType] = useState('Kitchen')
  const [selectedEmployees,setSelectedEmployees] = useState([])
  const [groupName,setGroupName] = useState('Kitchen Payroll')
  const [editingGroupId,setEditingGroupId] = useState(null)
  const [selectedRowIds,setSelectedRowIds] = useState([])
  const [bulkAction,setBulkAction] = useState('')
  const [page,setPage] = useState(1)
  const [pageSize,setPageSize] = useState(25)
  const [sourceRows,setSourceRows] = usePersistentState('restapay-payroll', [])
  const [employees] = usePersistentState('restapay-employees', [])
  const [groups,setGroups] = usePersistentState('restapay-payroll-groups', [])
  const [manualForm,setManualForm] = useState(emptyForm)
  const { notify } = useFeedback()
  const { range, apply: applyGlobalDateRange } = useGlobalDateRange()
  const allSourceRows = useMemo(() => Array.isArray(sourceRows) ? sourceRows.filter(Boolean) : [], [sourceRows])
  const scopedSourceRows = useMemo(() => allSourceRows.filter(row => inDateRange(row, range, ['pay_date','payroll_date','date'])), [allSourceRows, range])
  const safeGroups = Array.isArray(groups) ? groups.filter(Boolean) : []

  const importedRows = useMemo(() => scopedSourceRows.filter(row => !row.weekly_rollup && String(row.source || '').toLowerCase() === 'toast'), [scopedSourceRows])
  const manualRows = useMemo(() => scopedSourceRows.filter(row => !row.weekly_rollup && String(row.source || '').toLowerCase() !== 'toast'), [scopedSourceRows])
  const readyRows = useMemo(() => scopedSourceRows.filter(row => {
    const status=String(row.payment_status || 'Draft').trim().toLowerCase()
    if (status === 'paid' || status === 'void') return false
    return Boolean(row.weekly_rollup) || ['ready','ready to pay','approved','pending'].includes(status)
  }), [scopedSourceRows])
  const paidRows = useMemo(() => allSourceRows.filter(row => String(row.payment_status || '').trim().toLowerCase() === 'paid'), [allSourceRows])
  const payableRows = useMemo(() => [...new Map([...readyRows, ...paidRows, ...manualRows].map(row => [row.id, row])).values()], [readyRows, paidRows, manualRows])
  const rows = useMemo(() => payableRows.map(toPayrollViewRow), [payableRows])
  const payrollSummary = useMemo(() => summarizePayroll(payableRows), [payableRows])
  const cards = useMemo(() => [
    {title:'Payroll Total',value:formatMoney(payrollSummary.total),meta:'Calculated payroll total',tone:'blue',icon:WalletCards},
    {title:'Cash Payroll',value:formatMoney(payrollSummary.cash),meta:'Cash payment employees',tone:'green',icon:Banknote},
    {title:'Check Payroll',value:formatMoney(payrollSummary.check),meta:'Check payment employees',tone:'purple',icon:Users},
    {title:'Total Hours',value:payrollSummary.hours.toFixed(1),meta:'Imported and manual labor',tone:'orange',icon:Clock3},
  ], [payrollSummary])

  const tabRows = useMemo(() => {
    if (activeTab === 'Imported Labor') return importedRows.map(toPayrollViewRow)
    if (activeTab === 'Ready to Pay') return readyRows.map(toPayrollViewRow)
    if (activeTab === 'Payroll History') return paidRows.map(toPayrollViewRow)
    if (activeTab === 'Manual Labor') return manualRows.map(toPayrollViewRow)
    if (activeTab === 'Kitchen') return [...readyRows, ...paidRows, ...manualRows].filter(r => /kitchen|cook|prep|dishwasher|busser/i.test(r.job_type || r.job)).map(toPayrollViewRow)
    return []
  }, [importedRows, readyRows, paidRows, manualRows, activeTab])

  const filtered = useMemo(() => tabRows.filter(r =>
    (!query || Object.values(r).join(' ').toLowerCase().includes(query.toLowerCase())) &&
    (method === 'All Methods' || r.method === method)
  ), [tabRows, query, method])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pagedRows = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize])
  useEffect(() => { setPage(1) }, [activeTab, query, method, pageSize])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const manualTipWithheld = Math.round(Number(manualForm.credit_card_tips || 0) * 0.035 * 100) / 100
  const manualNetTips = Math.round((Number(manualForm.credit_card_tips || 0) - manualTipWithheld) * 100) / 100

  const activeEmployees = useMemo(() => (Array.isArray(employees) ? employees : []).filter(employee => employee && employee.id && employee.status !== 'Inactive' && employee.active !== false && employee.is_active !== false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))), [employees])
  const kitchenGroups = useMemo(() => safeGroups.filter(group => /kitchen|cook|prep|dishwasher|busser/i.test(String(group.type || group.group_type || group.name || ''))), [safeGroups])
  const selectedKitchenGroup = useMemo(() => kitchenGroups.find(group => String(group.id) === String(kitchenWeekGroupId)) || null, [kitchenGroups, kitchenWeekGroupId])
  const kitchenEligibleEmployees = useMemo(() => {
    const memberIds = new Set((selectedKitchenGroup?.memberIds || selectedKitchenGroup?.member_ids || []).map(String))
    if (memberIds.size) return activeEmployees.filter(employee => memberIds.has(String(employee.id)))
    return activeEmployees.filter(employee => /kitchen|cook|chef|prep|dishwasher|busser/i.test(String(employee.job || employee.job_type || '')))
  }, [activeEmployees, selectedKitchenGroup])
  const filteredRowIds = useMemo(() => pagedRows.map(row => row.id).filter(Boolean), [pagedRows])
  const allVisibleSelected = filteredRowIds.length > 0 && filteredRowIds.every(id => selectedRowIds.includes(id))
  const toggleSelectedRow = id => setSelectedRowIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids,id])
  const toggleAllVisible = () => setSelectedRowIds(ids => allVisibleSelected ? ids.filter(id => !filteredRowIds.includes(id)) : [...new Set([...ids,...filteredRowIds])])

  const importPayroll = ({ rows: importedRows }) => {
    const normalized = normalizePayrollRecords(importedRows, { source:'toast', method:'Check' })
      .filter(row => row.employee_name)
    if (!normalized.length) return notify('No recognizable Toast payroll rows were found.', 'error')
    const sourceFile = normalized[0]?.source_file
    setSourceRows(items => sourceFile ? [...normalized, ...items.filter(item => item.source_file !== sourceFile)] : [...normalized, ...items])
    notify(`${normalized.length} Toast payroll records imported.`)
  }

  const openAdd = () => {
    setEditingId(null)
    setManualForm(emptyForm)
    setManual(true)
  }

  const openEdit = raw => {
    setEditingId(raw.id)
    setManualForm({
      ...emptyForm,
      ...raw,
      hours:String(raw.hours ?? ''), regular_pay:String(raw.regular_pay ?? ''),
      credit_card_tips:String(raw.credit_card_tips ?? raw.original_tips ?? ''),
      tip_deduction:String(raw.tip_deduction ?? raw.tips_withheld ?? ''),
      tips_after_withholding:String(raw.tips_after_withholding ?? raw.tips_after_withheld ?? ''),
      extra_pay:String(raw.extra_pay ?? ''), payment_status:raw.payment_status || 'Draft',
      payment_date:raw.payment_date || '', ach_reference:raw.ach_reference || '',
      payroll_week_start:raw.payroll_week_start || '', payroll_week_end:raw.payroll_week_end || '',
      group_name:raw.group_name || ''
    })
    setManual(true)
  }

  const saveManual = async () => {
    if (!manualForm.employee_name.trim()) return notify('Employee name is required.', 'error')
    const tips=Number(manualForm.credit_card_tips||0)
    const withheld = Math.round(tips * 0.035 * 100) / 100
    const netTips = Math.round((tips - withheld) * 100) / 100
    const manualStatus=String(manualForm.payment_status || 'Draft').trim()
    const paidNow=manualStatus.toLowerCase() === 'paid'
    const changedAt=new Date().toISOString()
    const record=normalizePayrollRecord({
      ...manualForm,
      id: editingId || crypto.randomUUID?.() || String(Date.now()),
      source: manualForm.source || 'manual',
      hours:Number(manualForm.hours||0), regular_pay:Number(manualForm.regular_pay||0),
      credit_card_tips:tips, tip_deduction:withheld, tips_after_withheld:netTips,
      extra_pay:Number(manualForm.extra_pay||0),
      total:Number(manualForm.regular_pay||0)+netTips+Number(manualForm.extra_pay||0),
      payment_status:manualStatus,
      ...(paidNow ? {
        payment_date:manualForm.payment_date || changedAt.slice(0,10),
        paid_history:true,
        paid_at:manualForm.paid_at || changedAt,
        status_updated_at:changedAt,
        status_updated_via:'manual-save'
      } : {})
    })
    try {
      await setSourceRows(prev => editingId ? prev.map(item => item.id===editingId ? record : item) : [record,...prev])
      const status=String(record.payment_status || 'Draft').trim().toLowerCase()
      const savedDate=record.payroll_date || record.pay_date
      if (savedDate && !inDateRange(record, range, ['pay_date','payroll_date','date'])) {
        applyGlobalDateRange({
          preset:'custom',
          from:range?.from && range.from < savedDate ? range.from : savedDate,
          to:range?.to && range.to > savedDate ? range.to : savedDate
        })
      }
      setActiveTab(status === 'paid' ? 'Payroll History' : ['ready','ready to pay','approved','pending'].includes(status) ? 'Ready to Pay' : 'Manual Labor')
      notify(editingId ? 'Payroll entry updated and saved to Supabase.' : 'Manual payroll entry saved to Supabase.')
      setManual(false)
    } catch (error) {
      notify(`Payroll save failed: ${error?.message || 'Unable to save to Supabase.'}`, 'error')
    }
  }

  const removeRow = raw => {
    if (!window.confirm(`Delete payroll entry for ${raw.employee_name || raw.employee}?`)) return
    setSourceRows(prev => {
      const sourceIds = new Set(raw.source_ids || [])
      return prev.filter(item => item.id !== raw.id).map(item => sourceIds.has(item.id)
        ? { ...item, payroll_status:'', included_in_weekly_end:'' }
        : item)
    })
    notify(raw.weekly_rollup ? 'Weekly payroll deleted and daily entries restored.' : 'Payroll entry deleted.')
  }

  const duplicateRow = raw => {
    const copy={...raw,id:crypto.randomUUID?.() || String(Date.now()),pay_date:new Date().toISOString().slice(0,10),source:'manual'}
    setSourceRows(prev => [copy,...prev])
    notify('Payroll entry duplicated.')
  }

  const openPayment = raw => {
    setPaymentId(raw.id)
    setPaymentForm({
      payment_method:raw.payment_method || raw.method || 'Check',
      check_number:raw.check_number || '', ach_reference:raw.ach_reference || '',
      payment_date:raw.payment_date || new Date().toISOString().slice(0,10),
      payment_status:raw.payment_status || 'Paid', notes:raw.payment_notes || raw.notes || ''
    })
    setPaymentOpen(true)
  }

  const savePayment = async () => {
    if (!paymentId) return
    if (paymentForm.payment_method === 'Check' && !paymentForm.check_number.trim()) return notify('Enter a check number.', 'error')
    if (paymentForm.payment_method === 'ACH' && !paymentForm.ach_reference.trim()) return notify('Enter an ACH reference.', 'error')
    try {
      await setSourceRows(prev => prev.map(row => row.id === paymentId ? {
      ...row, method:paymentForm.payment_method, payment_method:paymentForm.payment_method,
      check_number:paymentForm.payment_method === 'Check' ? paymentForm.check_number : '',
      ach_reference:paymentForm.payment_method === 'ACH' ? paymentForm.ach_reference : '',
      payment_date:paymentForm.payment_date, payment_status:paymentForm.payment_status,
      payment_notes:paymentForm.notes, paid_history:paymentForm.payment_status === 'Paid',
      paid_at:paymentForm.payment_status === 'Paid' ? (row.paid_at || new Date().toISOString()) : row.paid_at,
      status_updated_at:new Date().toISOString(), status_updated_via:'single-payment', updated_at:new Date().toISOString()
      } : row))
      setPaymentOpen(false)
      setActiveTab(paymentForm.payment_status === 'Paid' ? 'Payroll History' : 'Ready to Pay')
      notify(paymentForm.payment_status === 'Paid' ? 'Payroll payment recorded in Supabase.' : 'Payroll payment draft saved to Supabase.')
    } catch (error) {
      notify(`Payroll payment save failed: ${error?.message || 'Unable to save to Supabase.'}`, 'error')
    }
  }


  const openKitchenWeeklyBuilder = () => {
    const defaultGroup = kitchenGroups[0] || null
    const start = isMondayToSunday(range?.from, range?.to) ? range.from : startOfPayrollWeek(range?.to || new Date().toISOString().slice(0,10))
    const end = isMondayToSunday(range?.from, range?.to) ? range.to : endOfPayrollWeek(start)
    setKitchenWeekStart(start)
    setKitchenWeekEnd(end)
    setKitchenWeekGroupId(defaultGroup?.id || '')
    const memberIds = new Set((defaultGroup?.memberIds || defaultGroup?.member_ids || []).map(String))
    const eligible = memberIds.size
      ? activeEmployees.filter(employee => memberIds.has(String(employee.id)))
      : activeEmployees.filter(employee => /kitchen|cook|chef|prep|dishwasher|busser/i.test(String(employee.job || employee.job_type || '')))
    setSelectedKitchenEmployeeIds(eligible.map(employee => employee.id))
    setKitchenWeekOpen(true)
  }

  useEffect(() => {
    if (!kitchenWeekOpen) return
    const validIds = kitchenEligibleEmployees.map(employee => employee.id)
    setSelectedKitchenEmployeeIds(previous => {
      const stillValid = previous.filter(id => validIds.includes(id))
      return stillValid.length ? stillValid : validIds
    })
  }, [kitchenWeekOpen, kitchenWeekGroupId, kitchenEligibleEmployees.map(employee => employee.id).join('|')])

  const kitchenWeeklyPreview = useMemo(() => {
    if (!isMondayToSunday(kitchenWeekStart, kitchenWeekEnd)) return []
    try {
      return buildKitchenWeeklyPayroll(kitchenEligibleEmployees, {
        start:kitchenWeekStart,
        end:kitchenWeekEnd,
        selectedEmployeeIds:selectedKitchenEmployeeIds,
        groupId:selectedKitchenGroup?.id || null,
        groupName:selectedKitchenGroup?.name || 'Kitchen Payroll'
      })
    } catch { return [] }
  }, [kitchenEligibleEmployees, kitchenWeekStart, kitchenWeekEnd, selectedKitchenEmployeeIds, selectedKitchenGroup])

  const createKitchenWeeklyPayroll = async () => {
    if (!isMondayToSunday(kitchenWeekStart, kitchenWeekEnd)) return notify('Select a Monday through Sunday kitchen payroll range.', 'error')
    if (!selectedKitchenEmployeeIds.length) return notify('Select at least one kitchen employee.', 'error')
    let weeklyRows
    try {
      weeklyRows = buildKitchenWeeklyPayroll(kitchenEligibleEmployees, {
        start:kitchenWeekStart,
        end:kitchenWeekEnd,
        selectedEmployeeIds:selectedKitchenEmployeeIds,
        groupId:selectedKitchenGroup?.id || null,
        groupName:selectedKitchenGroup?.name || 'Kitchen Payroll'
      })
    } catch (error) { return notify(error.message, 'error') }
    if (!weeklyRows.length) return notify('No active kitchen employees were found for this payroll.', 'error')
    try {
      setSavingKitchenPayroll(true)
      await setSourceRows(previous => {
        const kitchenSelectedIdsSet = new Set(selectedKitchenEmployeeIds.map(String))
        const withoutExistingKitchenWeek = previous.filter(row => !(
          row.weekly_rollup &&
          String(row.source || '').toLowerCase() === 'kitchen-weekly' &&
          (row.payroll_week_end || row.week_end) === kitchenWeekEnd &&
          kitchenSelectedIdsSet.has(String(row.employee_id || ''))
        ))
        const normalized = weeklyRows.map(row => normalizePayrollRecord({
          ...row,
          payment_status:'Draft', payment_date:'', check_number:'', ach_reference:'',
          week_start:kitchenWeekStart, week_end:kitchenWeekEnd,
          payroll_week_start:kitchenWeekStart, payroll_week_end:kitchenWeekEnd
        }, { source:'kitchen-weekly', method:row.method || 'Cash' }))
        return [...normalized, ...withoutExistingKitchenWeek]
      })
      setKitchenWeekOpen(false)
      setActiveTab('Ready to Pay')
      notify(`${weeklyRows.length} kitchen payroll records created and saved to Supabase for week ending ${kitchenWeekEnd}.`)
    } catch (error) {
      notify(`Kitchen payroll save failed: ${error?.message || 'Unable to save to Supabase.'}`, 'error')
    } finally {
      setSavingKitchenPayroll(false)
    }
  }

  const availablePayrollWeeks = useMemo(() => {
    const weeks = new Map()
    sourceRows.forEach(row => {
      if (row.weekly_rollup) return
      const rawDate = row.payroll_date || row.pay_date || row.date || row.period_end || row.period_start
      const start = startOfPayrollWeek(rawDate)
      const end = endOfPayrollWeek(rawDate)
      if (!start || !end) return
      const key = `${start}|${end}`
      const existing = weeks.get(key) || { start, end, count:0, employees:new Set() }
      existing.count += 1
      if (row.employee_name || row.employee) existing.employees.add(row.employee_name || row.employee)
      weeks.set(key, existing)
    })
    return [...weeks.values()]
      .map(item => ({ ...item, employeeCount:item.employees.size }))
      .sort((a,b) => b.end.localeCompare(a.end))
  }, [sourceRows])

  const importedEmployeeNames = useMemo(() => [...new Set(sourceRows
    .filter(row => !row.weekly_rollup)
    .map(row => String(row.employee_name || row.employee || '').trim())
    .filter(Boolean))].sort(), [sourceRows])

  const openWeeklyBuilder = () => {
    const latest = availablePayrollWeeks[0]
    if (latest) {
      setWeekStart(latest.start)
      setWeekEnd(latest.end)
    }
    setSelectedWeeklyEmployees([])
    setWeekOpen(true)
  }


  const weeklySourceRows = useMemo(() => sourceRows
    .filter(row => !(row.weekly_rollup && row.payroll_week_end === weekEnd))
    .map(row => row.included_in_weekly_end === weekEnd ? { ...row, payroll_status:'' } : row), [sourceRows, weekEnd])

  const weeklyAllPreview = useMemo(() => {
    if (!isMondayToSunday(weekStart, weekEnd)) return []
    try { return buildWeeklyPayroll(weeklySourceRows, { start:weekStart, end:weekEnd }) }
    catch { return [] }
  }, [weeklySourceRows, weekStart, weekEnd])

  const weeklyEmployeeNames = useMemo(() => weeklyAllPreview.map(row => row.employee_name), [weeklyAllPreview])

  useEffect(() => {
    if (!weekOpen) return
    setSelectedWeeklyEmployees(previous => {
      const stillValid = previous.filter(name => weeklyEmployeeNames.includes(name))
      return stillValid.length ? stillValid : weeklyEmployeeNames
    })
  }, [weekOpen, weeklyEmployeeNames.join('|')])

  const weeklyPreview = useMemo(() => weeklyAllPreview.filter(row => selectedWeeklyEmployees.includes(row.employee_name)), [weeklyAllPreview, selectedWeeklyEmployees])

  const createWeeklyPayroll = async () => {
    if (!isMondayToSunday(weekStart, weekEnd)) return notify('Select a Monday through Sunday payroll range.', 'error')
    let weeklyRows
    try { weeklyRows = buildWeeklyPayroll(weeklySourceRows, { start:weekStart, end:weekEnd }).filter(row => selectedWeeklyEmployees.includes(row.employee_name)) }
    catch (error) { return notify(error.message, 'error') }
    if (!weeklyAllPreview.length) return notify('No daily payroll entries were found in this week.', 'error')
    if (!weeklyRows.length) return notify('Select at least one employee for weekly payroll.', 'error')
    const sourceIds = new Set(weeklyRows.flatMap(row => row.source_ids || []))
    try {
      setSavingPayroll(true)
      await setSourceRows(previous => {
      const withoutExistingWeek = previous.filter(row => !(row.weekly_rollup && String(row.source || '').toLowerCase() !== 'kitchen-weekly' && (row.payroll_week_end || row.week_end) === weekEnd))
      const marked = withoutExistingWeek.map(row => sourceIds.has(row.id)
        ? { ...row, payroll_status:'rolled-up', included_in_weekly_end:weekEnd }
        : row)
      return [...weeklyRows.map(row => normalizePayrollRecord({...row,payment_status:'Draft',payment_date:'',check_number:'',ach_reference:''}, { source:'weekly-rollup', method:'Check' })), ...marked]
      })
      setWeekOpen(false)
      setActiveTab('Ready to Pay')
      notify(`${weeklyRows.length} employee payroll records created and saved to Supabase for week ending ${weekEnd}.`)
    } catch (error) {
      notify(`Weekly payroll save failed: ${error?.message || 'Unable to save to Supabase.'}`, 'error')
    } finally {
      setSavingPayroll(false)
    }
  }


  const prepareNextPayrollWeek = (baseRows = readyRows) => {
    const weekEnds = baseRows.map(row => row.payroll_week_end || row.week_end || row.pay_date || row.payroll_date).filter(Boolean).sort()
    const lastEnd = weekEnds.at(-1)
    if (!lastEnd) return false
    const startDate = new Date(`${lastEnd}T12:00:00`)
    if (Number.isNaN(startDate.getTime())) return false
    startDate.setDate(startDate.getDate() + 1)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 6)
    const nextStart = startDate.toISOString().slice(0,10)
    const nextEnd = endDate.toISOString().slice(0,10)
    const duplicate = allSourceRows.some(row => row.weekly_rollup && (row.payroll_week_end || row.week_end) === nextEnd && String(row.source || '').toLowerCase() !== 'kitchen-weekly')
    setWeekStart(nextStart)
    setWeekEnd(nextEnd)
    setSelectedWeeklyEmployees([])
    if (!duplicate) setWeekOpen(true)
    return !duplicate
  }

  const saveReadyPayroll = async () => {
    if (!readyRows.length) return notify('There is no weekly payroll waiting to be saved.', 'error')
    try {
      setSavingPayroll(true)
      const rowsBeingSaved = [...readyRows]
      await setSourceRows(sourceRows)
      const prepared = prepareNextPayrollWeek(rowsBeingSaved)
      notify(prepared ? `${readyRows.length} ready-to-pay payroll records saved. Next payroll week prepared automatically.` : `${readyRows.length} ready-to-pay payroll records saved to Supabase.`)
    } catch (error) {
      notify(`Payroll save failed: ${error?.message || 'Unable to save to Supabase.'}`, 'error')
    } finally {
      setSavingPayroll(false)
    }
  }

  const openGroupBuilder = (group=null) => {
    if (group) {
      setEditingGroupId(group.id)
      setGroupType(group.type || group.group_type || 'Kitchen')
      setGroupName(group.name || `${group.type || 'Kitchen'} Payroll`)
      const memberIds = Array.isArray(group.memberIds) ? group.memberIds : Array.isArray(group.member_ids) ? group.member_ids : []
      const legacyNames = Array.isArray(group.employees) ? group.employees : []
      setSelectedEmployees(memberIds.length ? memberIds : activeEmployees.filter(employee => legacyNames.includes(employee.name)).map(employee => employee.id))
    } else {
      setEditingGroupId(null)
      setGroupType('Kitchen')
      setGroupName('Kitchen Payroll')
      setSelectedEmployees([])
    }
    setKitchenOpen(true)
  }

  const addKitchen = async () => {
    if (!groupName.trim()) return notify('Payroll group name is required.', 'error')
    if (!selectedEmployees.length) return notify('Select at least one saved employee.', 'error')
    const group={id:editingGroupId || crypto.randomUUID?.() || String(Date.now()),name:groupName.trim(),type:groupType,memberIds:selectedEmployees}
    try {
      await setGroups(prev=>editingGroupId ? prev.map(item=>item.id===editingGroupId?{...item,...group}:item) : [group,...prev])
      notify(`${groupName.trim()} saved with ${selectedEmployees.length} employee${selectedEmployees.length===1?'':'s'}.`)
      setKitchenOpen(false)
    } catch (error) {
      notify(error?.message || 'Payroll group could not be saved.', 'error')
    }
  }

  const applyBulkAction = async () => {
    if (!selectedRowIds.length || !bulkAction) return
    const count=selectedRowIds.length
    if (!window.confirm(`Change ${count} selected payroll entr${count===1?'y':'ies'} to ${bulkAction}?`)) return
    const selectedSet=new Set(selectedRowIds)
    const changedAt=new Date().toISOString()
    const paymentDate=changedAt.slice(0,10)
    try {
      await setSourceRows(prev => prev.map(row => selectedSet.has(row.id) ? {
        ...row,
        payment_status:bulkAction,
        ...(bulkAction === 'Paid' ? {payment_date:row.payment_date || paymentDate, paid_history:true, paid_at:row.paid_at || changedAt} : {}),
        status_updated_at:changedAt, status_updated_via:'bulk-action', updated_at:changedAt
      } : row))
      setSelectedRowIds([])
      setBulkAction('')
      if (bulkAction === 'Paid') setActiveTab('Payroll History')
      notify(`${count} payroll entr${count===1?'y':'ies'} changed to ${bulkAction}.`)
    } catch (error) {
      notify(error?.message || 'Selected payroll statuses could not be updated.', 'error')
    }
  }

  const bulkDeleteRows = async () => {
    if (!selectedRowIds.length) return
    const count=selectedRowIds.length
    if (!window.confirm(`Delete ${count} selected payroll entr${count===1?'y':'ies'}?`)) return
    const selectedSet=new Set(selectedRowIds)
    try {
      await setSourceRows(prev => {
        const selected = prev.filter(item => selectedSet.has(item.id))
        const restoreIds = new Set(selected.flatMap(item => item.weekly_rollup ? (item.source_ids || []) : []))
        return prev.filter(item => !selectedSet.has(item.id)).map(item => restoreIds.has(item.id) ? {...item,payroll_status:'',included_in_weekly_end:''} : item)
      })
      setSelectedRowIds([])
      notify(`${count} payroll entr${count===1?'y':'ies'} deleted from Supabase.`)
    } catch (error) {
      notify(error?.message || 'Selected payroll entries could not be deleted.', 'error')
    }
  }

  const deleteGroup = id => {
    if (!window.confirm('Delete this payroll group?')) return
    setGroups(prev=>prev.filter(group=>group.id!==id))
    notify('Payroll group deleted.')
  }

  return <div className="records-page payroll-page">
    <DateToolbar />

    <section className="records-kpi-grid">
      {cards.map(({title,value,meta,tone,icon:Icon}) =>
        <button key={title} className={`records-kpi tone-${tone}`} onClick={() => setDrawer(title)}>
          <span className="records-kpi-icon"><Icon size={22}/></span>
          <span className="records-kpi-copy"><strong>{title}</strong><b>{value}</b><small>{meta}</small></span>
          <ChevronRight size={18}/>
        </button>
      )}
    </section>

    <section className="records-workspace card-surface">
      <header className="records-header">
        <div><h2>Payroll</h2><p>Review daily labor, tips, withholding, extras, cash, and check payroll</p></div>
        <div className="records-actions payroll-action-grid">
          <button className="soft-action soft-blue" onClick={() => setImportOpen(true)}><FileUp size={17}/>Import Payroll</button>
          <button className="soft-action soft-purple" onClick={openAdd}><Plus size={17}/>Manual Payroll</button>
          <button className="soft-action soft-green" onClick={openKitchenWeeklyBuilder}><ChefHat size={17}/>Build Kitchen Payroll</button>
          <button className="soft-action soft-orange" onClick={openWeeklyBuilder}><CalendarRange size={17}/>Build Weekly Payroll</button>
        </div>
      </header>

      <div className="payroll-tabs">
        {['Imported Labor','Ready to Pay','Payroll History','Manual Labor','Payroll Groups','Kitchen'].map(tab =>
          <button key={tab} className={activeTab===tab?'active':''} onClick={() => setActiveTab(tab)}>{tab}</button>
        )}
      </div>

      {activeTab==='Payroll Groups' && <div className="payroll-groups-list">
        <div className="payroll-tab-panel"><div><strong>Saved Payroll Groups</strong><small>Create reusable groups for Kitchen, Busser, Dishwasher, or any custom role.</small></div><button className="soft-action soft-green" onClick={()=>openGroupBuilder()}><Plus size={16}/>Create Payroll Group</button></div>
        {safeGroups.length===0 ? <div className="records-empty">No payroll groups created.</div> : safeGroups.map(group=>{const count=(group.memberIds||group.member_ids||group.employees||[]).length;return <div className="payroll-group-row" key={group.id}><span><strong>{group.name}</strong><small>{group.type} · {count} employee{count===1?'':'s'}</small></span><div className="row-actions"><button title="Edit group" onClick={()=>openGroupBuilder(group)}><Edit2 size={14}/></button><button className="danger" title="Delete group" onClick={()=>deleteGroup(group.id)}><Trash2 size={14}/></button></div></div>})}
      </div>}
      {activeTab==='Imported Labor' && <div className="payroll-tab-panel"><div><strong>Imported Daily Labor</strong><small>Daily Toast source entries used to build weekly payroll. These stay separate for audit.</small></div><button className="soft-action soft-blue" onClick={()=>setImportOpen(true)}><FileUp size={16}/>Import More Labor</button></div>}
      {activeTab==='Ready to Pay' && <div className="payroll-tab-panel"><div><strong>Weekly Payroll Ready to Pay</strong><small>Created weekly payroll saved in Supabase and awaiting Check, Cash, or ACH payment.</small></div><div className="records-actions"><button className="soft-action soft-green" disabled={!readyRows.length || savingPayroll} onClick={saveReadyPayroll}><Save size={16}/>{savingPayroll?'Saving...':'Save Payroll'}</button><button className="soft-action soft-orange" onClick={openWeeklyBuilder}><CalendarRange size={16}/>Build Another Week</button></div></div>}
      {activeTab==='Payroll History' && <div className="payroll-tab-panel"><div><strong>Paid Payroll History</strong><small>Completed weekly payroll payments and full audit details.</small></div></div>}
      {activeTab==='Kitchen' && <div className="payroll-tab-panel"><div><strong>Kitchen Payroll</strong><small>Create Monday–Sunday weekly payroll from saved employee base pay, then pay by Cash, Check, or ACH.</small></div><div className="records-actions"><button className="soft-action soft-green" onClick={openKitchenWeeklyBuilder}><CalendarRange size={16}/>Build Weekly Kitchen Payroll</button><button className="soft-action soft-purple" onClick={()=>openGroupBuilder()}><ChefHat size={16}/>Manage Kitchen Group</button></div></div>}
      {activeTab==='Manual Labor' && <div className="payroll-tab-panel"><div><strong>Manual Labor Entries</strong><small>Add, edit, duplicate, or delete manually entered payroll.</small></div><button className="soft-action soft-purple" onClick={openAdd}><Plus size={16}/>Add Manual Labor</button></div>}

      {activeTab!=='Payroll Groups' && <>
        <div className="records-filterbar payroll-filterbar">
          {selectedRowIds.length>0 && <div className="payroll-bulk-actions">
            <strong>{selectedRowIds.length} selected</strong>
            <label className="records-select payroll-bulk-select"><select aria-label="Bulk payroll action" value={bulkAction} onChange={e=>setBulkAction(e.target.value)}><option value="">Change Action</option><option>Draft</option><option>Ready to Pay</option><option>Approved</option><option>Paid</option><option>Void</option></select><ChevronDown size={14}/></label>
            <button className="secondary-action bulk-apply-button" disabled={!bulkAction} onClick={applyBulkAction}>Apply</button>
            <button className="secondary-action danger-action bulk-delete-button" onClick={bulkDeleteRows}><Trash2 size={15}/>Delete Selected</button>
          </div>}
          <label className="records-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search employee or date..."/></label>
          <label className="records-select"><Filter size={16}/><select value={method} onChange={e=>setMethod(e.target.value)}><option>All Methods</option><option>Cash</option><option>Check</option><option>ACH</option></select><ChevronDown size={14}/></label>
        </div>

        <div className="records-table-wrap payroll-table-wrap">
          <table className="records-table aligned-table payroll-table payroll-table-compact">
            <thead><tr>
              <th className="select-column"><input type="checkbox" aria-label="Select all visible payroll rows" checked={allVisibleSelected} onChange={toggleAllVisible}/></th><th>Date</th><th>Employee</th><th>Job</th><th className="numeric">Hours</th>
              <th className="numeric">Base Pay</th><th className="numeric">Tips</th>
              <th className="numeric">Withheld</th><th className="numeric">Net Tips</th>
              <th className="numeric">Final Pay</th><th className="centered">Method</th><th className="centered">Actions</th>
            </tr></thead>
            <tbody>{filtered.length===0 ? <tr><td colSpan="12" className="records-empty-cell">No payroll records.</td></tr> : pagedRows.map(r => <tr key={r.id || `${r.date}-${r.employee}`} className={selectedRowIds.includes(r.id)?'row-selected':''}>
              <td className="select-column"><input type="checkbox" aria-label={`Select ${r.employee} payroll`} checked={selectedRowIds.includes(r.id)} onChange={()=>toggleSelectedRow(r.id)}/></td><td>{r.date}</td><td><strong>{r.employee}</strong></td><td>{r.job}</td>
              <td className="numeric">{r.hours}</td><td className="numeric">{r.basePay}</td>
              <td className="numeric">{r.originalTips}</td><td className="numeric withholding-value">{r.withheld}</td>
              <td className="numeric tips-after-value">{r.tipsAfter}</td><td className="numeric final-pay-value">{r.finalPay}</td>
              <td className="centered"><span className={`status-badge ${r.method==='Cash'?'status-active':'status-paid'}`}>{r.method}</span></td>
              <td className="centered"><div className="row-actions compact-actions">
                <button title="View" onClick={()=>setDrawer(`${r.employee} Payroll`)}><Eye size={14}/></button>
                <button title="Edit all payroll fields" onClick={()=>openEdit(r)}><Edit2 size={14}/></button>
                {activeTab==='Ready to Pay' && <button className="pay-action" title="Record Check, Cash, or ACH payment" onClick={()=>openPayment(r)}><WalletCards size={14}/></button>}
                <button title="Duplicate" onClick={()=>duplicateRow(r)}><Copy size={14}/></button>
                <button className="danger" title="Delete" onClick={()=>removeRow(r)}><Trash2 size={14}/></button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
        {filtered.length>0 && <div className="records-pagination payroll-pagination">
          <div className="records-pagination-summary">Showing {(page-1)*pageSize+1}-{Math.min(page*pageSize,filtered.length)} of {filtered.length}</div>
          <div className="records-pagination-controls">
            <label>Rows <select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
            <button type="button" className="secondary-action" disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}><ChevronLeft size={15}/>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="secondary-action" disabled={page>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages,value+1))}>Next<ChevronRight size={15}/></button>
          </div>
        </div>}
      </>}
    </section>

    <Modal open={manual} title={editingId ? 'Edit Payroll Entry' : 'Manual Payroll Entry'} subtitle="Hours, tips, withholding, extra pay, and payment details" onClose={() => setManual(false)} footer={<><button className="secondary-action" onClick={()=>setManual(false)}>Cancel</button><button className="primary-button" onClick={saveManual}>{editingId?'Save Changes':'Add to Payroll'}</button></>}>
      <div className="form-grid">
        <label>Employee<input value={manualForm.employee_name} onChange={e=>setManualForm({...manualForm,employee_name:e.target.value})} placeholder="Employee name"/></label>
        <label>Payroll Date<input type="date" value={manualForm.pay_date} onChange={e=>setManualForm({...manualForm,pay_date:e.target.value})}/></label>
        <label>Job Type<input value={manualForm.job_type} onChange={e=>setManualForm({...manualForm,job_type:e.target.value})}/></label>
        <label>Hours<input type="number" value={manualForm.hours} onChange={e=>setManualForm({...manualForm,hours:e.target.value})} placeholder="0.00"/></label>
        <label>Base Pay<input type="number" value={manualForm.regular_pay} onChange={e=>setManualForm({...manualForm,regular_pay:e.target.value})} placeholder="0.00"/></label>
        <label>Original Tips<input type="number" value={manualForm.credit_card_tips} onChange={e=>setManualForm({...manualForm,credit_card_tips:e.target.value})} placeholder="0.00"/></label>
        <label>Withholding Rate<input value="3.5%" readOnly/></label>
        <label>Tips Withheld<input type="number" value={manualTipWithheld.toFixed(2)} readOnly title="Exact 3.5% of Original Tips"/></label>
        <label>Tips After Withholding<input type="number" value={manualNetTips.toFixed(2)} readOnly title="Original Tips minus exact 3.5% withholding"/></label>
        <label>Extra Pay<input type="number" value={manualForm.extra_pay} onChange={e=>setManualForm({...manualForm,extra_pay:e.target.value})} placeholder="0.00"/></label>
        <label>Extra Pay Reason<input value={manualForm.extra_reason||''} onChange={e=>setManualForm({...manualForm,extra_reason:e.target.value})} placeholder="Optional reason"/></label>
        <label>Payment Method<select value={manualForm.payment_method} onChange={e=>setManualForm({...manualForm,payment_method:e.target.value})}><option>Cash</option><option>Check</option><option>ACH</option></select></label>
        <label>Payment Status<select value={manualForm.payment_status||'Draft'} onChange={e=>setManualForm({...manualForm,payment_status:e.target.value})}><option>Draft</option><option>Ready to Pay</option><option>Approved</option><option>Paid</option><option>Void</option></select></label>
        <label>Payment Date<input type="date" value={manualForm.payment_date||''} onChange={e=>setManualForm({...manualForm,payment_date:e.target.value})}/></label>
        <label>Check Number<input value={manualForm.check_number||''} onChange={e=>setManualForm({...manualForm,check_number:e.target.value})} placeholder="For check payments"/></label>
        <label>ACH Reference<input value={manualForm.ach_reference||''} onChange={e=>setManualForm({...manualForm,ach_reference:e.target.value})} placeholder="For ACH payments"/></label>
        <label>Week Start<input type="date" value={manualForm.payroll_week_start||''} onChange={e=>setManualForm({...manualForm,payroll_week_start:e.target.value})}/></label>
        <label>Week End<input type="date" value={manualForm.payroll_week_end||''} onChange={e=>setManualForm({...manualForm,payroll_week_end:e.target.value})}/></label>
        <label>Payroll Group<input value={manualForm.group_name||''} onChange={e=>setManualForm({...manualForm,group_name:e.target.value})} placeholder="Optional group"/></label>
        <label className="form-span-2">Notes<input value={manualForm.notes||''} onChange={e=>setManualForm({...manualForm,notes:e.target.value})} placeholder="Optional notes"/></label>
      </div>
    </Modal>

    <Modal open={paymentOpen} title="Record Payroll Payment" subtitle="Choose Check, Cash, or ACH and complete the payment details" onClose={() => setPaymentOpen(false)} footer={<><button className="secondary-action" onClick={()=>setPaymentOpen(false)}>Cancel</button><button className="primary-button" onClick={savePayment}>Save Payment</button></>}>
      <div className="form-grid">
        <label>Payment Method<select value={paymentForm.payment_method} onChange={e=>setPaymentForm({...paymentForm,payment_method:e.target.value})}><option>Check</option><option>Cash</option><option>ACH</option></select></label>
        <label>Payment Status<select value={paymentForm.payment_status} onChange={e=>setPaymentForm({...paymentForm,payment_status:e.target.value})}><option>Draft</option><option>Approved</option><option>Paid</option><option>Void</option></select></label>
        <label>Payment Date<input type="date" value={paymentForm.payment_date} onChange={e=>setPaymentForm({...paymentForm,payment_date:e.target.value})}/></label>
        {paymentForm.payment_method==='Check' && <label>Check Number<input value={paymentForm.check_number} onChange={e=>setPaymentForm({...paymentForm,check_number:e.target.value})} placeholder="Required"/></label>}
        {paymentForm.payment_method==='ACH' && <label>ACH Reference<input value={paymentForm.ach_reference} onChange={e=>setPaymentForm({...paymentForm,ach_reference:e.target.value})} placeholder="Required"/></label>}
        <label className="form-span-2">Payment Notes<input value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm,notes:e.target.value})} placeholder="Optional notes"/></label>
      </div>
    </Modal>

    <Modal open={weekOpen} title="Build Weekly Payroll" subtitle="Select a Monday through Sunday range. One payroll row per employee will be dated on Sunday." onClose={() => setWeekOpen(false)} footer={<><button className="secondary-action" onClick={()=>setWeekOpen(false)}>Cancel</button><button className="primary-button" disabled={savingPayroll} onClick={createWeeklyPayroll}>{savingPayroll?'Saving Payroll...':'Create & Save Weekly Payroll'}</button></>}>
      <div className="form-grid weekly-payroll-form">
        <label>Week Starts Monday<input type="date" value={weekStart} onChange={e=>{const start=e.target.value;setWeekStart(start);setWeekEnd(endOfPayrollWeek(start))}}/></label>
        <label>Week Ends Sunday<input type="date" value={weekEnd} onChange={e=>setWeekEnd(e.target.value)}/></label>
      </div>
      {availablePayrollWeeks.length>0 && <label className="weekly-available-weeks">Imported Payroll Week<select value={`${weekStart}|${weekEnd}`} onChange={e=>{const [start,end]=e.target.value.split('|');setWeekStart(start);setWeekEnd(end)}}>{availablePayrollWeeks.map(week=><option key={`${week.start}|${week.end}`} value={`${week.start}|${week.end}`}>{week.start} through {week.end} · {week.employeeCount} employees · {week.count} entries</option>)}</select></label>}
      <div className={`weekly-range-status ${isMondayToSunday(weekStart,weekEnd)?'valid':'invalid'}`}>{isMondayToSunday(weekStart,weekEnd)?`Valid payroll week: ${weekStart} through ${weekEnd}`:'Range must be exactly Monday through Sunday.'}</div>
      <div className="weekly-employee-picker">
        <div className="weekly-employee-picker-head">
          <div><strong>Select Employees</strong><small>Only selected employees will be combined into Sunday payroll.</small></div>
          <div className="weekly-picker-actions">
            <button type="button" onClick={()=>setSelectedWeeklyEmployees(weeklyEmployeeNames)}>Select All</button>
            <button type="button" onClick={()=>setSelectedWeeklyEmployees([])}>Clear All</button>
          </div>
        </div>
        {weeklyAllPreview.length===0 ? <div className="records-empty weekly-empty-diagnostic"><strong>No payroll entries fall inside this selected week.</strong><span>{importedEmployeeNames.length ? `${importedEmployeeNames.length} imported employees are stored locally. Choose one of the Imported Payroll Week options above.` : 'Import a Toast labor report first.'}</span></div> : <div className="weekly-employee-list">
          {weeklyAllPreview.map(row => <label key={row.id} className="weekly-employee-option">
            <input type="checkbox" checked={selectedWeeklyEmployees.includes(row.employee_name)} onChange={event=>setSelectedWeeklyEmployees(previous=>event.target.checked?[...new Set([...previous,row.employee_name])]:previous.filter(name=>name!==row.employee_name))}/>
            <span><strong>{row.employee_name}</strong><small>{row.job_type || 'Employee'} · {Number(row.hours||0).toFixed(1)} hrs</small></span>
            <b>{formatMoney(Number(row.regular_pay||0)+Number(row.credit_card_tips||0)-Number(row.tip_deduction||0)+Number(row.extra_pay||0))}</b>
          </label>)}
        </div>}
      </div>
      <div className="weekly-preview">
        <div className="weekly-preview-head"><strong>Weekly Payroll Preview</strong><span>{weeklyPreview.length} selected</span></div>
        {weeklyAllPreview.length>0 && weeklyPreview.length===0 ? <div className="records-empty">Select at least one employee.</div> : weeklyPreview.map(row=><div className="weekly-preview-row" key={row.id}><span><strong>{row.employee_name}</strong><small>{row.job_type || 'Employee'} · pay date {row.pay_date}</small></span><span>{Number(row.hours||0).toFixed(1)} hrs</span><b>{formatMoney(Number(row.regular_pay||0)+Number(row.credit_card_tips||0)-Number(row.tip_deduction||0)+Number(row.extra_pay||0))}</b></div>)}
      </div>
    </Modal>


    <Modal open={kitchenWeekOpen} title="Build Weekly Kitchen Payroll" subtitle="Choose a Monday through Sunday range and create one Sunday payroll row for each selected kitchen employee." onClose={() => setKitchenWeekOpen(false)} footer={<><button className="secondary-action" onClick={()=>setKitchenWeekOpen(false)}>Cancel</button><button className="primary-button" disabled={savingKitchenPayroll} onClick={createKitchenWeeklyPayroll}>{savingKitchenPayroll?'Saving Kitchen Payroll...':'Create & Save Kitchen Payroll'}</button></>}>
      <div className="form-grid weekly-payroll-form">
        <label>Week Starts Monday<input type="date" value={kitchenWeekStart} onChange={e=>{const start=e.target.value;setKitchenWeekStart(start);setKitchenWeekEnd(endOfPayrollWeek(start))}}/></label>
        <label>Week Ends Sunday<input type="date" value={kitchenWeekEnd} onChange={e=>setKitchenWeekEnd(e.target.value)}/></label>
        <label className="form-span-2">Kitchen Payroll Group<select value={kitchenWeekGroupId} onChange={e=>setKitchenWeekGroupId(e.target.value)}><option value="">All Active Kitchen Staff</option>{kitchenGroups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      </div>
      <div className={`weekly-range-status ${isMondayToSunday(kitchenWeekStart,kitchenWeekEnd)?'valid':'invalid'}`}>{isMondayToSunday(kitchenWeekStart,kitchenWeekEnd)?`Valid kitchen payroll week: ${kitchenWeekStart} through ${kitchenWeekEnd}`:'Range must be exactly Monday through Sunday.'}</div>
      <div className="weekly-employee-picker">
        <div className="weekly-employee-picker-head">
          <div><strong>Select Kitchen Employees</strong><small>Base pay and default payment method come from each saved employee profile.</small></div>
          <div className="weekly-picker-actions"><button type="button" onClick={()=>setSelectedKitchenEmployeeIds(kitchenEligibleEmployees.map(employee=>employee.id))}>Select All</button><button type="button" onClick={()=>setSelectedKitchenEmployeeIds([])}>Clear All</button></div>
        </div>
        {kitchenEligibleEmployees.length===0 ? <div className="records-empty"><strong>No active kitchen employees found.</strong><span>Add kitchen employees or create a Kitchen payroll group first.</span></div> : <div className="weekly-employee-list">
          {kitchenEligibleEmployees.map(employee=><label key={employee.id} className="weekly-employee-option"><input type="checkbox" checked={selectedKitchenEmployeeIds.includes(employee.id)} onChange={event=>setSelectedKitchenEmployeeIds(previous=>event.target.checked?[...new Set([...previous,employee.id])]:previous.filter(id=>id!==employee.id))}/><span><strong>{employee.name}</strong><small>{employee.job||employee.job_type||'Kitchen'} · {employee.method||employee.payroll_type||'Cash'}</small></span><b>{formatMoney(Number(employee.basePay ?? employee.base_pay ?? 0)+Number(employee.extra_pay||0))}</b></label>)}
        </div>}
      </div>
      <div className="weekly-preview">
        <div className="weekly-preview-head"><strong>Kitchen Payroll Preview</strong><span>{kitchenWeeklyPreview.length} selected</span></div>
        {kitchenWeeklyPreview.length===0 ? <div className="records-empty">Select at least one kitchen employee.</div> : kitchenWeeklyPreview.map(row=><div className="weekly-preview-row" key={row.id}><span><strong>{row.employee_name}</strong><small>{row.job_type || 'Kitchen'} · pay date {row.pay_date} · {row.payment_method}</small></span><span>Base pay</span><b>{formatMoney(Number(row.total||0))}</b></div>)}
      </div>
    </Modal>

    <Modal open={kitchenOpen} title="Kitchen Payroll Group" subtitle="Select existing employees and save a reusable payroll group" onClose={() => setKitchenOpen(false)} footer={<><button className="secondary-action" onClick={()=>setKitchenOpen(false)}>Cancel</button><button className="primary-button" onClick={addKitchen}>Save Payroll Group</button></>}>
      <div className="form-grid payroll-group-form">
        <label>Group Name<input value={groupName} onChange={e=>setGroupName(e.target.value)} /></label>
        <label>Payroll Group Type<select value={groupType} onChange={e=>{setGroupType(e.target.value);if(!editingGroupId)setGroupName(`${e.target.value} Payroll`)}}><option>Kitchen</option><option>Busser</option><option>Dishwasher</option><option>Prep Cook</option><option>Custom</option></select></label>
      </div>
      <div className="employee-group-picker"><div className="employee-group-head"><strong>Select Existing Employees</strong><small>Choose employees to include in this reusable payroll group.</small></div>
        {activeEmployees.length===0 ? <div className="records-empty">No active employees found in Supabase. Add employees first.</div> : activeEmployees.map(employee=><label key={employee.id}><input type="checkbox" checked={selectedEmployees.includes(employee.id)} onChange={e=>setSelectedEmployees(prev=>e.target.checked?[...new Set([...prev,employee.id])]:prev.filter(id=>id!==employee.id))}/><span><strong>{employee.name}</strong><small>{employee.job||employee.job_type||'Employee'}{Number(employee.basePay||employee.base_pay||0)>0?` · $${Number(employee.basePay||employee.base_pay).toFixed(2)} base pay`:''}</small></span></label>)}
      </div>
    </Modal>

    <ToastReportImport open={importOpen} type="payroll" onClose={() => setImportOpen(false)} onImport={importPayroll}/>
    <DetailDrawer title={drawer} onClose={()=>setDrawer(null)}/>
  </div>
}
