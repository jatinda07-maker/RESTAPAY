import {
  netTips,
  normalizePayrollAliases,
  originalTips,
  payrollTotal,
  tipsWithheld,
  roundPayroll,
} from '../engines/PayrollEngine.js'

const number = value => Number(String(value ?? '').replace(/[$,%]/g, '').trim()) || 0

const canonicalText = value => String(value ?? '').trim()
const canonicalStatus = row => canonicalText(row?.payment_status || row?.status).toLowerCase()
const canonicalSource = row => canonicalText(row?.source || row?.source_type || row?.group_name).toLowerCase()
const canonicalEmployee = row => canonicalText(row?.employee_id || row?.employee_name || row?.employee || row?.name).toLowerCase().replace(/\s+/g, ' ')
const canonicalDate = row => canonicalText(row?.payroll_date || row?.pay_date || row?.date)
const canonicalPeriod = row => {
  const from = canonicalText(row?.week_start || row?.payroll_week_start || row?.period_start || canonicalDate(row))
  const to = canonicalText(row?.week_end || row?.payroll_week_end || row?.period_end || from)
  return { from, to }
}
const canonicalRollupKey = row => {
  const period = canonicalPeriod(row)
  return `${canonicalEmployee(row)}|${period.from}|${period.to}`
}
const canonicalExactKey = row => [
  canonicalEmployee(row), canonicalDate(row), canonicalSource(row),
  canonicalText(row?.payment_method || row?.method).toLowerCase(),
  number(row?.hours || row?.regular_hours).toFixed(4),
  number(row?.regular_pay ?? row?.base_pay).toFixed(2),
  number(row?.original_tips ?? row?.credit_card_tips).toFixed(2),
  number(row?.extra_pay).toFixed(2),
].join('|')

/**
 * One canonical payroll source for Dashboard, P&L, Reports and department costing.
 * A saved weekly rollup supersedes its imported/manual daily source rows for the same
 * employee + pay period; duplicate copies of the same source entry are collapsed.
 */
export function canonicalizePayrollRows(rows = []) {
  const source = (Array.isArray(rows) ? rows : []).filter(Boolean)
  const latestExact = new Map()
  source.forEach(row => {
    if (canonicalStatus(row) === 'rolled-up' || String(row?.payroll_status || '').trim().toLowerCase() === 'rolled-up') return
    const key = canonicalExactKey(row)
    const existing = latestExact.get(key)
    if (!existing) { latestExact.set(key, row); return }
    const stamp = item => canonicalText(item?.updated_at || item?.paid_at || item?.created_at)
    if (stamp(row) >= stamp(existing)) latestExact.set(key, row)
  })
  const exactRows = [...latestExact.values()]
  const rollups = new Map()
  const isRollup = row => Boolean(row?.weekly_rollup) || ['weekly-rollup','kitchen-weekly'].includes(canonicalSource(row)) || Boolean(row?.week_start && row?.week_end)
  const score = row => (canonicalStatus(row)==='paid'?40:canonicalStatus(row)==='approved'?30:0) + (canonicalSource(row)==='weekly-rollup'?20:canonicalSource(row)==='kitchen-weekly'?10:0)
  exactRows.filter(isRollup).forEach(row => {
    const key = canonicalRollupKey(row)
    const current = rollups.get(key)
    if (!current) { rollups.set(key,row); return }
    const stamp = item => canonicalText(item?.updated_at || item?.paid_at || item?.created_at)
    if (score(row) > score(current) || (score(row) === score(current) && stamp(row) >= stamp(current))) rollups.set(key,row)
  })
  return exactRows.filter(row => {
    const key = canonicalRollupKey(row)
    if (isRollup(row)) return rollups.get(key) === row
    return !rollups.has(key)
  })
}

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

export function employerWageAmount(row = {}) {
  const regularKeys = ['regular_pay','regularPay','fixed_pay','base_pay']
  const hasRegular = regularKeys.some(key => row?.[key] !== undefined && row?.[key] !== null && String(row?.[key]).trim() !== '')
  const regular = number(row?.regular_pay ?? row?.regularPay ?? row?.fixed_pay ?? row?.base_pay)
  const overtime = number(row?.overtime_pay ?? row?.overtimePay)
  const extra = number(row?.extra_pay)
  if (hasRegular || overtime || extra) return roundPayroll(Math.max(0, regular + overtime + extra))
  const explicit = number(row?.total_pay ?? row?.final_pay ?? row?.total ?? row?.amount)
  return roundPayroll(Math.max(0, explicit - netTips(row)))
}

export function payrollPaymentAmount(row = {}) {
  const explicitRaw = row?.total_pay ?? row?.final_pay ?? row?.total
  if (explicitRaw !== undefined && explicitRaw !== null && String(explicitRaw).trim() !== '' && number(explicitRaw) !== 0) return roundPayroll(number(explicitRaw))
  return roundPayroll(employerWageAmount(row) + netTips(row))
}

export function summarizePayroll(rows = [], employees = []) {
  const byId = new Map((employees||[]).filter(e=>e?.id).map(e=>[String(e.id),e]))
  const byName = new Map((employees||[]).filter(e=>e?.name||e?.employee_name).map(e=>[String(e.name||e.employee_name).trim().toLowerCase(),e]))
  const normalized = canonicalizePayrollRows(rows).map(raw => {
    const employee = byId.get(String(raw.employee_id||'')) || byName.get(String(raw.employee_name||raw.employee||'').trim().toLowerCase())
    const merged = employee ? {...raw, job_type:raw.job_type||employee.job_type||employee.job, position:raw.position||employee.position, role:raw.role||employee.role, department:raw.department||employee.department, employee_type:raw.employee_type||employee.employee_type, payroll_classification:raw.payroll_classification||employee.payroll_classification} : raw
    return {...normalizePayrollAliases(merged), __wagePay:employerWageAmount(merged), __paymentTotal:payrollPaymentAmount(merged)}
  })
  const paymentTotal = normalized.reduce((sum, row) => sum + number(row.__paymentTotal), 0)
  // Customer-owned tips are pass-through payments. Keep them in payroll/payment
  // history, but exclude them from restaurant labor used by Prime Cost/P&L.
  const tipsEarned = normalized.reduce((sum, row) => sum + originalTips(row), 0)
  const tipsWithheldTotal = normalized.reduce((sum, row) => sum + tipsWithheld(row), 0)
  const netTipsPaid = normalized.reduce((sum, row) => sum + netTips(row), 0)
  const operatingRows = normalized.filter(row => payrollCostClass(row) === 'operating-labor')
  const managementRows = normalized.filter(row => payrollCostClass(row) === 'management')
  const frontOfHouseRows = normalized.filter(row => payrollCostClass(row) === 'front-of-house')
  const reviewRows = normalized.filter(row => payrollCostClass(row) === 'review')
  const operatingLabor = operatingRows.reduce((sum, row) => sum + number(row.__wagePay), 0)
  const managementPayroll = managementRows.reduce((sum,row)=>sum+number(row.__wagePay),0)
  const frontOfHousePayroll = frontOfHouseRows.reduce((sum,row)=>sum+number(row.__wagePay),0)
  const reviewPayroll = reviewRows.reduce((sum,row)=>sum+number(row.__wagePay),0)
  const cash = normalized.filter(row => String(row.payment_method || row.method).toLowerCase() === 'cash')
    .reduce((sum, row) => sum + number(row.__paymentTotal), 0)
  const check = normalized.filter(row => String(row.payment_method || row.method).toLowerCase() === 'check')
    .reduce((sum, row) => sum + number(row.__paymentTotal), 0)
  const hours = normalized.reduce((sum, row) => sum + number(row.hours || row.regular_hours), 0)
  return { total: roundPayroll(operatingLabor + managementPayroll + frontOfHousePayroll + reviewPayroll), paymentTotal: roundPayroll(paymentTotal), operatingLabor: roundPayroll(operatingLabor), managementPayroll:roundPayroll(managementPayroll), frontOfHousePayroll:roundPayroll(frontOfHousePayroll), reviewPayroll:roundPayroll(reviewPayroll), operatingRows, managementRows, frontOfHouseRows, reviewRows, tipsEarned: roundPayroll(tipsEarned), tipsWithheld: roundPayroll(tipsWithheldTotal), netTipsPaid: roundPayroll(netTipsPaid), cash: roundPayroll(cash), check: roundPayroll(check), hours: roundPayroll(hours) }
}
