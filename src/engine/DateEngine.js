export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function startOfMonthISO(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10)
}

export function readGlobalDateRange() {
  try {
    const saved = JSON.parse(localStorage.getItem('restapay_global_date_range') || '{}')
    return {
      start: saved.start || startOfMonthISO(),
      end: saved.end || todayISO()
    }
  } catch {
    return { start: startOfMonthISO(), end: todayISO() }
  }
}

export function saveGlobalDateRange(start, end) {
  try {
    localStorage.setItem('restapay_global_date_range', JSON.stringify({ start, end }))
  } catch {}
}

export function isDateInRange(dateText, start, end) {
  const date = String(dateText || '').slice(0, 10)
  if (!date) return false
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

export function makeRangeLabel(start, end) {
  return `${start || 'First record'} to ${end || 'Latest record'}`
}
