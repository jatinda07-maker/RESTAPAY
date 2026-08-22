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

const roleText = row => [row?.labor_classification,row?.payroll_classification,row?.classification,row?.employee_type,row?.job_type,row?.job,row?.position,row?.role,row?.department,row?.group_name,row?.employee_name,row?.employee,row?.name].map(v=>String(v||'').toLowerCase()).join(' ')
export function payrollCostClass(row = {}) {
  const explicit = String(row?.labor_classification || '').trim().toLowerCase()
  if (['foh','front of house','front-of-house'].includes(explicit)) return 'front-of-house'
  if (['boh','kitchen','kitchen / boh','kitchen/boh','operating labor','operating-labor'].includes(explicit)) return 'operating-labor'
  if (['manager','management'].includes(explicit)) return 'management'
  if (['excluded','other','excluded / other','excluded/other'].includes(explicit)) return 'review'
  const t = roleText(row)
  if (/server|waiter|waitress|front house|foh|host|hostess|bartender|barback|tips? only|customer tip/.test(t)) return 'front-of-house'
  if (/assistant manager|assistant mgr|asst\.? manager|asistente manager|assistant general manager|general manager|restaurant manager|store manager|\bmanager\b|management/.test(t)) return 'management'
  if (/kitchen|cook|chef|prep|dishwasher|dish washer|busser|bus boy|line cook|food prep|back of house|boh/.test(t)) return 'operating-labor'
  return 'review'
}

export function summarizePayroll(rows = [], employees = []) {
  const byId = new Map((employees||[]).filter(e=>e?.id).map(e=>[String(e.id),e]))
  const byName = new Map((employees||[]).filter(e=>e?.name||e?.employee_name).map(e=>[String(e.name||e.employee_name).trim().toLowerCase(),e]))
  const normalized = rows.filter(row => row.payroll_status !== 'rolled-up').map(raw => {
    const employee = byId.get(String(raw.employee_id||'')) || byName.get(String(raw.employee_name||raw.employee||'').trim().toLowerCase())
    return normalizePayrollAliases(employee ? {...raw, job_type:raw.job_type||employee.job_type||employee.job, position:raw.position||employee.position, role:raw.role||employee.role, department:raw.department||employee.department, employee_type:raw.employee_type||employee.employee_type, payroll_classification:raw.payroll_classification||employee.payroll_classification} : raw)
  })
  const total = normalized.reduce((sum, row) => sum + payrollTotal(row), 0)
  // Customer-owned tips are pass-through payments. Keep them in payroll/payment
  // history, but exclude them from restaurant labor used by Prime Cost/P&L.
  const tipsEarned = normalized.reduce((sum, row) => sum + originalTips(row), 0)
  const tipsWithheldTotal = normalized.reduce((sum, row) => sum + tipsWithheld(row), 0)
  const netTipsPaid = normalized.reduce((sum, row) => sum + netTips(row), 0)
  const operatingRows = normalized.filter(row => payrollCostClass(row) === 'operating-labor')
  const managementRows = normalized.filter(row => payrollCostClass(row) === 'management')
  const frontOfHouseRows = normalized.filter(row => payrollCostClass(row) === 'front-of-house')
  const reviewRows = normalized.filter(row => payrollCostClass(row) === 'review')
  const operatingLabor = operatingRows.reduce((sum, row) => sum + Math.max(0, payrollTotal(row) - netTips(row)), 0)
  const managementPayroll = managementRows.reduce((sum,row)=>sum+Math.max(0,payrollTotal(row)-netTips(row)),0)
  const frontOfHousePayroll = frontOfHouseRows.reduce((sum,row)=>sum+Math.max(0,payrollTotal(row)-netTips(row)),0)
  const reviewPayroll = reviewRows.reduce((sum,row)=>sum+Math.max(0,payrollTotal(row)-netTips(row)),0)
  const cash = normalized.filter(row => String(row.payment_method || row.method).toLowerCase() === 'cash')
    .reduce((sum, row) => sum + payrollTotal(row), 0)
  const check = normalized.filter(row => String(row.payment_method || row.method).toLowerCase() === 'check')
    .reduce((sum, row) => sum + payrollTotal(row), 0)
  const hours = normalized.reduce((sum, row) => sum + number(row.hours || row.regular_hours), 0)
  return { total: roundPayroll(total), operatingLabor: roundPayroll(operatingLabor), managementPayroll:roundPayroll(managementPayroll), frontOfHousePayroll:roundPayroll(frontOfHousePayroll), reviewPayroll:roundPayroll(reviewPayroll), operatingRows, managementRows, frontOfHouseRows, reviewRows, tipsEarned: roundPayroll(tipsEarned), tipsWithheld: roundPayroll(tipsWithheldTotal), netTipsPaid: roundPayroll(netTipsPaid), cash: roundPayroll(cash), check: roundPayroll(check), hours: roundPayroll(hours) }
}
