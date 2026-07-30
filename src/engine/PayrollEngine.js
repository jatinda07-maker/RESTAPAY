const num = value => Number(String(value ?? '').replace(/[$,%]/g, '').trim()) || 0
export const roundPayroll = value => Math.round((num(value) + Number.EPSILON) * 100) / 100
const firstNonZeroAmount = (row = {}, keys = []) => {
  for (const key of keys) {
    const value = num(row?.[key])
    if (value !== 0) return value
  }
  return 0
}
const storedGrossTips = row => roundPayroll(firstNonZeroAmount(row, ['credit_card_tips', 'original_tips', 'total_tips', 'gross_tips']))
const storedNetTips = row => roundPayroll(firstNonZeroAmount(row, ['tips_after_withheld', 'tips_after_withholding', 'final_tips', 'net_tips', 'tips']))
export const tipsWithheld = row => {
  const explicit = firstNonZeroAmount(row, ['tip_deduction', 'tips_withheld', 'tips_withholding', 'withheld_tips'])
  if (explicit !== 0) return roundPayroll(explicit)
  const gross = storedGrossTips(row)
  const net = storedNetTips(row)
  return roundPayroll(gross > 0 && net >= 0 ? Math.max(0, gross - net) : 0)
}
export const netTips = row => {
  const stored = storedNetTips(row)
  if (stored !== 0) return roundPayroll(Math.max(0, stored))
  return roundPayroll(Math.max(0, originalTips(row) - tipsWithheld(row)))
}
export const originalTips = row => {
  const explicit = storedGrossTips(row)
  if (explicit !== 0) return roundPayroll(explicit)
  return roundPayroll(netTips(row) + tipsWithheld(row))
}
const isTippedRow = row => /tip|server|bartender|waiter|waitress|front.?of.?house|foh/i.test(String(row.pay_type || row.employee_type || row.job_type || '')) || originalTips(row) > 0
export const payrollTotal = row => {
  // RC6.26: total_pay from older imports may contain hidden hourly-wage math.
  // Always rebuild the final payroll from the approved restaurant rules.
  if (isTippedRow(row)) return roundPayroll(netTips(row) + num(row.extra_pay))
  return roundPayroll(num(row.regular_pay ?? row.fixed_pay ?? row.base_pay) + num(row.extra_pay))
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
