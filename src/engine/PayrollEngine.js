const num = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const text = String(value ?? '').replace(/[$,%]/g, '').replace(/,/g, '').trim()
  if (!text) return 0
  if (/^\(.+\)$/.test(text)) return -(Number(text.replace(/[()]/g, '')) || 0)
  return Number(text) || 0
}

export const roundPayroll = value => Math.round((num(value) + Number.EPSILON) * 100) / 100

export const originalTips = row => roundPayroll(
  row?.credit_card_tips ??
  row?.original_tips ??
  row?.total_tips ??
  row?.gross_tips ??
  (num(row?.tips) + num(row?.tip_deduction))
)

export const netTips = row => {
  const stored = [
    row?.tips,
    row?.final_tips,
    row?.net_tips,
    row?.tips_after_withheld,
    row?.tips_after_withholding
  ].find(value => value !== undefined && value !== null && String(value).trim() !== '')

  if (stored !== undefined) return roundPayroll(Math.max(0, num(stored)))
  return roundPayroll(Math.max(0, originalTips(row) - num(row?.tip_deduction)))
}

export const payrollTotal = row => {
  const explicit = [row?.total_pay, row?.final_pay, row?.payroll_total]
    .find(value => value !== undefined && value !== null && String(value).trim() !== '')
  if (explicit !== undefined) return roundPayroll(num(explicit))

  return roundPayroll(
    num(row?.regular_pay ?? row?.regularPay ?? row?.base_pay) +
    num(row?.overtime_pay ?? row?.overtimePay) +
    netTips(row) +
    num(row?.extra_pay ?? row?.extraPay)
  )
}

export const payrollEntryKey = row => [
  String(row?.employee_id || row?.employee_name || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  String(row?.pay_date || row?.payroll_date || row?.date || '').slice(0, 10),
  String(row?.source_file || row?.source || '')
].join('::')

export function groupPayrollByEmployee(rows = []) {
  const map = new Map()
  for (const row of rows) {
    const key = String(row?.employee_id || row?.employee_name || 'unknown')
    if (!map.has(key)) {
      map.set(key, {
        key,
        employee_name: row?.employee_name || 'Unknown employee',
        rows: [],
        total: 0
      })
    }
    const group = map.get(key)
    group.rows.push(row)
    group.total = roundPayroll(group.total + payrollTotal(row))
  }

  return [...map.values()]
    .map(group => ({
      ...group,
      rows: group.rows.sort((a, b) => String(a?.pay_date || '').localeCompare(String(b?.pay_date || '')))
    }))
    .sort((a, b) => a.employee_name.localeCompare(b.employee_name))
}
