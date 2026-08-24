const text = value => String(value ?? '').trim().toLowerCase()
const plainMoney = value => String(value ?? '').replace(/[$,]/g, '')

export function filterPayrollRows(rows = [], { query = '', method = 'All Methods', columns = {} } = {}) {
  const q = text(query)
  const methodFilter = text(method)
  const contains = (value, needle) => !text(needle) || text(value).includes(text(needle))
  return (Array.isArray(rows) ? rows : []).filter(Boolean).filter(row => {
    const searchable = Object.values(row).map(value => String(value ?? '')).join(' ').toLowerCase()
    if (q && !searchable.includes(q)) return false
    if (methodFilter && methodFilter !== 'all methods' && text(row.method) !== methodFilter) return false
    if (columns.date && String(row.date || '') !== String(columns.date)) return false
    if (!contains(row.employee, columns.employee)) return false
    if (!contains(row.job, columns.job)) return false
    if (!contains(row.hours, columns.hours)) return false
    if (!contains(plainMoney(row.basePay), columns.basePay)) return false
    if (!contains(plainMoney(row.originalTips), columns.tips)) return false
    if (!contains(plainMoney(row.withheld), columns.withheld)) return false
    if (!contains(plainMoney(row.tipsAfter), columns.netTips)) return false
    if (!contains(plainMoney(row.finalPay), columns.finalPay)) return false
    if (columns.method && text(row.method) !== text(columns.method)) return false
    if (columns.status && text(row.payment_status) !== text(columns.status)) return false
    return true
  })
}
