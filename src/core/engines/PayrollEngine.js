const num = value => Number(String(value ?? '').replace(/[$,%]/g, '').trim()) || 0
export const roundPayroll = value => Math.round((num(value) + Number.EPSILON) * 100) / 100

const firstPresentAmount = (row = {}, keys = []) => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return num(value)
  }
  return null
}

const storedGrossTips = row => firstPresentAmount(row, ['credit_card_tips', 'original_tips', 'total_tips', 'gross_tips'])
const storedNetTips = row => firstPresentAmount(row, ['tips_after_withheld', 'tips_after_withholding', 'final_tips', 'net_tips', 'tips'])
const storedWithheldTips = row => firstPresentAmount(row, ['tip_deduction', 'tips_withheld', 'tips_withholding', 'withheld_tips'])

export const TIPS_WITHHOLDING_RATE = 0.035

export const tipsWithheld = row => {
  const gross = storedGrossTips(row)
  if (gross !== null) return roundPayroll(Math.max(0, gross) * TIPS_WITHHOLDING_RATE)

  const explicit = storedWithheldTips(row)
  if (explicit !== null) return roundPayroll(Math.max(0, explicit))

  const net = storedNetTips(row)
  if (net === null) return 0
  return 0
}

export const netTips = row => {
  const gross = storedGrossTips(row)
  if (gross !== null) return roundPayroll(Math.max(0, gross - tipsWithheld(row)))

  const stored = storedNetTips(row)
  if (stored !== null) return roundPayroll(Math.max(0, stored))

  return 0
}

export const originalTips = row => {
  const explicit = storedGrossTips(row)
  if (explicit !== null) return roundPayroll(Math.max(0, explicit))

  const net = storedNetTips(row)
  if (net === null) return 0

  return roundPayroll(Math.max(0, net + tipsWithheld(row)))
}

const isTippedRow = row => /tip|server|bartender|waiter|waitress|front.?of.?house|foh/i.test(String(row.pay_type || row.employee_type || row.job_type || '')) || originalTips(row) > 0

export const payrollTotal = row => {
  const extraPay = num(row.extra_pay)

  // Restaurant rule: tipped employees are paid net tips plus approved extra pay.
  if (isTippedRow(row)) return roundPayroll(netTips(row) + extraPay)

  // Preserve an explicitly approved final amount when supplied by a manual row.
  const explicitTotal = firstPresentAmount(row, ['total_pay', 'total'])
  if (explicitTotal !== null && explicitTotal !== 0) return roundPayroll(explicitTotal)

  const regularPay = num(row.regular_pay ?? row.regularPay ?? row.fixed_pay ?? row.base_pay)
  const overtimePay = num(row.overtime_pay ?? row.overtimePay)
  return roundPayroll(regularPay + overtimePay + extraPay)
}

export const normalizePayrollAliases = row => {
  const gross = originalTips(row)
  const withheld = tipsWithheld(row)
  const net = netTips(row)
  const total = payrollTotal(row)
  return {
    ...row,
    credit_card_tips: gross,
    original_tips: gross,
    total_tips: gross,
    tip_deduction: withheld,
    tips_withheld: withheld,
    tips: net,
    final_tips: net,
    tips_after_withheld: net,
    total_pay: total,
    total
  }
}

export const payrollEntryKey = row => [String(row.employee_id || row.employee_name || '').toLowerCase().replace(/[^a-z0-9]/g, ''), String(row.pay_date || row.payroll_date || row.date || '').slice(0, 10), String(row.source_file || row.source || '')].join('::')

export function groupPayrollByEmployee(rows = []) {
  const map = new Map()
  for (const rawRow of rows) {
    const row = normalizePayrollAliases(rawRow)
    const key = String(row.employee_id || row.employee_name || 'unknown')
    if (!map.has(key)) map.set(key, { key, employee_name: row.employee_name || 'Unknown employee', rows: [], total: 0 })
    const group = map.get(key)
    group.rows.push(row)
    group.total = roundPayroll(group.total + payrollTotal(row))
  }
  return [...map.values()]
    .map(group => ({ ...group, rows: group.rows.sort((a, b) => String(a.pay_date || '').localeCompare(String(b.pay_date || ''))) }))
    .sort((a, b) => a.employee_name.localeCompare(b.employee_name))
}
