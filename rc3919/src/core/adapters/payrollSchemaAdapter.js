const n = value => Number(String(value ?? '').replace(/[$,%(),]/g, '').trim()) || 0
const round2 = value => Math.round(n(value) * 100) / 100
const text = value => String(value ?? '').trim()
const today = () => new Date().toISOString().slice(0, 10)

/**
 * Canonical payroll shape mirrors the existing Supabase payroll_entries table.
 * UI aliases are added only for local compatibility; toSupabasePayrollEntry()
 * strips them before any future database write.
 */
export function normalizePayrollRecord(row = {}, defaults = {}) {
  const originalTips = round2(row.original_tips ?? row.credit_card_tips ?? row.total_tips ?? 0)
  const withheld = round2(originalTips * 0.035)
  const netTips = round2(originalTips - withheld)
  const regularPay = round2(row.regular_pay ?? row.base_pay ?? row.gross_pay ?? 0)
  const extraPay = round2(row.extra_pay ?? 0)
  const total = round2(row.total ?? row.total_pay ?? row.amount ?? (regularPay + netTips + extraPay))
  const payrollDate = row.payroll_date || row.pay_date || row.date || defaults.payroll_date || today()
  const method = row.method || row.payment_method || row.payroll_type || defaults.method || 'Check'
  const now = new Date().toISOString()

  return {
    ...row,
    id: row.id || crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    employee_id: row.employee_id || defaults.employee_id || null,
    employee_name: text(row.employee_name || row.employee || defaults.employee_name) || 'Unknown employee',
    source: row.source || defaults.source || 'Manual',
    pay_type: row.pay_type || defaults.pay_type || 'Hourly',
    method,
    check_number: text(row.check_number),
    payroll_date: payrollDate,
    hours: round2(row.hours ?? row.regular_hours ?? 0),
    regular_pay: regularPay,
    tips_after_withheld: netTips,
    tips_withheld: withheld,
    extra_pay: extraPay,
    extra_reason: text(row.extra_reason),
    total,
    group_id: row.group_id || null,
    group_name: text(row.group_name),
    created_at: row.created_at || now,
    updated_at: now,

    // UI/engine aliases. These are never sent to Supabase.
    pay_date: payrollDate,
    payment_method: method,
    payroll_type: method,
    original_tips: originalTips,
    credit_card_tips: originalTips,
    tip_deduction: withheld,
    tips_after_withholding: netTips,
    tips: netTips,
    total_pay: total,
    job_type: row.job_type || row.job || defaults.job_type || '',
  }
}

export function toSupabasePayrollEntry(row = {}) {
  const normalized = normalizePayrollRecord(row)
  return {
    id: normalized.id,
    employee_id: normalized.employee_id,
    employee_name: normalized.employee_name,
    source: normalized.source,
    pay_type: normalized.pay_type,
    method: normalized.method,
    check_number: normalized.check_number,
    payroll_date: normalized.payroll_date,
    hours: normalized.hours,
    regular_pay: normalized.regular_pay,
    tips_after_withheld: normalized.tips_after_withheld,
    tips_withheld: normalized.tips_withheld,
    extra_pay: normalized.extra_pay,
    extra_reason: normalized.extra_reason,
    total: normalized.total,
    group_id: normalized.group_id,
    group_name: normalized.group_name,
    created_at: normalized.created_at,
    updated_at: normalized.updated_at,
  }
}

export function normalizePayrollRecords(rows = [], defaults = {}) {
  return rows.map(row => normalizePayrollRecord(row, defaults))
}
