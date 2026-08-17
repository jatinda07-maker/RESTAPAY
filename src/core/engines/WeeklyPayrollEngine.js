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
