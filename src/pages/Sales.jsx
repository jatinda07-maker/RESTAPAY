import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { createId } from '../lib/localStore'
import { parseToastSalesRows } from '../engine/ToastSalesEngine'
import { classifyMenuSale, menuSaleCategoryLabel } from '../engine/DepartmentCostEngine'

function today() { return new Date().toISOString().slice(0, 10) }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }
function startOfWeekISO(date = new Date()) { const d = new Date(date); const day = d.getDay(); d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10) }
function startOfMonthISO(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10) }
function endOfMonthISO(date = new Date()) { return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10) }
function money(value) { return Number(value || 0).toFixed(2) }
function num(value) {
  if (typeof value === 'number') return value
  const text = String(value ?? '').replace(/[$,%]/g, '').trim()
  if (!text) return 0
  if (/^\(.+\)$/.test(text)) return -Number(text.replace(/[()]/g, '')) || 0
  return Number(text) || 0
}
function round2(value) { return Number(money(value)) }
function normKey(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function findValue(row, keys) {
  const mapped = Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [normKey(k), v]))
  for (const key of keys) {
    const value = mapped[normKey(key)]
    if (value !== undefined && value !== '') return value
  }
  return ''
}
function formatDate(value) {
  if (!value) return today()
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') {
    if (/^\d{8}$/.test(String(Math.trunc(value)))) {
      const text = String(Math.trunc(value))
      return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
    }
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  const text = String(value).trim()
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  const date = new Date(text)
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  const match = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (match) {
    const [, m, d, y] = match
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return today()
}
function compactRows(rows) {
  return rows.filter(row => Object.values(row || {}).some(value => String(value ?? '').trim() !== ''))
}
function sheetMatrix(workbook, name) {
  const sheet = workbook.Sheets[name]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
}
function sheetObjects(workbook, name) {
  const sheet = workbook.Sheets[name]
  if (!sheet) return []
  return compactRows(XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }))
}
function headerValueRow(workbook, name) {
  const rows = sheetMatrix(workbook, name)
  const header = rows[0] || []
  const values = rows[1] || []
  const obj = {}
  header.forEach((key, index) => { if (key !== '') obj[key] = values[index] })
  return obj
}
function firstRowValue(workbook, sheetName, label, fallback = 0) {
  const obj = headerValueRow(workbook, sheetName)
  const value = findValue(obj, [label])
  return value === '' ? fallback : value
}
function paymentAmount(rows, type, subType = '') {
  const normalizedType = normKey(type)
  const normalizedSub = normKey(subType)
  const found = rows.find(row => normKey(row['Payment type']) === normalizedType && (!subType || normKey(row['Payment sub type']) === normalizedSub))
  return round2(num(found?.Amount))
}

const TOAST_ALCOHOL_CATEGORY_KEYS = new Set([
  'bottledbeer',
  'cocktailsshots',
  'cocktailsandshots',
  'draftbeer',
  'margaritas',
  'wine'
])

function toastSalesCategories(workbook) {
  const rows = sheetObjects(workbook, 'Sales category summary')
  const food = [], alcohol = [], excluded = [], other = []
  rows.forEach(row => {
    const category = String(findValue(row, ['Sales category', 'Category']) || '').trim()
    if (!category || /^total$/i.test(category)) return
    const entry = { category, itemCount: round2(num(findValue(row, ['Items', 'Item count']))), salesAmount: round2(num(findValue(row, ['Net sales', 'Net Sales']))) }
    const key = normKey(category)
    if (key === 'food') food.push(entry)
    else if (TOAST_ALCOHOL_CATEGORY_KEYS.has(key)) alcohol.push(entry)
    else if (key === 'nosalescategoryassigned') other.push(entry)
    else if (['nongratsvccharges', 'nongratservicecharges', 'servicecharges', 'tips', 'tax', 'taxes', 'discounts', 'giftcards', 'giftcard'].includes(key)) excluded.push(entry)
    else other.push(entry)
  })
  return {
    food, alcohol, excluded, other,
    foodTotal: round2(food.reduce((sum, row) => sum + row.salesAmount, 0)),
    alcoholTotal: round2(alcohol.reduce((sum, row) => sum + row.salesAmount, 0)),
    excludedTotal: round2(excluded.reduce((sum, row) => sum + row.salesAmount, 0)),
    otherTotal: round2(other.reduce((sum, row) => sum + row.salesAmount, 0))
  }
}
function distributeCategoryRows(rows, weights) {
  return weights.map((_, index) => rows.map(row => ({ ...row, itemCount: distributeMoney(row.itemCount, weights)[index], salesAmount: distributeMoney(row.salesAmount, weights)[index] })))
}
function absMoney(value) { return round2(Math.abs(num(value))) }
function cents(value) { return Math.round(num(value) * 100) }
function distributeMoney(total, weights) {
  const totalCents = cents(total)
  const sumWeights = weights.reduce((acc, value) => acc + Math.max(num(value), 0), 0)
  if (!sumWeights || !weights.length) return weights.map(() => 0)
  let used = 0
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return round2((totalCents - used) / 100)
    const share = Math.round((Math.max(num(weight), 0) / sumWeights) * totalCents)
    used += share
    return round2(share / 100)
  })
}

function toastTipBreakdown(tipSummary = {}) {
  const collected = round2(
    num(findValue(tipSummary, ['Total tips', 'Total Tips', 'Tips collected', 'Tips Collected', 'Actual tips', 'Actual Tips', 'Non-Cash Tips', 'Tips']))
  )
  const explicitWithheld = Math.abs(num(findValue(tipSummary, ['Tips withheld', 'Tips Withheld', 'Tip withholding', 'Tips withholding', 'Tip Deduction'])))
  const withheld = round2(explicitWithheld || (collected * 0.035))
  const explicitNet = round2(num(findValue(tipSummary, ['Tips after withholding', 'Tips After Withholding', 'Net tips', 'Net Tips', 'Final tips', 'Final Tips'])))
  const net = round2(explicitNet || Math.max(collected - withheld, 0))
  return { collected, withheld, net }
}

function extractRangeFromFileName(fileName) {
  const match = String(fileName || '').match(/(\d{4})[-_ ]?(\d{2})[-_ ]?(\d{2}).*?(\d{4})[-_ ]?(\d{2})[-_ ]?(\d{2})/)
  if (!match) return ''
  return `${match[1]}-${match[2]}-${match[3]} to ${match[4]}-${match[5]}-${match[6]}`
}

function shortNote(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text
    .replace('Toast range ', 'Toast ')
    .replace('; daily payments/tips allocated from weekly totals', '')
    .replace('Toast daily row; payments/tips allocated from summary totals', 'Toast daily allocation')
}

function displayMoney(value) {
  return `$${money(value)}`
}
function makeEmptySalesRow(fileName = 'Manual') {
  return { id: createId('sale'), business_date: today(), gross_sales: '0.00', net_sales: '0.00', cash_sales: '0.00', credit_sales: '0.00', gift_card_sales: '0.00', online_orders: '0.00', delivery_orders: '0.00', pickup_orders: '0.00', tips: '0.00', tips_collected: '0.00', tips_withheld: '0.00', tips_after_withholding: '0.00', refunds: '0.00', voids: '0.00', discounts: '0.00', tax: '0.00', guest_count: '0.00', source_file: fileName, import_note: '' }
}
function makeGenericSalesRow(row, fileName = 'Manual') {
  const gross = round2(num(findValue(row, ['Gross Sales', 'Gross', 'Total Sales', 'Sales'])))
  const net = round2(num(findValue(row, ['Net Sales', 'Net', 'Net Sales Total', 'Total Net Sales'])) || gross)
  const cash = round2(num(findValue(row, ['Cash', 'Cash Sales', 'Cash Payments', 'Cash Total'])))
  const credit = round2(num(findValue(row, ['Credit', 'Credit Sales', 'Credit Card Sales', 'Card Sales', 'Credit Cards', 'Credit/debit'])))
  const gift = round2(num(findValue(row, ['Gift Card', 'Gift Cards', 'Gift Card Sales', 'Gift Certificates'])))
  const online = round2(num(findValue(row, ['Online Orders', 'Online Sales', 'Online Ordering', 'Other', 'DoorDash'])))
  const delivery = round2(num(findValue(row, ['Delivery', 'Delivery Orders', 'Delivery Sales'])))
  const pickup = round2(num(findValue(row, ['Pickup', 'Pickup Orders', 'Takeout', 'Take Out'])))
  const genericTipSummary = {
    'Total tips': findValue(row, ['Total Tips', 'Tips Collected', 'Actual Tips', 'Non-Cash Tips', 'Tips']),
    'Tips withheld': findValue(row, ['Tips Withheld', 'Tips withholding', 'Tip Deduction']),
    'Tips after withholding': findValue(row, ['Tips after withholding', 'Net Tips', 'Final Tips'])
  }
  const tipBreakdown = toastTipBreakdown(genericTipSummary)
  const tips = tipBreakdown.net
  const refunds = absMoney(findValue(row, ['Refunds', 'Refund Amount', 'Sales Refunds', 'Returns']))
  const voids = absMoney(findValue(row, ['Voids', 'Void Amount']))
  const discounts = absMoney(findValue(row, ['Discounts', 'Discount Amount', 'Sales Discounts']))
  const tax = round2(num(findValue(row, ['Tax', 'Taxes', 'Tax Collected', 'Sales Tax', 'Tax amount'])))
  const guests = round2(num(findValue(row, ['Guest Count', 'Guests', 'Covers', 'Guest', 'Total guests'])))
  const date = formatDate(findValue(row, ['Business Date', 'Date', 'Opened Date', 'Order Date', 'yyyyMMdd']))
  return { ...makeEmptySalesRow(fileName), business_date: date, gross_sales: money(gross), net_sales: money(net), cash_sales: money(cash), credit_sales: money(credit), gift_card_sales: money(gift), online_orders: money(online), delivery_orders: money(delivery), pickup_orders: money(pickup), tips: money(tips), tips_collected: money(tipBreakdown.collected), tips_withheld: money(tipBreakdown.withheld), tips_after_withholding: money(tipBreakdown.net), refunds: money(refunds), voids: money(voids), discounts: money(discounts), tax: money(tax), guest_count: money(guests) }
}
function parseToastSalesWorkbook(workbook, fileName) {
  const hasToastSheets = workbook.SheetNames.includes('Revenue summary') || workbook.SheetNames.includes('Sales by day') || workbook.SheetNames.includes('Payments summary')
  if (!hasToastSheets) return []

  const netSummary = headerValueRow(workbook, 'Net sales summary')
  const tipSummary = headerValueRow(workbook, 'Tip summary')
  const payments = sheetObjects(workbook, 'Payments summary')
  const dayRows = sheetObjects(workbook, 'Sales by day').filter(row => num(findValue(row, ['Net sales'])))

  const gross = round2(num(findValue(netSummary, ['Gross sales'])) || num(firstRowValue(workbook, 'Revenue summary', 'Net sales')))
  const net = round2(num(findValue(netSummary, ['Net sales'])) || num(firstRowValue(workbook, 'Revenue summary', 'Net sales')))
  const discounts = absMoney(findValue(netSummary, ['Sales discounts']))
  const refunds = absMoney(findValue(netSummary, ['Sales refunds']))
  const toastTips = toastTipBreakdown(tipSummary)
  const tipsAfterWithholding = toastTips.net
  const tax = round2(num(firstRowValue(workbook, 'Revenue summary', 'Tax amount')) || num(findValue(headerValueRow(workbook, 'Tax summary'), ['Tax amount'])))
  const cash = paymentAmount(payments, 'Cash')
  const credit = paymentAmount(payments, 'Credit/debit')
  const gift = paymentAmount(payments, 'Gift Card')
  const online = paymentAmount(payments, 'Other') || paymentAmount(payments, 'Other', 'DoorDash')
  const totalGuests = dayRows.reduce((acc, row) => acc + num(findValue(row, ['Total guests', 'Guests', 'Guest Count'])), 0)
  const sourceRange = extractRangeFromFileName(fileName)
  const categories = toastSalesCategories(workbook)

  if (!dayRows.length) {
    return [{ ...makeEmptySalesRow(fileName), business_date: formatDate(sourceRange.split(' to ')[0] || today()), gross_sales: money(gross), net_sales: money(net), cash_sales: money(cash), credit_sales: money(credit), gift_card_sales: money(gift), online_orders: money(online), tips: money(tipsAfterWithholding), tips_collected: money(toastTips.collected), tips_withheld: money(toastTips.withheld), tips_after_withholding: money(toastTips.net), refunds: money(refunds), discounts: money(discounts), tax: money(tax), guest_count: money(totalGuests), food_sales: money(categories.foodTotal), alcohol_sales: money(categories.alcoholTotal), other_sales: money(categories.otherTotal), excluded_sales: money(categories.excludedTotal), food_sales_categories: categories.food, alcohol_sales_categories: categories.alcohol, other_sales_categories: categories.other, excluded_sales_categories: categories.excluded, import_note: sourceRange ? `Toast range ${sourceRange}; tips use 3.5% withholding` : 'Toast summary row; tips use 3.5% withholding' }]
  }

  const weights = dayRows.map(row => num(findValue(row, ['Net sales'])))
  const grossParts = distributeMoney(gross, weights)
  const cashParts = distributeMoney(cash, weights)
  const creditParts = distributeMoney(credit, weights)
  const giftParts = distributeMoney(gift, weights)
  const onlineParts = distributeMoney(online, weights)
  const tipParts = distributeMoney(tipsAfterWithholding, weights)
  const tipCollectedParts = distributeMoney(toastTips.collected, weights)
  const tipWithheldParts = distributeMoney(toastTips.withheld, weights)
  const refundParts = distributeMoney(refunds, weights)
  const discountParts = distributeMoney(discounts, weights)
  const taxParts = distributeMoney(tax, weights)
  const foodParts = distributeMoney(categories.foodTotal, weights)
  const alcoholParts = distributeMoney(categories.alcoholTotal, weights)
  const otherParts = distributeMoney(categories.otherTotal, weights)
  const excludedParts = distributeMoney(categories.excludedTotal, weights)
  const foodCategoryParts = distributeCategoryRows(categories.food, weights)
  const alcoholCategoryParts = distributeCategoryRows(categories.alcohol, weights)
  const otherCategoryParts = distributeCategoryRows(categories.other, weights)
  const excludedCategoryParts = distributeCategoryRows(categories.excluded, weights)

  return dayRows.map((row, index) => ({
    ...makeEmptySalesRow(fileName),
    business_date: formatDate(findValue(row, ['yyyyMMdd', 'Date', 'Business Date'])),
    gross_sales: money(grossParts[index]),
    net_sales: money(findValue(row, ['Net sales'])),
    cash_sales: money(cashParts[index]),
    credit_sales: money(creditParts[index]),
    gift_card_sales: money(giftParts[index]),
    online_orders: money(onlineParts[index]),
    tips: money(tipParts[index]),
    tips_collected: money(tipCollectedParts[index]),
    tips_withheld: money(tipWithheldParts[index]),
    tips_after_withholding: money(tipParts[index]),
    refunds: money(refundParts[index]),
    discounts: money(discountParts[index]),
    tax: money(taxParts[index]),
    guest_count: money(findValue(row, ['Total guests', 'Guests', 'Guest Count'])),
    food_sales: money(foodParts[index]),
    alcohol_sales: money(alcoholParts[index]),
    other_sales: money(otherParts[index]),
    excluded_sales: money(excludedParts[index]),
    food_sales_categories: foodCategoryParts[index],
    alcohol_sales_categories: alcoholCategoryParts[index],
    other_sales_categories: otherCategoryParts[index],
    excluded_sales_categories: excludedCategoryParts[index],
    import_note: sourceRange ? `Toast range ${sourceRange}; daily payments/tips allocated from weekly totals` : 'Toast daily row; payments/tips allocated from summary totals'
  }))
}


function readDepartmentDrilldown() {
  try {
    const value = JSON.parse(sessionStorage.getItem('restapay_sales_drilldown') || 'null')
    return value && ['food', 'alcohol'].includes(value.department) ? value : null
  } catch {
    return null
  }
}
function menuItemOverlapsRange(item = {}, start = '', end = '') {
  const itemStart = String(item.dateStart || item.date_start || '').slice(0, 10)
  const itemEnd = String(item.dateEnd || item.date_end || itemStart || '').slice(0, 10)
  if (!start && !end) return true
  if (!itemStart && !itemEnd) return true
  if (start && itemEnd && itemEnd < start) return false
  if (end && itemStart && itemStart > end) return false
  return true
}
function productMixSalesAmount(item = {}) {
  return num(item.netSales ?? item.net_sales ?? item.grossSales ?? item.gross_sales ?? item.sales ?? item.amount)
}

export default function Sales({ data, setData }) {
  const salesDays = data.salesDays || []
  const salesImports = data.salesImports || []
  const [previewRows, setPreviewRows] = useState([])
  const [status, setStatus] = useState('Local auto-save is active. Sales history will not disappear.')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('thisMonth')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [dateStart, setDateStart] = useState(() => startOfMonthISO())
  const [dateEnd, setDateEnd] = useState(() => today())
  const [editingId, setEditingId] = useState(null)
  const [editRow, setEditRow] = useState({})
  const [selectedIds, setSelectedIds] = useState([])
  const [departmentView, setDepartmentView] = useState(() => readDepartmentDrilldown())
  const menuItems = data.menuItems || []

  const departmentSalesRows = useMemo(() => {
    if (!departmentView) return []
    return menuItems
      .filter(item => menuItemOverlapsRange(item, departmentView.start || '', departmentView.end || ''))
      .map(item => ({
        ...item,
        department: classifyMenuSale(item),
        normalizedCategory: menuSaleCategoryLabel(item),
        salesAmount: productMixSalesAmount(item)
      }))
      .filter(item => item.department === departmentView.department && item.salesAmount !== 0)
      .sort((a, b) => b.salesAmount - a.salesAmount)
  }, [menuItems, departmentView])

  const departmentSalesTotal = useMemo(() => departmentSalesRows.reduce((sum, row) => sum + row.salesAmount, 0), [departmentSalesRows])

  function closeDepartmentView() {
    sessionStorage.removeItem('restapay_sales_drilldown')
    setDepartmentView(null)
  }

  function applyFilterPreset(value) {
    setFilter(value)
    const now = new Date()
    if (value === 'today') { const t = today(); setDateStart(t); setDateEnd(t); return }
    if (value === 'lastWeek' || value === 'week') {
      const day = now.getDay() || 7
      const thisMonday = new Date(now)
      thisMonday.setDate(now.getDate() - day + 1)
      const lastMonday = new Date(thisMonday)
      lastMonday.setDate(thisMonday.getDate() - 7)
      const lastSunday = new Date(lastMonday)
      lastSunday.setDate(lastMonday.getDate() + 6)
      setDateStart(lastMonday.toISOString().slice(0, 10)); setDateEnd(lastSunday.toISOString().slice(0, 10)); return
    }
    if (value === 'lastMonth') { setDateStart(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)); setDateEnd(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)); return }
    if (value === 'thisMonth' || value === 'month') { setDateStart(startOfMonthISO(now)); setDateEnd(today()); return }
    if (value === 'all') { setDateStart(''); setDateEnd(''); return }
  }

  const filteredSales = useMemo(() => {
    const q = search.toLowerCase().trim()
    return [...salesDays].sort((a, b) => String(a.business_date).localeCompare(String(b.business_date))).filter(row => {
      if (q && !String(row.business_date).includes(q) && !String(row.source_file || '').toLowerCase().includes(q) && !String(row.import_note || '').toLowerCase().includes(q)) return false
      if (dateStart && String(row.business_date) < dateStart) return false
      if (dateEnd && String(row.business_date) > dateEnd) return false
      const sourceText = `${row.source_file || ''} ${row.import_note || ''}`.toLowerCase()
      if (sourceFilter === 'toast' && !sourceText.includes('toast')) return false
      if (sourceFilter === 'manual' && sourceText.includes('toast')) return false
      if (paymentFilter === 'cash' && num(row.cash_sales) <= 0) return false
      if (paymentFilter === 'credit' && num(row.credit_sales) <= 0) return false
      if (paymentFilter === 'tips' && num(row.tips_after_withholding ?? row.tips) <= 0) return false
      return true
    })
  }, [salesDays, search, dateStart, dateEnd, sourceFilter, paymentFilter])

  const totals = useMemo(() => filteredSales.reduce((acc, row) => {
    acc.gross += num(row.gross_sales); acc.net += num(row.net_sales); acc.cash += num(row.cash_sales); acc.credit += num(row.credit_sales)
    acc.gift += num(row.gift_card_sales); acc.online += num(row.other_payments ?? row.online_orders); acc.tips += num(row.tips_after_withholding ?? row.tips); acc.refunds += num(row.refunds); acc.discounts += num(row.discounts); acc.tax += num(row.tax); acc.guests += num(row.guest_count)
    return acc
  }, { gross: 0, net: 0, cash: 0, credit: 0, gift: 0, online: 0, tips: 0, refunds: 0, discounts: 0, tax: 0, guests: 0 }), [filteredSales])

  async function handleSalesFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const toastRows = parseToastSalesRows(XLSX, workbook, file.name, createId)
      const rows = toastRows.length ? toastRows : workbook.SheetNames.flatMap(name => compactRows(XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '', raw: false }))).map(row => makeGenericSalesRow(row, file.name))
      const parsed = rows.filter(row => num(row.gross_sales) || num(row.net_sales) || num(row.cash_sales) || num(row.credit_sales) || num(row.tips))
      setPreviewRows(parsed)
      setStatus(parsed.length ? `Imported ${parsed.length} sales rows from ${toastRows.length ? 'Toast Sales Summary' : 'generic sheet'}. Review and save.` : 'No sales rows found. Check Toast export columns or upload another file.')
    } catch (error) {
      setStatus(`Sales import failed: ${error.message}`)
    }
    event.target.value = ''
  }

  function addManualSale() {
    const row = { ...makeEmptySalesRow('Manual Sales Entry'), import_note: 'Manual sales entry' }
    setPreviewRows(prev => [row, ...prev])
    setStatus('Manual sales row added. Enter values, then click Save Sales.')
  }

  function updatePreview(id, field, value) {
    setPreviewRows(prev => prev.map(row => row.id === id ? { ...row, [field]: field === 'business_date' || field === 'source_file' || field === 'import_note' ? value : value } : row))
  }
  function blurPreview(id, field, value) {
    if (field === 'business_date' || field === 'source_file' || field === 'import_note') return
    updatePreview(id, field, money(value))
  }
  function savePreview() {
    const rows = previewRows.map(row => ({ ...row, id: createId('sale') }))
    const sourceFiles = new Set(rows.map(row => String(row.source_file || '').trim()).filter(Boolean))
    const importedDates = rows.map(row => String(row.business_date || row.date || '')).filter(Boolean).sort()
    const rangeStart = importedDates[0] || ''
    const rangeEnd = importedDates[importedDates.length - 1] || ''
    const isToastImport = rows.some(row => /toast sales category summary/i.test(String(row.import_note || '')) || Array.isArray(row.alcohol_sales_categories))
    setData(prev => {
      // Toast exports are often downloaded again with names such as "(1)" or "(2)".
      // Replace the existing rows for the same business-date range, not only the exact
      // filename, so stale partial department totals cannot survive a corrected import.
      const keptSales = (prev.salesDays || []).filter(row => {
        const sameFile = sourceFiles.has(String(row.source_file || '').trim())
        const date = String(row.business_date || row.date || '')
        const overlapsRange = isToastImport && rangeStart && rangeEnd && date >= rangeStart && date <= rangeEnd
        return !sameFile && !overlapsRange
      })
      const keptImports = (prev.salesImports || []).filter(item => !sourceFiles.has(String(item.file_name || '').trim()))
      return {
        ...prev,
        salesDays: [...rows, ...keptSales],
        salesImports: [{ id: createId('salesimport'), file_name: rows[0]?.source_file || 'Toast Sales Import', row_count: rows.length, created_at: new Date().toISOString(), range_start: rangeStart, range_end: rangeEnd }, ...keptImports]
      }
    })
    setPreviewRows([])
    setSelectedIds([])
    setStatus(`Saved ${rows.length} sales rows and replaced any older import of the same Toast file`)
  }
  function startEdit(row) { setEditingId(row.id); setEditRow({ ...row }) }
  function saveEdit() {
    setData(prev => ({ ...prev, salesDays: (prev.salesDays || []).map(row => row.id === editingId ? { ...editRow, gross_sales: money(editRow.gross_sales), net_sales: money(editRow.net_sales), cash_sales: money(editRow.cash_sales), credit_sales: money(editRow.credit_sales), gift_card_sales: money(editRow.gift_card_sales), online_orders: money(editRow.online_orders), tips: money(editRow.tips), tips_collected: money(editRow.tips_collected), tips_withheld: money(editRow.tips_withheld), tips_after_withholding: money(editRow.tips_after_withholding || editRow.tips), refunds: money(editRow.refunds), discounts: money(editRow.discounts), tax: money(editRow.tax), guest_count: money(editRow.guest_count) } : row) }))
    setEditingId(null); setStatus('Sales row updated locally')
  }
  function deleteSale(id) { setData(prev => ({ ...prev, salesDays: (prev.salesDays || []).filter(row => row.id !== id) })); setSelectedIds(prev => prev.filter(item => item !== id)); setStatus('Sales row deleted locally') }
  function toggleSelected(id) { setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]) }
  function toggleAllFiltered(checked) { setSelectedIds(checked ? filteredSales.map(row => row.id) : []) }
  function bulkDelete() {
    if (!selectedIds.length) return setStatus('Select sales rows first')
    setData(prev => ({ ...prev, salesDays: (prev.salesDays || []).filter(row => !selectedIds.includes(row.id)) }))
    setStatus(`Deleted ${selectedIds.length} selected sales rows`)
    setSelectedIds([])
  }

  const numberFields = ['gross_sales','net_sales','cash_sales','credit_sales','gift_card_sales','online_orders','tips_after_withholding','refunds','discounts','tax','guest_count']
  const checkedAll = filteredSales.length > 0 && filteredSales.every(row => selectedIds.includes(row.id))

  return <>
    <style>{`
      .sales-history-card,
      .sales-preview-card {
        overflow-x: auto;
      }
      .sales-table.fit-sales-table {
        min-width: 1640px;
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
        font-size: 13px;
      }
      .sales-table.fit-sales-table th,
      .sales-table.fit-sales-table td {
        padding: 10px 12px;
        vertical-align: middle;
        white-space: nowrap;
      }
      .sales-table.fit-sales-table th {
        font-size: 11.5px;
        letter-spacing: .025em;
        line-height: 1.2;
        white-space: normal;
        overflow-wrap: anywhere;
        text-align: right;
      }
      .sales-table.fit-sales-table th:first-child,
      .sales-table.fit-sales-table th:nth-child(2) {
        text-align: left;
      }
      .sales-table.fit-sales-table th:nth-child(3),
      .sales-table.fit-sales-table td:nth-child(3),
      .sales-table.fit-sales-table th:nth-child(4),
      .sales-table.fit-sales-table td:nth-child(4),
      .sales-table.fit-sales-table th:nth-child(5),
      .sales-table.fit-sales-table td:nth-child(5),
      .sales-table.fit-sales-table th:nth-child(6),
      .sales-table.fit-sales-table td:nth-child(6),
      .sales-table.fit-sales-table th:nth-child(7),
      .sales-table.fit-sales-table td:nth-child(7),
      .sales-table.fit-sales-table th:nth-child(8),
      .sales-table.fit-sales-table td:nth-child(8),
      .sales-table.fit-sales-table th:nth-child(10),
      .sales-table.fit-sales-table td:nth-child(10),
      .sales-table.fit-sales-table th:nth-child(11),
      .sales-table.fit-sales-table td:nth-child(11),
      .sales-table.fit-sales-table th:nth-child(12),
      .sales-table.fit-sales-table td:nth-child(12),
      .sales-table.fit-sales-table th:nth-child(13),
      .sales-table.fit-sales-table td:nth-child(13) {
        width: 96px;
      }
      .sales-table.fit-sales-table th:nth-child(9),
      .sales-table.fit-sales-table td:nth-child(9) {
        width: 145px;
      }
      .sales-table.fit-sales-table .sales-check-col {
        width: 48px;
        text-align: center;
      }
      .sales-table.fit-sales-table .sales-date-col {
        width: 155px;
      }
      .sales-table.fit-sales-table .sales-action-col {
        width: 132px;
      }
      .sales-table.fit-sales-table .sales-date-cell {
        white-space: nowrap;
      }
      .sales-table.fit-sales-table .sales-date-main {
        display: block;
        font-weight: 800;
        white-space: nowrap;
      }
      .sales-table.fit-sales-table .sales-note {
        display: block;
        margin-top: 4px;
        max-width: 132px;
        color: #60708a;
        font-size: 11px;
        line-height: 1.25;
        white-space: normal;
      }
      .sales-table.fit-sales-table .money-cell,
      .sales-table.fit-sales-table .guest-cell {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .sales-table.fit-sales-table .row-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-start;
        flex-wrap: nowrap;
      }
      .sales-table.fit-sales-table .row-actions button {
        padding: 7px 10px;
        min-width: auto;
      }
      .sales-table.fit-sales-table tfoot th {
        text-align: right;
        white-space: nowrap;
      }
      .department-sales-card {
        overflow-x: auto;
      }
      .department-sales-card table {
        min-width: 900px;
      }
      .department-sales-summary {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .department-sales-summary strong {
        font-size: 20px;
      }
    `}</style>
    <div className="sales-action-bar sales-top-actions">
      <label className="btn secondary file-action">
        <Icon name="upload" />
        Upload Sales
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleSalesFile} />
      </label>

      <label className="btn primary file-action">
        <Icon name="upload" />
        Import Toast
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleSalesFile} />
      </label>

      <button className="btn primary" onClick={addManualSale} type="button">
        <Icon name="plus" />
        Add Manual Sale
      </button>
    </div>

    <div className="status-pill">{status}</div>

    <div className="page-filter-shell">
      <div className="search-box sales-search emphasized-search"><Icon name="search" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search date or file..." /></div>
      <div className="filter-dropdown-group"><label>Source<select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}><option value="all">All sources</option><option value="toast">Toast imports</option><option value="manual">Manual entries</option></select></label><label>Contains<select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}><option value="all">All sales</option><option value="cash">Cash collected</option><option value="credit">Credit collected</option><option value="tips">Tips collected</option></select></label></div>
      <DateControls start={dateStart} end={dateEnd} onStartChange={value => { setDateStart(value); setFilter('custom') }} onEndChange={value => { setDateEnd(value); setFilter('custom') }} onApply={() => setStatus(`Showing ${filteredSales.length} sales rows${dateStart || dateEnd ? ` from ${dateStart || 'start'} to ${dateEnd || 'today'}` : ''}`)} onPreset={applyFilterPreset} />
    </div>
    {(dateStart || dateEnd) && <p className="filter-note">Showing data from {dateStart || 'first record'} to {dateEnd || 'latest record'}</p>}

    {departmentView && <section className="table-card compact-table-card department-sales-card">
      <header>
        <div>
          <h2>{departmentView.department === 'alcohol' ? 'Alcohol Sales Details' : 'Food Sales Details'}</h2>
          <small>{departmentView.start || departmentView.end ? `${departmentView.start || 'first record'} to ${departmentView.end || 'latest record'}` : 'All imported Product Mix periods'}</small>
        </div>
        <div className="department-sales-summary">
          <span>{departmentSalesRows.length} items</span>
          <strong>{displayMoney(departmentSalesTotal)}</strong>
          <button type="button" className="btn secondary small-btn" onClick={closeDepartmentView}>Close Details</button>
        </div>
      </header>
      <p className="notice-line">
        {departmentView.department === 'alcohol'
          ? 'Includes beer, draft beer, liquor, wine, margaritas, cocktails and shots. The total below is the exact sum of these Product Mix rows.'
          : 'Includes every non-alcohol Product Mix item. Alcohol items are excluded so no menu item is counted twice.'}
      </p>
      <table>
        <thead><tr><th>Item</th><th>Department Category</th><th>Toast Category</th><th>Qty Sold</th><th>Net Sales</th><th>Product Mix Period</th><th>Source</th></tr></thead>
        <tbody>
          {departmentSalesRows.map(row => <tr key={row.id}>
            <td>{row.name || row.item_name || row.description || '-'}</td>
            <td><b>{row.normalizedCategory}</b></td>
            <td>{row.category || row.menu_category || '-'}</td>
            <td>{num(row.qtySold || row.qty_sold || row.quantity).toLocaleString()}</td>
            <td>{displayMoney(row.salesAmount)}</td>
            <td>{row.dateStart || row.date_start || '-'}{(row.dateEnd || row.date_end) ? ` to ${row.dateEnd || row.date_end}` : ''}</td>
            <td>{row.sourceFile || row.source_file || 'Product Mix'}</td>
          </tr>)}
          {!departmentSalesRows.length && <tr><td colSpan="7"><small>No matching Product Mix items were found for this department and date range.</small></td></tr>}
        </tbody>
        {departmentSalesRows.length > 0 && <tfoot><tr><th colSpan="4">Total</th><th>{displayMoney(departmentSalesTotal)}</th><th colSpan="2"></th></tr></tfoot>}
      </table>
    </section>}

    <div className="payroll-summary-row sales-summary-row">
      <div><span>Net Sales</span><b>${money(totals.net)}</b></div><div><span>Cash</span><b>${money(totals.cash)}</b></div><div><span>Credit</span><b>${money(totals.credit)}</b></div><div><span>Tips After Withholding</span><b>${money(totals.tips)}</b></div>
    </div>

    {previewRows.length > 0 && <section className="table-card compact-table-card sales-preview-card">
      <header><h2>Sales Import Preview</h2><span>{previewRows.length} rows <button className="btn primary small-btn" onClick={savePreview} type="button">Save Sales</button></span></header>
      <table className="sales-table fit-sales-table"><thead><tr><th className="sales-date-col">Date</th><th>Gross</th><th>Net</th><th>Cash</th><th>Credit</th><th>Gift</th><th>Other</th><th>Tips After Withholding</th><th>Refunds</th><th>Discounts</th><th>Tax</th><th>Guests</th><th className="sales-action-col"></th></tr></thead><tbody>{previewRows.map(row => <tr key={row.id}>
        <td className="sales-date-cell"><input className="sales-date-input" type="date" value={row.business_date} onChange={e => updatePreview(row.id, 'business_date', e.target.value)} />{row.import_note && <small className="sales-note" title={row.import_note}>{shortNote(row.import_note)}</small>}</td>
        {numberFields.map(field => <td key={field}><input className="sales-data-input" type="number" step="0.01" value={row[field]} onChange={e => updatePreview(row.id, field, e.target.value)} onBlur={e => blurPreview(row.id, field, e.target.value)} /></td>)}
        <td><button className="delete-link" type="button" onClick={() => setPreviewRows(prev => prev.filter(item => item.id !== row.id))}>Remove</button></td>
      </tr>)}</tbody></table>
    </section>}

    <section className="table-card compact-table-card sales-history-card">
      <header><h2>Sales History</h2><span>{filteredSales.length} rows {selectedIds.length ? <button className="delete-link small-btn" onClick={bulkDelete} type="button">Delete {selectedIds.length}</button> : null}</span></header>
      <table className="sales-table fit-sales-table"><thead><tr><th className="sales-check-col"><input type="checkbox" checked={checkedAll} onChange={e => toggleAllFiltered(e.target.checked)} /></th><th className="sales-date-col">Date</th><th>Gross</th><th>Net</th><th>Cash</th><th>Credit</th><th>Gift</th><th>Other</th><th>Tips After Withholding</th><th>Refunds</th><th>Discounts</th><th>Tax</th><th>Guests</th><th className="sales-action-col">Action</th></tr></thead><tbody>{filteredSales.map(row => {
        const isEditing = editingId === row.id
        const current = isEditing ? editRow : row
        return <tr key={row.id} className={isEditing ? 'editing-row' : ''}>
          <td className="sales-check-col"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} /></td>
          <td className="sales-date-cell">{isEditing ? <input className="sales-date-input" type="date" value={current.business_date} onChange={e => setEditRow(prev => ({ ...prev, business_date: e.target.value }))} /> : <><span className="sales-date-main">{current.business_date}</span>{current.import_note && <small className="sales-note" title={current.import_note}>{shortNote(current.import_note)}</small>}</>}</td>
          {numberFields.map(field => <td key={field} className={field === 'guest_count' ? 'guest-cell' : 'money-cell'}>{isEditing ? <input className="sales-data-input" type="number" step="0.01" value={current[field]} onChange={e => setEditRow(prev => ({ ...prev, [field]: e.target.value }))} /> : (field === 'guest_count' ? money(current[field]) : displayMoney(current[field]))}</td>)}
          <td className="row-actions">{isEditing ? <><button className="save-link" onClick={saveEdit} type="button">Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></> : <><button type="button" onClick={() => startEdit(row)}>Edit</button><button className="delete-link" type="button" onClick={() => deleteSale(row.id)}>Delete</button></>}</td>
        </tr>
      })}{filteredSales.length === 0 && <tr><td colSpan="14"><small>No sales rows yet. Import a Toast Sales Summary CSV/XLSX.</small></td></tr>}</tbody>
      {filteredSales.length > 0 && <tfoot><tr><th></th><th>Totals</th><th>{displayMoney(totals.gross)}</th><th>{displayMoney(totals.net)}</th><th>{displayMoney(totals.cash)}</th><th>{displayMoney(totals.credit)}</th><th>{displayMoney(totals.gift)}</th><th>{displayMoney(totals.online)}</th><th>{displayMoney(totals.tips)}</th><th>{displayMoney(totals.refunds)}</th><th>{displayMoney(totals.discounts)}</th><th>{displayMoney(totals.tax)}</th><th>{money(totals.guests)}</th><th></th></tr></tfoot>}
      </table>
    </section>

    <section className="table-card compact-table-card sales-history-card">
      <header><h2>Import History</h2><span>{salesImports.length} imports</span></header>
      <table><thead><tr><th>File</th><th>Rows</th><th>Imported</th></tr></thead><tbody>{salesImports.map(item => <tr key={item.id}><td>{item.file_name}</td><td>{item.row_count}</td><td>{new Date(item.created_at).toLocaleString()}</td></tr>)}</tbody></table>
    </section>
  </>
}
