import {
  netTips,
  normalizePayrollAliases,
  originalTips,
  payrollTotal,
  tipsWithheld,
  roundPayroll,
} from '../engines/PayrollEngine.js'

const number = value => Number(String(value ?? '').replace(/[$,%]/g, '').trim()) || 0

export const formatMoney = value => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2,
}).format(number(value))

export function toPayrollViewRow(raw = {}) {
  const row = normalizePayrollAliases(raw)
  return {
    ...raw,
    date: raw.pay_date || raw.payroll_date || raw.date || '',
    employee: raw.employee_name || raw.employee || 'Unknown employee',
    job: raw.job_type || raw.job || '',
    hours: roundPayroll(raw.hours || raw.regular_hours || 0).toFixed(1),
    basePay: formatMoney(raw.regular_pay ?? raw.base_pay ?? 0),
    originalTips: formatMoney(originalTips(row)),
    withheld: formatMoney(tipsWithheld(row)),
    tipsAfter: formatMoney(netTips(row)),
    extraPay: formatMoney(raw.extra_pay || 0),
    finalPay: formatMoney(payrollTotal(row)),
    method: raw.payment_method || raw.method || 'Cash',
    calculated: row,
  }
}

export function summarizePayroll(rows = []) {
  const normalized = rows.filter(row => row.payroll_status !== 'rolled-up').map(normalizePayrollAliases)
  const total = normalized.reduce((sum, row) => sum + payrollTotal(row), 0)
  // Customer-owned tips are pass-through payments. Keep them in payroll/payment
  // history, but exclude them from restaurant labor used by Prime Cost/P&L.
  const tipsEarned = normalized.reduce((sum, row) => sum + originalTips(row), 0)
  const tipsWithheldTotal = normalized.reduce((sum, row) => sum + tipsWithheld(row), 0)
  const netTipsPaid = normalized.reduce((sum, row) => sum + netTips(row), 0)
  const roleText = row => String(row.job_type || row.job || row.position || row.role || row.employee_type || '').toLowerCase()
  const isWaiter = row => /waiter|waitress|server|front.?of.?house|foh/.test(roleText(row))
  const isManager = row => /general manager|restaurant manager|store manager|\bmanager\b|management/.test(roleText(row)) && !/assistant manager|assistant mgr|asst\.? manager|asistente manager/.test(roleText(row))
  const restaurantFunded = row => Math.max(0, payrollTotal(row) - netTips(row))
  // P&L rule: waiter/server compensation is customer-tip pass-through and excluded.
  // Manager payroll is tracked separately because it is allocated into Food/Alcohol cost.
  const managerLabor = normalized.filter(row => !isWaiter(row) && isManager(row)).reduce((sum,row)=>sum+restaurantFunded(row),0)
  const operatingLabor = normalized.filter(row => !isWaiter(row) && !isManager(row)).reduce((sum,row)=>sum+restaurantFunded(row),0)
  const cash = normalized.filter(row => String(row.payment_method || row.method).toLowerCase() === 'cash')
    .reduce((sum, row) => sum + payrollTotal(row), 0)
  const check = normalized.filter(row => String(row.payment_method || row.method).toLowerCase() === 'check')
    .reduce((sum, row) => sum + payrollTotal(row), 0)
  const hours = normalized.reduce((sum, row) => sum + number(row.hours || row.regular_hours), 0)
  return { total: roundPayroll(total), operatingLabor: roundPayroll(operatingLabor), managerLabor: roundPayroll(managerLabor), tipsEarned: roundPayroll(tipsEarned), tipsWithheld: roundPayroll(tipsWithheldTotal), netTipsPaid: roundPayroll(netTipsPaid), cash: roundPayroll(cash), check: roundPayroll(check), hours: roundPayroll(hours) }
}
