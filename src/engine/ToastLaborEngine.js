function norm(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function text(value) { return String(value ?? '').trim() }
function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw)
  const parsed = Number(raw.replace(/[$,%(),]/g, '').trim())
  if (!Number.isFinite(parsed)) return 0
  return negative ? -Math.abs(parsed) : parsed
}
function round2(value) { return Math.round((Number(value) || 0) * 100) / 100 }
function money(value) { return round2(value).toFixed(2) }

const ALIASES = {
  name: ['Employee', 'Employee Name', 'Team Member', 'Team Member Name', 'Staff', 'Staff Name', 'Name'],
  employeeId: ['Employee ID', 'Employee Id', 'Team Member ID', 'Team Member Id', 'Payroll ID'],
  job: ['Job', 'Job Title', 'Job Type', 'Role', 'Department', 'Position'],
  date: ['Date', 'Business Date', 'Business Day', 'Shift Date', 'Date Worked', 'Work Date', 'Clock In Date', 'Payroll Date', 'Pay Date', 'Week Ending', 'Period End'],
  regularHours: ['Regular Hours', 'Reg Hours', 'Regular Hrs', 'Reg Hrs'],
  overtimeHours: ['Overtime Hours', 'OT Hours', 'Overtime Hrs', 'OT Hrs'],
  doubleHours: ['Double Time Hours', 'Doubletime Hours', 'DT Hours'],
  totalHours: ['Total Hours', 'Hours', 'Worked Hours', 'Paid Hours'],
  rate: ['Hourly Rate', 'Pay Rate', 'Rate', 'Base Rate'],
  regularPay: ['Regular Pay', 'Regular Wages', 'Wages', 'Labor Cost', 'Hourly Pay'],
  overtimePay: ['Overtime Pay', 'OT Pay'],
  grossPay: ['Gross Pay', 'Gross Wages', 'Total Pay', 'Pay Amount', 'Earnings'],
  totalTips: ['Total Tips', 'Tips', 'Declared Tips', 'Tips Earned', 'Tips Paid', 'Total Tips Paid', 'Employee Tips', 'Tip Amount'],
  creditTips: ['Credit Card Tips', 'Credit Tips', 'Non-Cash Tips', 'Non Cash Tips', 'Card Tips', 'CC Tips', 'Credit Card Gratuity'],
  cashTips: ['Cash Tips', 'Declared Cash Tips', 'Cash Gratuity'],
  netTips: ['Tips After Withholding', 'Tips After Withheld', 'Net Tips', 'Final Tips', 'Tips Net', 'Net Tip Pay'],
  withheld: ['Tips Withheld', 'Tip Withheld', 'Tips Withholding', 'Withheld Tips', 'Tip Deduction', 'Tips Deducted', 'Tip Withhold'],
  checkNumber: ['Check Number', 'Check #', 'Check No', 'Check No.', 'Payment Number', 'Reference Number']
}

function makeMap(row = {}) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [norm(key), value]))
}
function find(row, aliases) {
  const map = makeMap(row)
  for (const alias of aliases) {
    const value = map[norm(alias)]
    if (value !== undefined && value !== '') return value
  }
  const entries = Object.entries(map)
  for (const alias of aliases) {
    const wanted = norm(alias)
    if (wanted.length < 4) continue
    const match = entries.find(([key, value]) => value !== undefined && value !== '' && (key.includes(wanted) || wanted.includes(key)))
    if (match) return match[1]
  }
  return ''
}
function has(row, aliases) {
  const map = makeMap(row)
  return aliases.some(alias => map[norm(alias)] !== undefined)
}
function parseDate(value, fallback = '') {
  if (!value) return fallback
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = text(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const m = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString().slice(0, 10)
}


function parseDateTokens(value) {
  const raw = text(value)
  if (!raw) return []
  const matches = []
  const patterns = [
    /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/g,
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(raw))) {
      if (match[1].length === 4) matches.push(`${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`)
      else {
        const year = match[3].length === 2 ? `20${match[3]}` : match[3]
        matches.push(`${year}-${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`)
      }
    }
  }
  return matches.filter((value, index, all) => all.indexOf(value) === index)
}

export function detectToastLaborPeriod(XLSX, workbook) {
  const labeled = []
  const allDates = []
  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }).slice(0, 60)
    for (const row of matrix) {
      const line = row.map(text).filter(Boolean).join(' | ')
      const dates = parseDateTokens(line)
      if (!dates.length) continue
      allDates.push(...dates)
      if (/date range|report range|pay period|payroll period|business date|week ending|period start|period end|from.+to/i.test(line)) labeled.push(...dates)
    }
  }
  const candidates = (labeled.length ? labeled : allDates).filter(Boolean).sort()
  if (!candidates.length) return { start: '', end: '', label: '' }
  const start = candidates[0]
  const end = candidates[candidates.length - 1]
  return { start, end, label: start === end ? start : `${start} to ${end}` }
}


function parsePeriodFromFileName(fileName = '') {
  const dates = parseDateTokens(String(fileName).replace(/_/g, '-'))
  if (dates.length < 2) return { start: '', end: '', label: '' }
  const sorted = dates.sort()
  const start = sorted[0]
  const end = sorted[sorted.length - 1]
  return { start, end, label: start === end ? start : `${start} to ${end}` }
}

function inclusiveDates(start, end) {
  if (!start || !end) return []
  const first = new Date(`${start}T12:00:00Z`)
  const last = new Date(`${end}T12:00:00Z`)
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || first > last) return []
  const dates = []
  for (let cursor = new Date(first); cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10))
    if (dates.length > 366) break
  }
  return dates
}

function allocateAcrossDates(total, dates, precision = 2) {
  if (!dates.length) return []
  const factor = 10 ** precision
  const totalUnits = Math.round((Number(total) || 0) * factor)
  const baseUnits = Math.trunc(totalUnits / dates.length)
  let remainder = totalUnits - baseUnits * dates.length
  return dates.map(() => {
    const adjustment = remainder > 0 ? 1 : remainder < 0 ? -1 : 0
    remainder -= adjustment
    return (baseUnits + adjustment) / factor
  })
}

function expandSummaryRowsByPeriod(rows, reportPeriod, tipRate) {
  const dates = inclusiveDates(reportPeriod.start, reportPeriod.end)
  if (dates.length <= 1) return rows
  return rows.flatMap(row => {
    if (row.has_business_date) return [row]
    const hours = allocateAcrossDates(row.hours, dates, 2)
    const regularHours = allocateAcrossDates(row.regular_hours, dates, 2)
    const overtimeHours = allocateAcrossDates(row.overtime_hours, dates, 2)
    const regularPay = allocateAcrossDates(row.regular_pay, dates, 2)
    const grossPay = allocateAcrossDates(row.gross_pay, dates, 2)
    const totalTips = allocateAcrossDates(row.total_tips, dates, 2)
    const explicitDeduction = row.has_explicit_withholding
      ? allocateAcrossDates(row.tip_deduction, dates, 2)
      : null
    return dates.map((date, index) => {
      const deduction = explicitDeduction
        ? explicitDeduction[index]
        : round2(totalTips[index] * tipRate / 100)
      return {
        ...row,
        pay_date: date,
        allocated_from_summary: true,
        allocation_method: 'evenly-across-report-period',
        allocation_days: dates.length,
        hours: hours[index],
        regular_hours: regularHours[index],
        overtime_hours: overtimeHours[index],
        regular_pay: regularPay[index],
        gross_pay: grossPay[index],
        total_tips: totalTips[index],
        tip_deduction: deduction,
        tips: round2(Math.max(totalTips[index] - deduction, 0))
      }
    })
  })
}

function headerScore(values = []) {
  const keys = values.map(norm).filter(Boolean)
  const includesAny = aliases => aliases.some(alias => keys.includes(norm(alias)))
  let score = 0
  if (includesAny(ALIASES.name)) score += 5
  if (includesAny(ALIASES.totalHours) || includesAny(ALIASES.regularHours)) score += 3
  if (includesAny(ALIASES.grossPay) || includesAny(ALIASES.regularPay)) score += 2
  if (includesAny(ALIASES.totalTips) || includesAny(ALIASES.creditTips) || includesAny(ALIASES.netTips)) score += 2
  if (includesAny(ALIASES.job)) score += 1
  return score
}

function sheetRows(XLSX, workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  let bestIndex = -1
  let bestScore = 0
  matrix.slice(0, 40).forEach((row, index) => {
    const score = headerScore(row)
    if (score > bestScore) { bestScore = score; bestIndex = index }
  })
  if (bestIndex < 0 || bestScore < 5) return []
  const headers = matrix[bestIndex].map((value, index) => text(value) || `Column ${index + 1}`)
  return matrix.slice(bestIndex + 1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

function candidateSheets(XLSX, workbook) {
  return workbook.SheetNames.map((name, index) => {
    const rows = sheetRows(XLSX, workbook, name)
    const nameScore = /labor|employee|payroll|time|tips|team/i.test(name) ? 5 : 0
    const rowScore = rows.length ? headerScore(Object.keys(rows[0])) : 0
    return { name, rows, score: nameScore + rowScore + Math.min(rows.length / 100, 2), index }
  }).filter(item => item.rows.length).sort((a, b) => b.score - a.score || a.index - b.index)
}

function isSummaryName(value) {
  const name = text(value).toLowerCase()
  return !name || /^(total|grand total|subtotal|all employees|employee total|labor total|summary)$/i.test(name)
}

export function parseToastLaborRows(XLSX, workbook, options = {}) {
  const detectedPeriod = options.reportPeriod || detectToastLaborPeriod(XLSX, workbook)
  const filePeriod = parsePeriodFromFileName(options.fileName || '')
  const reportPeriod = detectedPeriod.start ? detectedPeriod : filePeriod
  const fallbackDate = reportPeriod.end || options.payDate || ''
  const tipRate = Number(options.tipRate ?? 3.5) || 0
  const sheets = candidateSheets(XLSX, workbook)
  const selected = sheets.filter((sheet, index) => index === 0 || /labor|employee|payroll|time|tips|team|shift|daily/i.test(sheet.name))
  const sourceRows = selected.flatMap(sheet => sheet.rows.map(row => ({ row, sheetName: sheet.name })))

  const parsed = sourceRows.map(({ row, sheetName }) => {
    const rawName = text(find(row, ALIASES.name))
    if (isSummaryName(rawName)) return null

    const rowDateValue = find(row, ALIASES.date)
    const sheetDate = parseDateTokens(sheetName)[0] || ''
    const explicitDate = parseDate(rowDateValue, sheetDate)
    const regularHours = num(find(row, ALIASES.regularHours))
    const overtimeHours = num(find(row, ALIASES.overtimeHours))
    const doubleHours = num(find(row, ALIASES.doubleHours))
    const explicitTotalHours = num(find(row, ALIASES.totalHours))
    const hours = round2(explicitTotalHours || regularHours + overtimeHours + doubleHours)
    const rate = round2(num(find(row, ALIASES.rate)))
    const regularPay = num(find(row, ALIASES.regularPay))
    const overtimePay = num(find(row, ALIASES.overtimePay))
    const grossPay = num(find(row, ALIASES.grossPay))
    const pay = round2(grossPay || regularPay + overtimePay || hours * rate)
    const explicitTotalTips = has(row, ALIASES.totalTips) ? find(row, ALIASES.totalTips) : ''
    const creditTips = num(find(row, ALIASES.creditTips))
    const cashTips = num(find(row, ALIASES.cashTips))
    const totalTips = round2(explicitTotalTips !== '' ? num(explicitTotalTips) : creditTips + cashTips)
    const explicitNetTips = find(row, ALIASES.netTips)
    const explicitWithheld = find(row, ALIASES.withheld)
    const withheld = round2(explicitWithheld !== '' ? num(explicitWithheld) : explicitNetTips !== '' ? Math.max(totalTips - num(explicitNetTips), 0) : totalTips * tipRate / 100)
    const netTips = round2(explicitNetTips !== '' ? num(explicitNetTips) : Math.max(totalTips - withheld, 0))
    if (!hours && !pay && !totalTips && !netTips) return null

    return {
      raw_name: rawName,
      employee_name: rawName,
      employee_external_id: text(find(row, ALIASES.employeeId)),
      job_type: text(find(row, ALIASES.job)),
      pay_date: explicitDate || fallbackDate,
      has_business_date: Boolean(explicitDate),
      period_start: reportPeriod.start || '',
      period_end: reportPeriod.end || '',
      period_label: reportPeriod.label || '',
      hours,
      regular_hours: round2(regularHours),
      overtime_hours: round2(overtimeHours),
      rate,
      regular_pay: pay,
      gross_pay: round2(grossPay),
      total_tips: totalTips,
      tips: netTips,
      tip_deduction: withheld,
      has_explicit_withholding: explicitWithheld !== '' || explicitNetTips !== '',
      check_number: text(find(row, ALIASES.checkNumber)),
      source_sheet: sheetName,
      source_columns: Object.keys(row)
    }
  }).filter(Boolean)

  // Toast workbooks often contain both an employee summary and dated shift/day detail.
  // When dated detail exists, discard undated summary rows so totals are not duplicated.
  const datedRows = parsed.filter(row => row.has_business_date)
  const rowsToGroup = datedRows.length
    ? datedRows
    : expandSummaryRowsByPeriod(parsed, reportPeriod, tipRate)
  const grouped = new Map()

  for (const row of rowsToGroup) {
    const employeeKey = norm(row.employee_external_id || row.employee_name)
    const dateKey = row.pay_date || fallbackDate
    const key = `${employeeKey}::${dateKey}`
    const current = grouped.get(key)
    if (!current) {
      grouped.set(key, { ...row, source_sheets: [row.source_sheet] })
      continue
    }
    const combinedTips = round2(current.total_tips + row.total_tips)
    const combinedDeduction = current.has_explicit_withholding || row.has_explicit_withholding
      ? round2(current.tip_deduction + row.tip_deduction)
      : round2(combinedTips * tipRate / 100)
    grouped.set(key, {
      ...current,
      job_type: current.job_type || row.job_type,
      hours: round2(current.hours + row.hours),
      regular_hours: round2(current.regular_hours + row.regular_hours),
      overtime_hours: round2(current.overtime_hours + row.overtime_hours),
      regular_pay: round2(current.regular_pay + row.regular_pay),
      gross_pay: round2(current.gross_pay + row.gross_pay),
      total_tips: combinedTips,
      tip_deduction: combinedDeduction,
      tips: round2(Math.max(combinedTips - combinedDeduction, 0)),
      has_explicit_withholding: current.has_explicit_withholding || row.has_explicit_withholding,
      check_number: current.check_number || row.check_number,
      source_sheet: current.source_sheet === row.source_sheet ? current.source_sheet : 'Multiple Toast sheets',
      source_sheets: [...new Set([...(current.source_sheets || []), row.source_sheet])]
    })
  }

  return [...grouped.values()].sort((a, b) =>
    String(a.pay_date).localeCompare(String(b.pay_date)) || String(a.employee_name).localeCompare(String(b.employee_name))
  )
}

export function laborImportDiagnostics(rows = []) {
  return {
    rows: rows.length,
    hours: round2(rows.reduce((sum, row) => sum + num(row.hours), 0)),
    regularPay: round2(rows.reduce((sum, row) => sum + num(row.regular_pay), 0)),
    totalTips: round2(rows.reduce((sum, row) => sum + num(row.total_tips), 0)),
    netTips: round2(rows.reduce((sum, row) => sum + num(row.tips), 0)),
    withheld: round2(rows.reduce((sum, row) => sum + num(row.tip_deduction), 0))
  }
}

export const ToastLaborUtils = { money, round2, num }
