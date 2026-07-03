export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function startOfMonthISO(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10)
}

export function readPageDateRange(page = 'workspace') {
  try {
    const saved = JSON.parse(localStorage.getItem(`restapay_${page}_date_range`) || '{}')
    return { start: saved.start || startOfMonthISO(), end: saved.end || todayISO() }
  } catch {
    return { start: startOfMonthISO(), end: todayISO() }
  }
}

export function savePageDateRange(page = 'workspace', start, end) {
  try { localStorage.setItem(`restapay_${page}_date_range`, JSON.stringify({ start, end })) } catch {}
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


export function shiftDateISO(days, date = new Date()) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function startOfLastMonthISO(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1).toISOString().slice(0, 10)
}

export function endOfLastMonthISO(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 0).toISOString().slice(0, 10)
}

export function lastWeekRangeISO(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() || 7
  const thisMonday = new Date(d)
  thisMonday.setDate(d.getDate() - day + 1)
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  const lastSunday = new Date(lastMonday)
  lastSunday.setDate(lastMonday.getDate() + 6)
  return { start: lastMonday.toISOString().slice(0, 10), end: lastSunday.toISOString().slice(0, 10) }
}

export function getPresetRange(preset) {
  if (preset === 'today') return { start: todayISO(), end: todayISO() }
  if (preset === 'lastWeek') return lastWeekRangeISO()
  if (preset === 'lastMonth') return { start: startOfLastMonthISO(), end: endOfLastMonthISO() }
  if (preset === 'thisMonth') return { start: startOfMonthISO(), end: todayISO() }
  if (preset === 'all') return { start: '', end: '' }
  return readPageDateRange('workspace')
}

export function applyPresetToSetters(preset, setStart, setEnd, saveFn = () => {}) {
  const range = getPresetRange(preset)
  setStart(range.start)
  setEnd(range.end)
  saveFn(range.start, range.end)
  return range
}
