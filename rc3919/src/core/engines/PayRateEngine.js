const number = value => Number(String(value ?? 0).replace(/[$,%(),]/g, '')) || 0
const text = value => String(value ?? '').trim()

export function effectivePayRate(payRates = [], employeeId, effectiveDate, fallback = 0) {
  const employeeKey = text(employeeId)
  const date = text(effectiveDate)
  const matches = (Array.isArray(payRates) ? payRates : [])
    .filter(row => text(row?.employee_id) === employeeKey && text(row?.effective_date) && (!date || text(row.effective_date) <= date))
    .sort((a,b) => text(b.effective_date).localeCompare(text(a.effective_date)) || text(b.created_at).localeCompare(text(a.created_at)))
  return matches.length ? number(matches[0].amount ?? matches[0].base_pay ?? matches[0].rate) : number(fallback)
}

export function payRateHistory(payRates = [], employeeId) {
  const employeeKey = text(employeeId)
  return (Array.isArray(payRates) ? payRates : [])
    .filter(row => text(row?.employee_id) === employeeKey)
    .sort((a,b) => text(b.effective_date).localeCompare(text(a.effective_date)) || text(b.created_at).localeCompare(text(a.created_at)))
}

export function normalizeEffectiveWeekStart(value) {
  if (!value) return ''
  const [y,m,d] = String(value).slice(0,10).split('-').map(Number)
  if (!y || !m || !d) return ''
  const date = new Date(Date.UTC(y,m-1,d))
  const day = date.getUTCDay()
  const delta = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0,10)
}
