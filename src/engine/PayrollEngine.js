const num = value => Number(String(value ?? '').replace(/[$,%]/g, '').trim()) || 0
export const roundPayroll = value => Math.round((num(value) + Number.EPSILON) * 100) / 100
export const originalTips = row => roundPayroll(row.credit_card_tips ?? row.original_tips ?? row.total_tips ?? row.gross_tips ?? (num(row.tips) + num(row.tip_deduction)))
export const netTips = row => {
  const stored = row.tips ?? row.final_tips ?? row.net_tips ?? row.tips_after_withheld ?? row.tips_after_withholding
  if (stored !== undefined && stored !== null && stored !== '') return roundPayroll(Math.max(0, num(stored)))
  return roundPayroll(Math.max(0, originalTips(row) - num(row.tip_deduction)))
}
const isTippedRow = row => /tip|server|bartender|waiter|waitress|front.?of.?house|foh/i.test(String(row.pay_type || row.employee_type || row.job_type || ''))
export const payrollTotal = row => {
  const explicit = row.total_pay ?? row.final_pay ?? row.payroll_total
  if (explicit !== undefined && explicit !== null && explicit !== '') return roundPayroll(explicit)
  if (isTippedRow(row)) return roundPayroll(netTips(row) + num(row.extra_pay))
  return roundPayroll(num(row.regular_pay) + num(row.overtime_pay) + num(row.extra_pay))
}
export const payrollEntryKey = row => [String(row.employee_id || row.employee_name || '').toLowerCase().replace(/[^a-z0-9]/g, ''), String(row.pay_date || row.payroll_date || row.date || '').slice(0, 10), String(row.source_file || row.source || '')].join('::')
export function groupPayrollByEmployee(rows = []) {
  const map = new Map()
  for (const row of rows) {
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
