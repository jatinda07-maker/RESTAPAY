const money = value => Math.round((Number(value) || 0) * 100) / 100
const truncateMoney = value => Math.trunc(((Number(value) || 0) + Number.EPSILON) * 100) / 100
const number = value => Number(String(value ?? '').replace(/[$,%]/g, '').trim()) || 0

export function isoDate(value = '') {
  const raw = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}

export function startOfPayrollWeek(value) {
  const date = new Date(`${isoDate(value)}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  const day = date.getUTCDay()
  const distance = day === 0 ? 6 : day - 1
  date.setUTCDate(date.getUTCDate() - distance)
  return date.toISOString().slice(0, 10)
}

export function endOfPayrollWeek(value) {
  const start = startOfPayrollWeek(value)
  if (!start) return ''
  const date = new Date(`${start}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 6)
  return date.toISOString().slice(0, 10)
}

export function isMondayToSunday(start, end) {
  if (!start || !end) return false
  const first = new Date(`${start}T12:00:00Z`)
  const last = new Date(`${end}T12:00:00Z`)
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return false
  return first.getUTCDay() === 1 && last.getUTCDay() === 0 && Math.round((last - first) / 86400000) === 6
}

export function inDateRange(row, start, end) {
  const date = isoDate(row.payroll_date || row.pay_date || row.date || row.period_end)
  return Boolean(date && date >= start && date <= end)
}

function employeeKey(row) {
  return String(row.employee_id || row.employee_name || row.employee || '').trim().toLowerCase()
}

export function buildWeeklyPayroll(rows = [], { start, end, paymentMethod = 'Check' } = {}) {
  if (!isMondayToSunday(start, end)) {
    throw new Error('Payroll range must run Monday through Sunday.')
  }
  const eligible = rows.filter(row =>
    !row.weekly_rollup &&
    row.payroll_status !== 'rolled-up' &&
    inDateRange(row, start, end) &&
    employeeKey(row)
  )
  const grouped = new Map()
  for (const row of eligible) {
    const key = employeeKey(row)
    const current = grouped.get(key) || {
      employee_id: row.employee_id || '',
      employee_name: row.employee_name || row.employee || 'Unknown employee',
      job_type: row.job_type || row.job || '',
      payment_method: row.payment_method || row.method || paymentMethod,
      hours: 0,
      regular_pay: 0,
      credit_card_tips: 0,
      tip_deduction: 0,
      extra_pay: 0,
      source_ids: [],
      source_files: new Set(),
    }
    current.hours += number(row.hours || row.regular_hours)
    current.regular_pay += number(row.regular_pay ?? row.base_pay ?? row.gross_pay)
    current.credit_card_tips += number(row.credit_card_tips ?? row.original_tips ?? row.total_tips)
    current.extra_pay += number(row.extra_pay)
    if (row.id) current.source_ids.push(row.id)
    if (row.source_file) current.source_files.add(row.source_file)
    if (!current.job_type) current.job_type = row.job_type || row.job || ''
    if (!current.payment_method) current.payment_method = paymentMethod
    grouped.set(key, current)
  }
  return Array.from(grouped.values()).map((entry, index) => {
    const regularPay = money(entry.regular_pay)
    const originalTips = money(entry.credit_card_tips)
    // Keep withholding at full calculation precision. Actual payroll/check payment
    // is truncated to cents (never rounded up), e.g. 732.4157 -> 732.41.
    const tipsWithheld = originalTips * 0.035
    const netTips = truncateMoney(originalTips - tipsWithheld)
    const extraPay = money(entry.extra_pay)
    const total = truncateMoney(regularPay + netTips + extraPay)
    return {
      id: `weekly-${end}-${entry.employee_id || employeeKey(entry)}-${index}`,
      employee_id: entry.employee_id,
      employee_name: entry.employee_name,
      job_type: entry.job_type,
      pay_date: end,
      payroll_date: end,
      payroll_week_start: start,
      payroll_week_end: end,
      hours: money(entry.hours),
      regular_pay: regularPay,
      credit_card_tips: originalTips,
      tip_deduction: money(tipsWithheld),
      tips_withheld: tipsWithheld,
      tips_after_withheld: netTips,
      extra_pay: extraPay,
      total,
      total_pay: total,
      payment_method: entry.payment_method || paymentMethod,
      method: entry.payment_method || paymentMethod,
      source: 'weekly-rollup',
      weekly_rollup: true,
      source_ids: entry.source_ids,
      source_files: Array.from(entry.source_files),
      notes: `Weekly payroll ${start} through ${end}`,
    }
  })
}


export function buildKitchenWeeklyPayroll(employees = [], { start, end, selectedEmployeeIds = [], groupId = null, groupName = 'Kitchen Payroll' } = {}) {
  if (!isMondayToSunday(start, end)) {
    throw new Error('Kitchen payroll range must run Monday through Sunday.')
  }
  const selected = new Set((selectedEmployeeIds || []).map(String))
  return (employees || [])
    .filter(employee => employee && employee.id && (!selected.size || selected.has(String(employee.id))))
    .map((employee, index) => {
      const basePay = money(employee.basePay ?? employee.base_pay ?? 0)
      const extraPay = money(employee.extra_pay ?? 0)
      return {
        id: `kitchen-weekly-${end}-${employee.id}-${index}`,
        employee_id: employee.id,
        employee_name: employee.name || employee.employee_name || 'Unknown employee',
        job_type: employee.job || employee.job_type || 'Kitchen',
        pay_type: employee.pay_type || employee.type || employee.employee_type || 'Hourly',
        pay_date: end,
        payroll_date: end,
        payroll_week_start: start,
        payroll_week_end: end,
        week_start: start,
        week_end: end,
        hours: 0,
        regular_pay: basePay,
        credit_card_tips: 0,
        tip_deduction: 0,
        tips_withheld: 0,
        tips_after_withheld: 0,
        extra_pay: extraPay,
        extra_reason: employee.extra_reason || '',
        total: money(basePay + extraPay),
        total_pay: money(basePay + extraPay),
        payment_method: employee.method || employee.payroll_type || 'Cash',
        method: employee.method || employee.payroll_type || 'Cash',
        group_id: groupId,
        group_name: groupName,
        source: 'kitchen-weekly',
        weekly_rollup: true,
        source_ids: [],
        notes: `Kitchen weekly payroll ${start} through ${end}`,
      }
    })
}

export function activePayrollRows(rows = []) {
  return rows.filter(row => row.payroll_status !== 'rolled-up')
}

function historyEmployeeKey(row) {
  return String(row?.employee_id || row?.employee_name || row?.employee || '').trim().toLowerCase()
}

function uniqueMoney(values = []) {
  return [...new Set(values.map(value => money(value)).filter(value => value > 0).map(value => value.toFixed(2)))].map(Number)
}

/**
 * Rebuild one historical Monday-Sunday payroll week from canonical source data.
 * Toast/imported daily rows are rebuilt deterministically through buildWeeklyPayroll.
 * Kitchen weekly rows are consolidated into one Sunday record per employee while
 * preserving one legitimate smaller extra-pay component and dropping repeated copies.
 */
export function buildHistoricalPayrollRepair(rows = [], { start, end } = {}) {
  if (!isMondayToSunday(start, end)) throw new Error('Repair range must run Monday through Sunday.')

  const all = Array.isArray(rows) ? rows.filter(Boolean) : []
  const dailySource = all
    .filter(row => !row.weekly_rollup && String(row.source || '').toLowerCase() === 'toast' && inDateRange(row, start, end) && historyEmployeeKey(row))
    .map(row => ({ ...row, payroll_status: '' }))
  const historicalWeekly = all.filter(row => row.weekly_rollup && (row.payroll_week_end || row.week_end || row.payroll_date || row.pay_date) === end)
  const priorCheckByEmployee = new Map()
  for (const row of historicalWeekly.filter(row => String(row.source || '').toLowerCase() !== 'kitchen-weekly')) {
    const key = historyEmployeeKey(row)
    if (!key) continue
    const current = priorCheckByEmployee.get(key)
    if (!current || String(row.payment_status || '').toLowerCase() === 'paid') priorCheckByEmployee.set(key, row)
  }
  const checkRows = buildWeeklyPayroll(dailySource, { start, end, paymentMethod: 'Check' })
    .map(row => {
      const prior = priorCheckByEmployee.get(historyEmployeeKey(row)) || {}
      const paid = String(prior.payment_status || '').toLowerCase() === 'paid'
      return {
        ...row,
        id:`repair-weekly-${end}-${historyEmployeeKey(row)}`,
        source:'weekly-rollup',
        repair_source:'historical-daily',
        repair_week:true,
        payment_method:prior.payment_method || prior.method || row.payment_method || 'Check',
        method:prior.payment_method || prior.method || row.method || 'Check',
        payment_status:paid ? 'Paid' : (prior.payment_status || 'Unpaid'),
        payment_date:paid ? end : (prior.payment_date || ''),
        check_number:prior.check_number || '',
        ach_reference:prior.ach_reference || '',
      }
    })

  const kitchenCandidates = historicalWeekly.filter(row => String(row.source || '').toLowerCase() === 'kitchen-weekly')
  const kitchenGroups = new Map()
  for (const row of kitchenCandidates) {
    const key = historyEmployeeKey(row)
    if (!key) continue
    const group = kitchenGroups.get(key) || []
    group.push(row)
    kitchenGroups.set(key, group)
  }

  const kitchenRows = [...kitchenGroups.entries()].map(([key, group]) => {
    const representative = group.slice().sort((a,b) => number(b.regular_pay ?? b.base_pay ?? b.total) - number(a.regular_pay ?? a.base_pay ?? a.total))[0]
    const regularValues = uniqueMoney(group.map(row => row.regular_pay ?? row.base_pay ?? 0))
    const explicitExtras = uniqueMoney(group.map(row => row.extra_pay ?? 0))
    const basePay = Math.max(0, ...regularValues)
    const smallerRegulars = regularValues.filter(value => value > 0 && value < basePay)
    // Old kitchen history sometimes stored a legitimate extra as its own weekly row.
    // Preserve each distinct smaller component once; repeated copies are discarded.
    const inferredExtras = smallerRegulars.filter(value => value <= Math.max(100, basePay * 0.25))
    const extraPay = money([...new Set([...explicitExtras, ...inferredExtras].map(value => value.toFixed(2)))].reduce((sum, value) => sum + Number(value), 0))
    const originalTips = money(Math.max(0, ...group.map(row => number(row.original_tips ?? row.credit_card_tips))))
    const tipsWithheld = originalTips * 0.035
    const netTips = truncateMoney(originalTips - tipsWithheld)
    const total = truncateMoney(basePay + extraPay + netTips)
    const paid = group.some(row => String(row.payment_status || '').toLowerCase() === 'paid')
    const method = representative.payment_method || representative.method || 'Cash'
    const distinctRegulars = regularValues.length
    const review = smallerRegulars.some(value => value > Math.max(100, basePay * 0.25)) || distinctRegulars > 3
    return {
      ...representative,
      id:`repair-kitchen-${end}-${key}`,
      payroll_date:end,
      pay_date:end,
      payroll_week_start:start,
      payroll_week_end:end,
      week_start:start,
      week_end:end,
      regular_pay:basePay,
      base_pay:basePay,
      extra_pay:extraPay,
      original_tips:originalTips,
      credit_card_tips:originalTips,
      tips_withheld:tipsWithheld,
      tip_deduction:tipsWithheld,
      tips_after_withheld:netTips,
      tips_after_withholding:netTips,
      total,
      total_pay:total,
      payment_method:method,
      method,
      source:'kitchen-weekly',
      weekly_rollup:true,
      repair_source:'historical-kitchen',
      repair_week:true,
      payment_status:paid ? 'Paid' : (representative.payment_status || 'Unpaid'),
      payment_date:paid ? end : (representative.payment_date || ''),
      source_ids:[],
      repair_review:review,
      repair_existing_count:group.length,
      notes:`Historical payroll repair ${start} through ${end}`,
    }
  })

  const repaired = [...checkRows, ...kitchenRows]
  const duplicateKeys = new Set()
  for (const row of repaired) {
    const key = `${historyEmployeeKey(row)}|${String(row.source || '').toLowerCase()}`
    if (duplicateKeys.has(key)) throw new Error(`Repair generated a duplicate weekly row for ${row.employee_name}.`)
    duplicateKeys.add(key)
  }
  const total = truncateMoney(repaired.reduce((sum,row) => sum + number(row.total_pay ?? row.total), 0))
  const checkTotal = truncateMoney(checkRows.reduce((sum,row) => sum + number(row.total_pay ?? row.total), 0))
  const kitchenTotal = truncateMoney(kitchenRows.reduce((sum,row) => sum + number(row.total_pay ?? row.total), 0))
  const existingWeeklyTotal = truncateMoney(historicalWeekly.reduce((sum,row) => sum + number(row.total_pay ?? row.total), 0))
  const duplicateInflationRemoved = truncateMoney(Math.max(0, existingWeeklyTotal - total))
  return { start, end, rows: repaired, checkRows, kitchenRows, total, checkTotal, kitchenTotal, existingWeeklyTotal, duplicateInflationRemoved, reviewCount:kitchenRows.filter(row=>row.repair_review).length }
}
