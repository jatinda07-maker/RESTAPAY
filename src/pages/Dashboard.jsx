import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { RESTAPAY_CLOUD_STATUS_EVENT, loadCloudData, retryPendingCloudSave } from '../lib/localStore'
import { categoryGroup, categoriesForGroup, inferCategory, rollupCategoryRows, sumRowsByCategory as sumByCategoryEngine } from '../engine/CategoryEngine'
import { calculateDepartmentCosts, menuSaleCategoryLabel } from '../engine/DepartmentCostEngine'

function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const text = String(value ?? '').replace(/[$,%]/g, '').replace(/,/g, '').trim()
  if (!text) return 0
  if (/^\(.+\)$/.test(text)) return -(Number(text.replace(/[()]/g, '')) || 0)
  return Number(text) || 0
}
function money(value) { return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function pct(value) { return `${Number(value || 0).toFixed(1)}%` }
function todayStr() { return new Date().toISOString().slice(0, 10) }
function startOfMonthISO(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10) }
function isoDate(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10) }
function rangeForPreset(preset) {
  const now = new Date()
  if (preset === 'thisMonth') return { start: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: isoDate(now) }
  if (preset === 'lastMonth') return { start: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)) }
  if (preset === 'lastWeek') {
    const day = now.getDay() || 7
    const lastSunday = new Date(now); lastSunday.setDate(now.getDate() - day)
    const lastMonday = new Date(lastSunday); lastMonday.setDate(lastSunday.getDate() - 6)
    return { start: isoDate(lastMonday), end: isoDate(lastSunday) }
  }
  return { start: '', end: '' }
}
function readSavedDateRange() {
  try {
    const saved = JSON.parse(localStorage.getItem('restapay_dashboard_date_range') || '{}')
    return { start: saved.start || '', end: saved.end || '' }
  } catch {
    return { start: '', end: '' }
  }
}
function saveGlobalDateRange(start, end) {
  try { localStorage.setItem('restapay_dashboard_date_range', JSON.stringify({ start, end })) } catch {}
}
function rowDate(row, keys = []) {
  for (const key of keys) if (row?.[key]) return String(row[key]).slice(0, 10)
  return String(row?.business_date || row?.pay_date || row?.payroll_date || row?.invoice_date || row?.date || row?.expense_date || row?.created_at || '').slice(0, 10)
}
function isDateInRange(dateText, start, end) {
  const d = String(dateText || '').slice(0, 10)
  if (!d) return false
  if (start && d < start) return false
  if (end && d > end) return false
  return true
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

function collectDashboardDates(data = {}) {
  const dates = []
  ;(data.salesDays || []).forEach(row => dates.push(rowDate(row, ['business_date', 'date'])))
  ;(data.payrollEntries || []).forEach(row => dates.push(rowDate(row, ['pay_date', 'payroll_date', 'date'])))
  ;(data.invoices || []).forEach(row => dates.push(rowDate(row, ['invoice_date', 'date'])))
  ;(data.invoiceItems || []).forEach(row => dates.push(rowDate(row, ['invoice_date', 'date', 'created_at'])))
  ;(data.expenses || []).forEach(row => dates.push(rowDate(row, ['expense_date', 'date'])))
  return dates.filter(Boolean).sort()
}
function hasDashboardRowsInRange(data = {}, start = '', end = '') {
  const dates = collectDashboardDates(data)
  if (!dates.length) return true
  return dates.some(date => isDateInRange(date, start, end))
}


function payrollClassification(row = {}) {
  const text = [row.payroll_classification, row.classification, row.pay_type, row.employee_type, row.job_type, row.group_name, row.employee_name]
    .map(value => String(value || '').toLowerCase())
    .join(' ')
  if (text.includes('customer tip') || text.includes('server tip') || text.includes('tips only') || text.includes('front house tip')) return 'Customer Tips'
  if (text.includes('server') || text.includes('waiter') || text.includes('waitress') || text.includes('front house') || text.includes('foh') || text.includes('bartender') || text.includes('tip')) return 'Customer Tips'
  return 'Operating Labor'
}
function isCustomerTips(row) { return payrollClassification(row) === 'Customer Tips' }
function isOperatingLabor(row) { return !isCustomerTips(row) }
function rowTipsPaid(row) { return Math.max(0, num(row.tips || row.tips_after_withheld || row.tips_after_withholding || row.final_tips) - num(row.tip_deduction || row.tips_withheld || row.tips_withholding)) }
function payrollType(row) { return String(row.payment_method || row.payroll_type || row.method || row.type || row.pay_method || '').toLowerCase() }
function isCashPayroll(row) { return payrollType(row).includes('cash') }
function isCheckPayroll(row) { return payrollType(row).includes('check') }
function invoiceTotal(row) {
  const amount = num(row.total || row.amount || row.invoice_total || row.grand_total)
  const text = [row.invoice_type, row.status, row.notes, row.source_file, row.invoice_number]
    .map(value => String(value || '').toLowerCase()).join(' ')
  return /rebate|credit memo|return credit|vendor adjustment|\bcredit\b/.test(text) ? -Math.abs(amount) : amount
}
function itemUnit(row) { return num(row.unit_price || row.price || row.cost || row.item_price || row.rate) }
function itemAmount(row) { return num(row.line_total || row.total || row.amount || row.extended_price || (num(row.qty || row.quantity) * itemUnit(row))) }
function rowTotalPay(row) { return num(row.total_pay || row.total || row.amount || row.regular_pay) }
function rowCategory(row) { return String(row.category || row.expense_category || row.invoice_category || row.type || '').trim() }
function normalizeCategory(value) {
  const text = String(value || '').toLowerCase()
  if (text.includes('food') || text.includes('meat') || text.includes('produce') || text.includes('grocery') || text.includes('chicken') || text.includes('beef') || text.includes('fish')) return 'Food'
  if (text.includes('beer')) return 'Beer'
  if (text.includes('liquor') || text.includes('wine') || text.includes('vodka') || text.includes('tequila') || text.includes('whiskey')) return 'Liquor'
  if (text.includes('beverage') || text.includes('soda') || text.includes('drink') || text.includes('coffee') || text.includes('juice')) return 'Beverage'
  if (text.includes('suppl') || text.includes('paper') || text.includes('clean') || text.includes('chemical') || text.includes('glove')) return 'Supplies'
  if (text.includes('util') || text.includes('electric') || text.includes('gas') || text.includes('water')) return 'Utilities'
  if (text.includes('maint') || text.includes('repair')) return 'Maintenance'
  if (text.includes('insurance')) return 'Insurance'
  if (text.includes('loan') || text.includes('mortgage')) return 'Loans'
  return String(value || 'Other').trim() || 'Other'
}
function healthLabel(score) {
  if (score >= 82) return 'Strong'
  if (score >= 68) return 'Stable'
  if (score >= 50) return 'Watch'
  return 'At Risk'
}
function trendRows(rows, dateKey, amountGetter) {
  const map = new Map()
  rows.forEach(row => {
    const date = rowDate(row, [dateKey, 'business_date', 'date', 'invoice_date', 'expense_date', 'pay_date']).slice(5) || 'No date'
    map.set(date, (map.get(date) || 0) + amountGetter(row))
  })
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-7)
}

function MetricCard({ title, value, subtitle, icon, tone = 'blue', onClick }) {
  return (
    <button type="button" className={`metric-card tone-${tone}`} onClick={onClick}>
      <span className="metric-icon"><Icon name={icon} size={18} /></span>
      <span className="metric-label">{title}</span>
      <strong>{value}</strong>
      <small>{subtitle}</small>
    </button>
  )
}

function SectionCard({ title, icon, tone = 'blue', total, subtitle, action, children }) {
  return (
    <section className={`section-card tone-${tone}`}>
      <header className="section-card-header">
        <div className="section-title-wrap">
          <span className="section-icon"><Icon name={icon} size={18} /></span>
          <div><h2>{title}</h2>{subtitle ? <small>{subtitle}</small> : null}</div>
        </div>
        <div className="section-total">{total ? <strong>{total}</strong> : null}{action}</div>
      </header>
      <div className="section-card-body">{children}</div>
    </section>
  )
}

function RowList({ rows, empty = 'No data in selected range.', onRowClick }) {
  if (!rows.length) return <div className="empty-state">{empty}</div>
  return <div className="line-list">{rows.map((row, index) => {
    const content = <>
      <div><b>{row.label}</b>{row.meta ? <small>{row.meta}</small> : null}</div>
      <strong>{row.amount}</strong>
      {onRowClick || row.onClick ? <span className="line-row-chevron" aria-hidden="true">›</span> : null}
    </>
    const click = row.onClick || (onRowClick ? () => onRowClick(row) : null)
    return click ? <button type="button" className="line-row line-row-button" key={row.id || `${row.label}-${index}`} onClick={click}>{content}</button>
      : <div className="line-row" key={row.id || `${row.label}-${index}`}>{content}</div>
  })}</div>
}

function ProgressMeter({ label, value, tone = 'blue', caption }) {
  const clamped = Math.max(0, Math.min(100, Number(value || 0)))
  return <div className="progress-line">
    <div className="progress-text"><span>{label}</span><b>{pct(clamped)}</b></div>
    <div className="progress-track"><span className={`progress-fill tone-${tone}`} style={{ width: `${clamped}%` }} /></div>
    {caption ? <small>{caption}</small> : null}
  </div>
}

function MiniBars({ rows, tone = 'blue' }) {
  const max = Math.max(...rows.map(([, amount]) => Math.abs(amount)), 1)
  return <div className="mini-bars">
    {rows.length ? rows.map(([label, amount]) => <div className="mini-bar-row" key={label}>
      <span>{label}</span><div><i className={`tone-${tone}`} style={{ width: `${Math.max(5, (Math.abs(amount) / max) * 100)}%` }} /></div><b>{money(amount)}</b>
    </div>) : <div className="empty-state">No trend data yet.</div>}
  </div>
}

function DetailTable({ config, setActive, onClose }) {
  if (!config) return null
  function openScreen() {
    if (config.onOpen) return config.onOpen()
    if (config.open) setActive(config.open)
  }
  const rows = config.rows || []
  const subtotal = rows.reduce((sum, row) => {
    const value = config.amountGetter
      ? config.amountGetter(row)
      : (row.salesAmount ?? row.allocatedAmount ?? row.amount ?? row.line_total ?? row.total_pay ?? row.total ?? row.regular_pay ?? 0)
    return sum + num(value)
  }, 0)
  const clickedTotal = Number(config.expected ?? config.total ?? subtotal)
  const difference = clickedTotal - subtotal
  return <div className="dashboard-detail-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}>
    <section className="table-card detail-section dashboard-detail-modal" id="dashboard-details" role="dialog" aria-modal="true" aria-label={config.title}>
      <header><div><h2>{config.title}</h2>{config.message ? <p className="notice-line">{config.message}</p> : null}</div><div className="detail-modal-actions">{config.open ? <button type="button" className="btn secondary small-btn" onClick={openScreen}>Open Full Screen</button> : null}<button type="button" className="btn primary small-btn" onClick={onClose}>Close</button></div></header>
      <div className="table-scroll"><table><thead><tr>{config.columns.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>
        {rows.length ? rows.map((row, index) => <tr key={row.id || index}>{config.columns.map(col => <td key={col.key}>{col.render ? col.render(row) : String(row[col.key] ?? '-')}</td>)}</tr>) : <tr><td colSpan={config.columns.length}><small>No details to show yet.</small></td></tr>}
      </tbody><tfoot>
        {config.groupSubtotals ? config.groupSubtotals.map(group => <tr key={group.label}><td colSpan={Math.max(1, config.columns.length - 1)}><b>{group.label}</b></td><td><b>{money(group.amount)}</b></td></tr>) : null}
        <tr><td colSpan={Math.max(1, config.columns.length - 1)}><b>Subtotal</b></td><td><b>{config.totalFormatter ? config.totalFormatter(subtotal) : money(subtotal)}</b></td></tr>
        <tr><td colSpan={Math.max(1, config.columns.length - 1)}><b>Clicked total</b></td><td><b>{config.totalFormatter ? config.totalFormatter(clickedTotal) : money(clickedTotal)}</b></td></tr>
        <tr><td colSpan={Math.max(1, config.columns.length - 1)}><b>{Math.abs(difference) < 0.01 ? 'Reconciled' : 'Difference'}</b></td><td><b>{money(difference)}</b></td></tr>
      </tfoot></table></div>
    </section>
  </div>
}

export default function Dashboard({ data, setData, setActive }) {
  const [detail, setDetail] = useState('')
  const [preset, setPreset] = useState('custom')
  const [syncStatus, setSyncStatus] = useState('Direct database save is on')
  const savedRange = readSavedDateRange()
  const [dateStart, setDateStart] = useState(savedRange.start)
  const [dateEnd, setDateEnd] = useState(savedRange.end)

  const salesDays = data?.salesDays || []
  const payroll = data?.payrollEntries || []
  const invoices = data?.invoices || []
  const invoiceItems = data?.invoiceItems || []
  const expenseRows = data?.expenses || []
  const employees = data?.employees || []
  const vendors = data?.vendors || []
  const defaultDashboardVisibility = {
    netSales: true, cashCollected: true, operatingProfit: true, cashRemaining: true,
    operatingPayroll: false, managementCashPayroll: true, vendorSpend: true, businessExpenses: true, serverTips: true,
    primeCost: true, trueFoodCost: true, trueAlcoholCost: true,
    restaurantHealth: true, departmentProfitability: true, cashPosition: true,
    profitLoss: true, salesPerformance: true, vendorPurchases: true, businessExpensePanel: true,
    weeklySalesTrend: true, spendingTrend: true, restaurantIntelligence: true
  }
  const visible = { ...defaultDashboardVisibility, ...(data?.settings?.dashboardVisibility || {}) }

  useEffect(() => {
    if (!(dateStart || dateEnd)) return
    if (!hasDashboardRowsInRange(data || {}, dateStart, dateEnd)) {
      setDateStart('')
      setDateEnd('')
      saveGlobalDateRange('', '')
    }
  }, [data, dateStart, dateEnd])

  function applyRange() { saveGlobalDateRange(dateStart, dateEnd); setPreset('custom'); setDetail('') }
  function applyPreset(nextPreset) {
    if (nextPreset === 'all') {
      setDateStart(''); setDateEnd(''); setPreset('all'); saveGlobalDateRange('', ''); setDetail('')
      return
    }
    const range = rangeForPreset(nextPreset)
    setDateStart(range.start); setDateEnd(range.end); setPreset(nextPreset); saveGlobalDateRange(range.start, range.end); setDetail('')
  }
  async function retryCloudSave() {
    setSyncStatus('Retrying pending database save...')
    const result = await retryPendingCloudSave()
    setSyncStatus(result?.ok ? `Database saved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Database retry failed - local backup kept')
  }
  async function pullCloud() {
    setSyncStatus('Pulling cloud data...')
    const cloud = await loadCloudData()
    if (cloud && setData) {
      setData(cloud)
      setSyncStatus(`Pulled cloud data ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
    } else {
      setSyncStatus('No cloud data found')
    }
  }
  useEffect(() => {
    function handleCloudStatus(event) {
      const detail = event.detail || {}
      if (detail.status === 'saving') setSyncStatus('Saving directly to database...')
      else if (detail.status === 'saved') setSyncStatus(`Cloud saved ${new Date(detail.at || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
      else if (detail.status === 'offline') setSyncStatus(detail.message || 'Offline backup saved')
      else if (detail.status === 'local') setSyncStatus(detail.message || 'Local backup saved')
    }
    window.addEventListener(RESTAPAY_CLOUD_STATUS_EVENT, handleCloudStatus)
    return () => window.removeEventListener(RESTAPAY_CLOUD_STATUS_EVENT, handleCloudStatus)
  }, [])

  function showDetail(key, category = '') {
    setDetail(category ? `${key}:${category}` : key)
    setTimeout(() => document.getElementById('dashboard-details')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0)
  }

  const detailKey = String(detail || '').split(':')[0]
  const detailCategory = String(detail || '').split(':').slice(1).join(':')

  const derived = useMemo(() => {
    const inRange = date => isDateInRange(date, dateStart, dateEnd)
    const monthSales = salesDays.filter(row => inRange(rowDate(row, ['business_date', 'date'])))
    const monthPayroll = payroll.filter(row => inRange(rowDate(row, ['pay_date', 'payroll_date', 'date'])))
    const cashPayrollRows = monthPayroll.filter(isCashPayroll)
    const checkPayrollRows = monthPayroll.filter(isCheckPayroll)
    const operatingLaborRows = monthPayroll.filter(isOperatingLabor)
    const customerTipRows = monthPayroll.filter(isCustomerTips)
    const monthInvoices = invoices.filter(row => inRange(rowDate(row, ['invoice_date', 'date'])))
    const invoiceById = Object.fromEntries(invoices.map(inv => [inv.id, inv]))
    const monthInvoiceItems = invoiceItems.filter(row => {
      const inv = invoiceById[row.invoice_id] || {}
      const itemDate = rowDate(row, ['invoice_date', 'date', 'created_at']) || rowDate(inv, ['invoice_date', 'date'])
      return inRange(itemDate)
    })
    const monthExpenses = expenseRows.filter(row => inRange(rowDate(row, ['expense_date', 'date'])))

    const grossSales = monthSales.reduce((sum, row) => sum + num(row.gross_sales || row.total_sales || row.net_sales), 0)
    // Toast is the only source of dashboard sales. Prefer each row's Net Sales,
    // and fall back to that Toast row's Total/Gross Sales only when Net Sales is absent.
    const toastTotalSales = monthSales.reduce((sum, row) => {
      const hasNet = row.net_sales !== undefined && row.net_sales !== null && String(row.net_sales).trim() !== ''
      return sum + num(hasNet ? row.net_sales : (row.total_sales || row.gross_sales))
    }, 0)
    const netSales = toastTotalSales
    const cashSales = monthSales.reduce((sum, row) => sum + num(row.cash_sales || row.cash_payments || row.actual_closeout_cash), 0)
    const creditSales = monthSales.reduce((sum, row) => sum + num(row.credit_sales || row.credit_card_sales || row.card_payments), 0)
    const giftSales = monthSales.reduce((sum, row) => sum + num(row.gift_card_sales || row.gift_sales), 0)
    const onlineSales = monthSales.reduce((sum, row) => sum + num(row.online_orders || row.online_sales), 0)
    const explicitOtherSales = monthSales.reduce((sum, row) => sum + num(row.other_payments || row.other_sales || row.other_tender), 0)
    const tax = monthSales.reduce((sum, row) => sum + num(row.tax), 0)
    const tips = monthSales.reduce((sum, row) => sum + num(row.tips || row.tips_after_withholding), 0)
    const tipsWithheld = monthSales.reduce((sum, row) => sum + num(row.tips_withheld || row.tip_deduction || row.tips_withholding), 0)
    const trueNetSales = toastTotalSales
    const knownPayments = cashSales + creditSales + giftSales + onlineSales + explicitOtherSales
    const otherSales = explicitOtherSales || Math.max(0, toastTotalSales - cashSales - creditSales - giftSales - onlineSales)
    const paymentTotal = cashSales + creditSales + giftSales + onlineSales + otherSales
    const salesReconciliationDifference = toastTotalSales - paymentTotal

    const checkPayroll = checkPayrollRows.reduce((sum, row) => sum + rowTotalPay(row), 0)
    const payrollTotal = monthPayroll.reduce((sum, row) => sum + rowTotalPay(row), 0)
    const operatingPayroll = operatingLaborRows.reduce((sum, row) => sum + rowTotalPay(row), 0)
    const cashOperatingPayrollRows = operatingLaborRows.filter(isCashPayroll)
    const cashOperatingPayroll = cashOperatingPayrollRows.reduce((sum, row) => sum + rowTotalPay(row), 0)
    const dcPayrollPreview = calculateDepartmentCosts({ payrollRows: monthPayroll, employees: data?.employees || [], settings: data?.settings || {} })
    const managerPayrollTotal = (dcPayrollPreview.payrollDetails.manager || []).reduce((sum, row) => sum + num(row.amount), 0)
    const assistantRows = (dcPayrollPreview.payrollDetails.other || []).filter(row => /assistant manager|assistant mgr|asst\.? manager|asistente manager/i.test([row.employee_type,row.job_type,row.position,row.role,row.employee_name,row.name].join(' ')))
    const assistantManagerPayroll = assistantRows.reduce((sum, row) => sum + num(row.amount), 0)
    const managerIds = new Set((dcPayrollPreview.payrollDetails.manager || []).map(row => String(row.id || `${row.employee_id || ''}|${row.employee_name || row.name || ''}|${row.pay_date || row.payroll_date || row.date || ''}`)))
    const assistantIds = new Set(assistantRows.map(row => String(row.id || `${row.employee_id || ''}|${row.employee_name || row.name || ''}|${row.pay_date || row.payroll_date || row.date || ''}`)))
    const cashPayrollBaseRows = cashPayrollRows.filter(row => {
      const key = String(row.id || `${row.employee_id || ''}|${row.employee_name || row.name || ''}|${row.pay_date || row.payroll_date || row.date || ''}`)
      return !managerIds.has(key) && !assistantIds.has(key)
    })
    const cashPayroll = cashPayrollBaseRows.reduce((sum, row) => sum + rowTotalPay(row), 0)
    const managementCashPayroll = cashPayroll + managerPayrollTotal + assistantManagerPayroll
    const customerTipsPaid = customerTipRows.reduce((sum, row) => sum + rowTipsPaid(row), 0)
    const customerTipsChecks = customerTipRows.filter(isCheckPayroll).reduce((sum, row) => sum + rowTipsPaid(row), 0)
    const invoiceSpend = monthInvoices.reduce((sum, row) => sum + invoiceTotal(row), 0)
    const manualExpenseSpend = monthExpenses.reduce((sum, row) => sum + num(row.amount), 0)

    const invoicesWithLineItems = new Set(monthInvoiceItems.map(item => item.invoice_id).filter(Boolean))
    const invoiceItemRows = monthInvoiceItems.map(row => {
      const inv = invoiceById[row.invoice_id] || {}
      const vendor = inv.vendor || inv.vendor_name || row.vendor || row.vendor_name || 'Invoice item'
      const description = row.description || row.item_name || row.name || row.item || vendor
      const category = inferCategory({ ...row, vendor, category: row.category || inv.category, description })
      return { ...row, source: 'Invoice Item', vendor, description, amount: itemAmount(row), category, date: rowDate(row, ['invoice_date', 'date']) || rowDate(inv, ['invoice_date', 'date']) }
    }).filter(row => num(row.amount) !== 0)

    const invoiceHeaderRows = monthInvoices.filter(row => !invoicesWithLineItems.has(row.id)).map(row => ({
      ...row,
      source: 'Invoice',
      vendor: row.vendor || row.vendor_name || 'Invoice',
      description: row.invoice_number || row.notes || row.category || 'Invoice',
      amount: invoiceTotal(row),
      category: inferCategory(row),
      date: rowDate(row, ['invoice_date', 'date'])
    })).filter(row => num(row.amount) !== 0)

    const expenseSpendRows = monthExpenses.map(row => ({
      ...row,
      source: 'Expense',
      vendor: row.vendor || row.name || row.category || 'Expense',
      description: row.notes || row.name || row.category || 'Expense',
      amount: num(row.amount),
      category: inferCategory(row),
      date: rowDate(row, ['expense_date', 'date'])
    })).filter(row => num(row.amount) > 0)

    const allSpendRows = [...invoiceItemRows, ...invoiceHeaderRows, ...expenseSpendRows]
    const totalSpend = allSpendRows.reduce((sum, row) => sum + num(row.amount), 0)
    const vendorRaw = allSpendRows.filter(row => categoryGroup(row.category || row.label) === 'vendor')
    const businessRaw = allSpendRows.filter(row => categoryGroup(row.category || row.label) === 'business')
    const categoryRows = sumByCategoryEngine(allSpendRows, data || {})
    const vendorCategories = rollupCategoryRows(sumByCategoryEngine(vendorRaw, categoriesForGroup(data || {}, 'vendor')), 'vendor', 8)
    const businessCategories = rollupCategoryRows(sumByCategoryEngine(businessRaw, categoriesForGroup(data || {}, 'business')), 'business', 8)
    const vendorSpend = vendorRaw.reduce((sum, row) => sum + num(row.amount), 0)
    const businessSpend = businessRaw.reduce((sum, row) => sum + num(row.amount), 0)
    const foodSpend = allSpendRows.filter(row => normalizeCategory(row.category) === 'Food').reduce((sum, row) => sum + num(row.amount), 0)

    const monthMenuItems = (data?.menuItems || []).filter(item => menuItemOverlapsRange(item, dateStart, dateEnd))
    const departmentCosts = calculateDepartmentCosts({
      salesRows: monthSales,
      payrollRows: monthPayroll,
      employees: data?.employees || [],
      spendRows: allSpendRows,
      menuItems: monthMenuItems,
      settings: data?.settings || {}
    })
    const operatingProfit = departmentCosts.overallOperatingProfit
    const cashSpendRows = allSpendRows.filter(row => String(row.payment_method || row.payment_type || row.pay_method || '').toLowerCase().includes('cash'))
    const cashVendorSpend = cashSpendRows.reduce((sum, row) => sum + num(row.amount), 0)
    // Customer tips are pass-through funds and never reduce operating cash or profit.
    const cashRemaining = cashSales - cashOperatingPayroll - cashVendorSpend
    const cashNeeded = Math.max(0, -cashRemaining)
    const foodCostPct = trueNetSales > 0 ? (foodSpend / trueNetSales) * 100 : 0
    const laborPct = trueNetSales > 0 ? (operatingPayroll / trueNetSales) * 100 : 0
    const primeCostPct = trueNetSales > 0 ? ((foodSpend + operatingPayroll) / trueNetSales) * 100 : 0
    const profitMargin = trueNetSales > 0 ? (operatingProfit / trueNetSales) * 100 : 0
    const averageCheck = monthSales.reduce((sum, row) => sum + num(row.guest_count || row.guests || row.check_count), 0) > 0
      ? trueNetSales / monthSales.reduce((sum, row) => sum + num(row.guest_count || row.guests || row.check_count), 0) : 0
    const guestCount = monthSales.reduce((sum, row) => sum + num(row.guest_count || row.guests || row.check_count), 0)
    const alcoholSales = departmentCosts.alcoholSales || 0
    const margaritaSales = (departmentCosts.alcoholSalesRows || []).filter(row => /margarita/i.test([row.name,row.item_name,row.description,row.category].join(' '))).reduce((sum,row)=>sum+num(row.salesAmount || row.netSales || row.net_sales || row.grossSales),0)
    const alcoholReconciliationDifference = alcoholSales - (departmentCosts.beerSales || 0) - (departmentCosts.wineSales || 0) - (departmentCosts.liquorSales || 0) - margaritaSales
    const reconciliationChecks = [
      { label: 'Toast sales vs payment mix', difference: salesReconciliationDifference },
      { label: 'Dashboard spend vs vendor + business', difference: totalSpend - vendorSpend - businessSpend },
      { label: 'Cash remaining formula', difference: cashRemaining - (cashSales - cashOperatingPayroll - cashVendorSpend) }
    ]
    const reconciliationOk = reconciliationChecks.every(check => Math.abs(check.difference) < 0.01)
    const healthScore = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, foodCostPct - 30) * 1.5 - Math.max(0, laborPct - 28) * 1.5 - Math.max(0, primeCostPct - 65) - (operatingProfit < 0 ? 20 : 0) + (cashRemaining > 0 ? 4 : -8) + (reconciliationOk ? 2 : -8))))

    return {
      monthSales, monthPayroll, cashPayrollRows, cashPayrollBaseRows, checkPayrollRows, managerPayrollRows: dcPayrollPreview.payrollDetails.manager || [], assistantManagerRows: assistantRows, monthInvoices, monthExpenses, monthInvoiceItems, monthMenuItems,
      grossSales, netSales, toastTotalSales, trueNetSales, cashSales, creditSales, giftSales, onlineSales, otherSales, paymentTotal, salesReconciliationDifference, tax, tips, tipsWithheld,
      cashPayroll, checkPayroll, payrollTotal, operatingPayroll, cashOperatingPayrollRows, cashOperatingPayroll, managerPayrollTotal, assistantManagerPayroll, managementCashPayroll, customerTipsPaid, customerTipsChecks, invoiceSpend, manualExpenseSpend, totalSpend,
      vendorSpend, businessSpend, foodSpend, operatingProfit, cashRemaining, cashNeeded, cashVendorSpend,
      foodCostPct, laborPct, primeCostPct, profitMargin, healthScore, departmentCosts, guestCount, averageCheck, margaritaSales, alcoholReconciliationDifference, reconciliationChecks, reconciliationOk,
      categoryRows, vendorCategories, businessCategories, allSpendRows, vendorRaw, businessRaw, operatingLaborRows, customerTipRows,
      vendorRecent: vendorRaw.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6),
      businessRecent: businessRaw.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6),
      salesTrend: trendRows(monthSales, 'business_date', row => num(row.net_sales)),
      expenseTrend: trendRows(allSpendRows, 'date', row => num(row.amount))
    }
  }, [data, salesDays, payroll, invoices, invoiceItems, expenseRows, dateStart, dateEnd])

  const detailVendorRows = detailCategory ? derived.allSpendRows.filter(row => normalizeCategory(row.category) === normalizeCategory(detailCategory) || String(row.category || '').toLowerCase() === detailCategory.toLowerCase()) : derived.allSpendRows
  const detailExpenseRows = detailCategory ? derived.businessRaw?.filter(row => normalizeCategory(row.category) === normalizeCategory(detailCategory) || String(row.category || '').toLowerCase() === detailCategory.toLowerCase()) : derived.businessRecent

  function departmentDetailConfig(key) {
    const dc = derived.departmentCosts
    const salesColumns = [
      { key: 'name', label: 'Item', render: r => r.name || r.item_name || r.description || '-' },
      { key: 'category', label: 'Category', render: r => menuSaleCategoryLabel(r) },
      { key: 'qtySold', label: 'Qty Sold', render: r => num(r.qtySold || r.qty_sold || r.quantity).toLocaleString() },
      { key: 'salesAmount', label: 'Net Sales', render: r => money(num(r.salesAmount || r.netSales || r.net_sales || r.grossSales)) },
      { key: 'sourceFile', label: 'Source', render: r => r.sourceFile || r.source_file || 'Product Mix' }
    ]
    const departmentSalesColumns = [
      { key: 'category', label: 'Toast Department', render: row => row.category || row.toastDepartment || row.normalizedCategory || '-' },
      { key: 'itemCount', label: 'Items', render: row => Number(row.itemCount || 0).toLocaleString() },
      { key: 'salesAmount', label: 'Net Sales', render: row => money(num(row.salesAmount)) }
    ]
    const spendColumns = [
      { key: 'date', label: 'Date', render: r => r.date || rowDate(r, ['invoice_date', 'expense_date', 'date']) },
      { key: 'vendor', label: 'Vendor', render: r => r.vendor || r.vendor_name || '-' },
      { key: 'description', label: 'Item / Description', render: r => r.description || r.item_name || r.name || r.costLabel || '-' },
      { key: 'amount', label: 'Amount', render: r => money(num(r.allocatedAmount ?? r.amount)) }
    ]
    const payrollColumns = [
      { key: 'date', label: 'Date', render: r => rowDate(r, ['pay_date', 'payroll_date', 'date']) },
      { key: 'employee', label: 'Employee', render: r => r.employee_name || r.name || '-' },
      { key: 'classification', label: 'Classification', render: r => r.payrollLabel || payrollClassification(r) },
      { key: 'amount', label: 'Amount', render: r => money(num(r.amount || rowTotalPay(r))) }
    ]
    const configs = {
      'food-sales': {
        title: 'Food Sales Details',
        open: 'sales',
        onOpen: () => {
          sessionStorage.setItem('restapay_sales_drilldown', JSON.stringify({ department: 'food', start: dateStart, end: dateEnd }))
          setActive('sales')
        },
        rows: dc.foodSalesRows || [],
        columns: salesColumns,
        message: `Food total ${money(dc.foodSales)} is the sum of all non-alcohol Product Mix items in the selected period.`
      },
      'alcohol-sales': {
        title: 'Alcohol Sales Details',
        open: 'sales',
        onOpen: () => {
          sessionStorage.setItem('restapay_sales_drilldown', JSON.stringify({ department: 'alcohol', start: dateStart, end: dateEnd }))
          setActive('sales')
        },
        rows: dc.alcoholSalesRows || [],
        columns: salesColumns,
        message: `Alcohol total ${money(dc.alcoholSales)} includes beer, draft beer, liquor, wine, margaritas, cocktails and shots in the selected period.`
      },
      'food-purchases': { title: 'Food Purchase Details', open: 'invoices', rows: dc.spendDetails?.food || [], columns: spendColumns },
      'beer-purchases': { title: 'Beer Purchase Details', open: 'invoices', rows: dc.spendDetails?.beer || [], columns: spendColumns },
      'liquor-purchases': { title: 'Liquor and Wine Purchase Details', open: 'invoices', rows: dc.spendDetails?.liquor || [], columns: spendColumns },
      'margarita-mix': { title: 'Margarita Mix Details', open: 'invoices', rows: dc.spendDetails?.margaritaMix || [], columns: spendColumns, message: 'US Foods margarita mix and sweet/sour mix are allocated to Alcohol Cost.' },
      'kitchen-payroll': { title: 'Kitchen Payroll Details', open: 'payroll', rows: dc.payrollDetails?.kitchen || [], columns: payrollColumns },
      'manager-food': { title: 'Manager Payroll — Food Allocation', open: 'payroll', rows: (dc.payrollDetails?.manager || []).map(r => ({ ...r, amount: r.foodAllocated })), columns: payrollColumns },
      'manager-alcohol': { title: 'Manager Payroll — Alcohol Allocation', open: 'payroll', rows: (dc.payrollDetails?.manager || []).map(r => ({ ...r, amount: r.alcoholAllocated })), columns: payrollColumns },
      'bar-payroll': { title: 'Bar Payroll Details', open: 'payroll', rows: dc.payrollDetails?.bar || [], columns: payrollColumns },
      'food-shared': { title: 'Food Supplies and Shared Cost Details', open: 'expenses', rows: dc.spendDetails?.sharedFood || [], columns: spendColumns },
      'alcohol-shared': { title: 'Alcohol Shared Cost Details', open: 'expenses', rows: dc.spendDetails?.sharedAlcohol || [], columns: spendColumns },
      'true-food-cost': { title: 'True Food Cost Components', open: 'reports', rows: [
        { label: 'Food Purchases', amount: dc.foodPurchases }, { label: 'Kitchen Payroll', amount: dc.kitchenPayroll }, { label: 'Manager Allocation', amount: dc.managerFood }, { label: 'Supplies', amount: dc.foodSupplies }, { label: 'Shared Expenses', amount: dc.foodShared }
      ], columns: [{ key: 'label', label: 'Component' }, { key: 'amount', label: 'Amount', render: r => money(r.amount) }] },
      'true-alcohol-cost': { title: 'True Alcohol Cost Components', open: 'reports', rows: [
        { label: 'Beer Purchases', amount: dc.beerPurchases }, { label: 'Liquor / Wine', amount: dc.liquorPurchases }, { label: 'Margarita Mix', amount: dc.margaritaMix }, { label: 'Manager Allocation', amount: dc.managerAlcohol }, { label: 'Bar Payroll', amount: dc.barPayroll }, { label: 'Shared Expenses', amount: dc.alcoholShared }
      ], columns: [{ key: 'label', label: 'Component' }, { key: 'amount', label: 'Amount', render: r => money(r.amount) }] },
      'food-profit': { title: 'Food Profit Summary', open: 'reports', rows: [{ label: 'Food Sales', amount: dc.foodSales }, { label: 'True Food Cost', amount: dc.trueFoodCost }, { label: 'Food Profit', amount: dc.foodProfit }, { label: 'Food Profit Margin', amount: dc.foodProfitMargin, percent: true }], columns: [{ key: 'label', label: 'Metric' }, { key: 'amount', label: 'Value', render: r => r.percent ? pct(r.amount) : money(r.amount) }] },
      'alcohol-profit': { title: 'Alcohol Profit Summary', open: 'reports', rows: [{ label: 'Alcohol Sales', amount: dc.alcoholSales }, { label: 'True Alcohol Cost', amount: dc.trueAlcoholCost }, { label: 'Alcohol Profit', amount: dc.alcoholProfit }, { label: 'Alcohol Profit Margin', amount: dc.alcoholProfitMargin, percent: true }], columns: [{ key: 'label', label: 'Metric' }, { key: 'amount', label: 'Value', render: r => r.percent ? pct(r.amount) : money(r.amount) }] }
    }
    return configs[key] || null
  }

  const detailConfig = {
    sales: { title: 'Sales Details', open: 'sales', rows: derived.monthSales, columns: [
      { key: 'business_date', label: 'Date' }, { key: 'gross_sales', label: 'Gross', render: r => money(num(r.gross_sales)) }, { key: 'net_sales', label: 'Net', render: r => money(num(r.net_sales)) }, { key: 'cash_sales', label: 'Cash', render: r => money(num(r.cash_sales)) }, { key: 'tips', label: 'Tips', render: r => money(num(r.tips)) }
    ]},
    payroll: { title: 'Payroll Details', open: 'payroll', rows: derived.monthPayroll, columns: [
      { key: 'pay_date', label: 'Date', render: r => rowDate(r, ['pay_date', 'payroll_date', 'date']) }, { key: 'employee_name', label: 'Employee', render: r => r.employee_name || r.name || '-' }, { key: 'classification', label: 'Class', render: r => payrollClassification(r) }, { key: 'method', label: 'Method', render: r => r.payment_method || r.payroll_type || r.method || '-' }, { key: 'total_pay', label: 'Total', render: r => money(rowTotalPay(r)) }
    ]},
    'management-payroll': { title: 'Cash + Management Payroll Details', open: 'payroll',
      rows: [
        ...derived.cashPayrollBaseRows.map(row => ({ ...row, detailGroup: 'Cash Payroll' })),
        ...derived.managerPayrollRows.map(row => ({ ...row, detailGroup: 'Manager' })),
        ...derived.assistantManagerRows.map(row => ({ ...row, detailGroup: 'Assistant Manager' }))
      ],
      expected: derived.managementCashPayroll,
      amountGetter: rowTotalPay,
      groupSubtotals: [
        { label: 'Cash Payroll Subtotal', amount: derived.cashPayroll },
        { label: 'Manager Subtotal', amount: derived.managerPayrollTotal },
        { label: 'Assistant Manager Subtotal', amount: derived.assistantManagerPayroll }
      ],
      columns: [
      { key: 'pay_date', label: 'Date', render: r => rowDate(r, ['pay_date', 'payroll_date', 'date']) }, { key: 'employee_name', label: 'Employee', render: r => r.employee_name || r.name || '-' }, { key: 'classification', label: 'Group', render: r => r.detailGroup || 'Cash Payroll' }, { key: 'method', label: 'Method', render: r => r.payment_method || r.payroll_type || r.method || '-' }, { key: 'total_pay', label: 'Total', render: r => money(rowTotalPay(r)) }
    ]},
    'profit-net-sales': { title: 'Net Restaurant Sales Details', open: 'sales', rows: derived.monthSales, expected: derived.trueNetSales, amountGetter: r => num(r.net_sales), columns: [
      { key: 'business_date', label: 'Date', render: r => rowDate(r, ['business_date','date']) }, { key: 'net_sales', label: 'Net Sales', render: r => money(num(r.net_sales)) }
    ]},
    'profit-payroll': { title: 'Operating Payroll Details', open: 'payroll', rows: derived.operatingLaborRows, expected: derived.operatingPayroll, amountGetter: rowTotalPay, columns: [
      { key: 'pay_date', label: 'Date', render: r => rowDate(r, ['pay_date','payroll_date','date']) }, { key: 'employee_name', label: 'Employee', render: r => r.employee_name || r.name || '-' }, { key: 'classification', label: 'Classification', render: r => payrollClassification(r) }, { key: 'total_pay', label: 'Total', render: r => money(rowTotalPay(r)) }
    ]},
    'profit-spend': { title: 'Vendor + Expense Spend Details', open: 'expenses', rows: derived.allSpendRows, expected: derived.totalSpend, amountGetter: r => num(r.amount), columns: [
      { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Vendor / Payee' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: r => money(num(r.amount)) }
    ]},
    'profit-summary': { title: 'Profit & Loss Reconciliation', open: 'reports', rows: [
      { label: 'Net Restaurant Sales', amount: derived.trueNetSales }, { label: 'Less: Operating Payroll', amount: -derived.operatingPayroll }, { label: 'Less: Vendor + Expense Spend', amount: -derived.totalSpend }
    ], expected: derived.operatingProfit, amountGetter: r => num(r.amount), columns: [{ key:'label', label:'Component' }, { key:'amount', label:'Amount', render:r=>money(r.amount) }]},
    'sales-gross': { title: 'Gross Sales Details', open: 'sales', rows: derived.monthSales, expected: derived.grossSales, amountGetter: r => num(r.gross_sales || r.total_sales || r.net_sales), columns: [{ key:'business_date',label:'Date',render:r=>rowDate(r,['business_date','date'])},{key:'gross_sales',label:'Gross Sales',render:r=>money(num(r.gross_sales || r.total_sales || r.net_sales))}]},
    'sales-credit': { title: 'Credit Sales Details', open: 'sales', rows: derived.monthSales, expected: derived.creditSales, amountGetter: r => num(r.credit_sales), columns: [{ key:'business_date',label:'Date',render:r=>rowDate(r,['business_date','date'])},{key:'credit_sales',label:'Credit Sales',render:r=>money(num(r.credit_sales))}]},
    'sales-tips': { title: 'Tips Collected Details', open: 'sales', rows: derived.monthSales, expected: derived.tips, amountGetter: r => num(r.tips || r.tips_after_withholding), columns: [{ key:'business_date',label:'Date',render:r=>rowDate(r,['business_date','date'])},{key:'tips',label:'Tips',render:r=>money(num(r.tips || r.tips_after_withholding))}]},
    'sales-tax': { title: 'Sales Tax Details', open: 'sales', rows: derived.monthSales, expected: derived.tax, amountGetter: r => num(r.tax), columns: [{ key:'business_date',label:'Date',render:r=>rowDate(r,['business_date','date'])},{key:'tax',label:'Sales Tax',render:r=>money(num(r.tax))}]},
    vendors: { title: detailCategory ? `${detailCategory} Spending Details` : 'Vendor Spending Details', open: 'invoices', rows: detailVendorRows, columns: [
      { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Vendor / Payee' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: r => money(num(r.amount)) }
    ]},
    expenses: { title: detailCategory ? `${detailCategory} Expense Details` : 'Business Expense Details', open: 'expenses', rows: detailExpenseRows, columns: [
      { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Payee' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: r => money(num(r.amount)) }
    ]},
    department: departmentDetailConfig(detailCategory),
    reconciliation: { title: 'Dashboard Reconciliation', open: 'reports', rows: derived.reconciliationChecks.map(check => ({ ...check, status: Math.abs(check.difference) < 0.01 ? 'Balanced' : 'Review' })), expected: 0, amountGetter: r => num(r.difference), columns: [
      { key: 'label', label: 'Check' }, { key: 'status', label: 'Status' }, { key: 'difference', label: 'Difference', render: r => money(num(r.difference)) }
    ], message: 'A $0.00 difference means the card total and its underlying sources reconcile.' },
    health: { title: 'Restaurant Health Inputs', open: 'reports', rows: [
      { metric: 'Food Cost %', value: pct(derived.foodCostPct) }, { metric: 'Operating Labor %', value: pct(derived.laborPct) }, { metric: 'Prime Cost %', value: pct(derived.primeCostPct) }, { metric: 'Profit Margin', value: pct(derived.profitMargin) }, { metric: 'Cash Remaining', value: money(derived.cashRemaining) }
    ], columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }] }
  }

  return (
    <div className="dashboard-v3">
      <section className="dashboard-control-panel" aria-label="Dashboard date and sync controls">
        <div className="preset-group" aria-label="Quick date presets">
          <button type="button" className={`preset-btn ${preset === 'lastMonth' ? 'active' : ''}`} onClick={() => applyPreset('lastMonth')}>Last Month</button>
          <button type="button" className={`preset-btn ${preset === 'thisMonth' ? 'active' : ''}`} onClick={() => applyPreset('thisMonth')}>This Month</button>
          <button type="button" className={`preset-btn ${preset === 'lastWeek' ? 'active' : ''}`} onClick={() => applyPreset('lastWeek')}>Last Week</button>
          <button type="button" className={`preset-btn ${preset === 'all' ? 'active' : ''}`} onClick={() => applyPreset('all')}>All Dates</button>
        </div>
        <div className="date-range-inline">
          <label><small>Start</small><input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); setPreset('custom') }} /></label>
          <span className="date-arrow">→</span>
          <label><small>End</small><input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setPreset('custom') }} /></label>
          <button type="button" className="btn primary" onClick={applyRange}>Apply</button>
        </div>
        <div className="sync-group" aria-label="Database save status">
          <span className="cloud-save-pill"><span className="cloud-dot" /> Direct Database Save</span>
        </div>
        <span className="sync-status">{syncStatus}</span>
      </section>

      <section className="dashboard-command-row" aria-label="Dashboard quick operating summary">
        <div className="command-tile is-primary">
          <span>Cash Flow</span>
          <strong>{money(derived.cashRemaining)}</strong>
          <small>Toast cash {money(derived.cashSales)} minus operating cash payroll and cash expenses</small>
        </div>
        <div className="command-tile">
          <span>Prime Cost</span>
          <strong>{pct(derived.primeCostPct)}</strong>
          <small>Food + payroll against net restaurant sales</small>
        </div>
        <div className="command-tile">
          <span>Labor Mix</span>
          <strong>{pct(derived.laborPct)}</strong>
          <small>Cash {money(derived.cashPayroll)} · Check {money(derived.checkPayroll)}</small>
        </div>
        <div className="command-tile">
          <span>Food Cost</span>
          <strong>{pct(derived.foodCostPct)}</strong>
          <small>{money(derived.foodSpend)} food spend in selected range</small>
        </div>
      </section>

      <div className="metric-grid">
        {visible.netSales && <MetricCard title="Total Sales" value={money(derived.toastTotalSales)} subtitle={`Toast Sales Summary · ${derived.monthSales.length} rows`} icon="sales" tone="blue" onClick={() => showDetail('sales')} />}
        {visible.cashCollected && <MetricCard title="Cash Collected" value={money(derived.cashSales)} subtitle="Toast cash payments" icon="dollar" tone="green" onClick={() => showDetail('sales')} />}
        {visible.operatingProfit && <MetricCard title="Operating Profit" value={money(derived.operatingProfit)} subtitle={`${pct(derived.profitMargin)} margin`} icon="trending" tone="purple" onClick={() => showDetail('health')} />}
        {visible.cashRemaining && <MetricCard title="Cash Remaining" value={money(derived.cashRemaining)} subtitle={derived.cashNeeded > 0 ? `Cash needed ${money(derived.cashNeeded)}` : "After cash payroll and cash spending"} icon="card" tone="emerald" onClick={() => showDetail('health')} />}
        {visible.managementCashPayroll && <MetricCard title="Cash + Management Payroll" value={money(derived.managementCashPayroll)} subtitle={`Cash ${money(derived.cashPayroll)} · Managers ${money(derived.managerPayrollTotal)} · Assistants ${money(derived.assistantManagerPayroll)}`} icon="payroll" tone="teal" onClick={() => showDetail('management-payroll')} />}
        {visible.vendorSpend && <MetricCard title="Vendor Spend" value={money(derived.vendorSpend)} subtitle={`${derived.vendorRecent.length} recent rows`} icon="vendors" tone="orange" onClick={() => showDetail('vendors')} />}
        {visible.businessExpenses && <MetricCard title="Business Expenses" value={money(derived.businessSpend)} subtitle={`${derived.businessRecent.length} expense rows`} icon="expenses" tone="red" onClick={() => showDetail('expenses')} />}
        {visible.serverTips && <MetricCard title="Server Tips" value={money(derived.customerTipsPaid)} subtitle={`Separate from payroll profit · Checks ${money(derived.customerTipsChecks)}`} icon="receipt" tone="orange" onClick={() => showDetail('payroll')} />}
        {visible.primeCost && <MetricCard title="Prime Cost" value={pct(derived.primeCostPct)} subtitle="Food + operating labor; customer tips excluded" icon="pie" tone="indigo" onClick={() => showDetail('health')} />}
        {visible.trueFoodCost && <MetricCard title="True Food Cost" value={money(derived.departmentCosts.trueFoodCost)} subtitle={`${pct(derived.departmentCosts.foodCostPercent)} of food sales`} icon="menu-costing" tone="orange" onClick={() => showDetail('vendors', 'Food')} />}
        {visible.trueAlcoholCost && <MetricCard title="True Alcohol Cost" value={money(derived.departmentCosts.trueAlcoholCost)} subtitle={`${pct(derived.departmentCosts.alcoholCostPercent)} of alcohol sales`} icon="beer" tone="purple" onClick={() => showDetail('vendors')} />}
      </div>

      <section className="business-health-strip" aria-label="Today business health and reconciliation">
        <div><span>Food Cost</span><strong>{pct(derived.foodCostPct)}</strong><small>{money(derived.foodSpend)}</small></div>
        <div><span>Alcohol Sales</span><strong>{money(derived.departmentCosts.alcoholSales)}</strong><small>Margaritas included: {money(derived.margaritaSales)}</small></div>
        <div><span>Labor</span><strong>{pct(derived.laborPct)}</strong><small>Customer tips excluded</small></div>
        <div><span>Prime Cost</span><strong>{pct(derived.primeCostPct)}</strong><small>Food + operating labor</small></div>
        <div><span>Net Profit</span><strong>{money(derived.operatingProfit)}</strong><small>{pct(derived.profitMargin)} margin</small></div>
        <div><span>Average Check</span><strong>{money(derived.averageCheck)}</strong><small>{derived.guestCount.toLocaleString()} guests/checks</small></div>
        <button type="button" className={`reconciliation-tile ${derived.reconciliationOk ? 'ok' : 'warning'}`} onClick={() => showDetail('reconciliation')}>
          <span>Reconciliation</span><strong>{derived.reconciliationOk ? 'Balanced' : 'Review'}</strong><small>{derived.reconciliationOk ? 'All dashboard checks passed' : 'A total does not match its details'}</small>
        </button>
      </section>

      <div className="dashboard-grid-main">
        {visible.restaurantHealth && (<SectionCard title="Restaurant Health" icon="shield" tone="emerald" total={`${derived.healthScore}/100`} subtitle={healthLabel(derived.healthScore)}>
          <div className="health-block">
            <div className="health-score"><strong>{derived.healthScore}</strong><span>{healthLabel(derived.healthScore)}</span></div>
            <div className="health-meters">
              <ProgressMeter label="Food Cost" value={derived.foodCostPct} tone="orange" caption={`${money(derived.foodSpend)} food spend`} />
              <ProgressMeter label="Operating Labor" value={derived.laborPct} tone="teal" caption={`${money(derived.operatingPayroll)} excludes customer tips`} />
              <ProgressMeter label="Prime Cost" value={derived.primeCostPct} tone="purple" caption="Food + operating labor target under 65%" />
            </div>
          </div>
        </SectionCard>)}

        {visible.departmentProfitability && (<SectionCard title="Food & Alcohol Profitability" icon="pie" tone="purple" total={money(derived.departmentCosts.foodProfit + derived.departmentCosts.alcoholProfit)} subtitle="True departmental cost with allocation rules" action={<button type="button" className="btn secondary small-btn" onClick={() => setActive('cost-analysis')}>Open Cost Page</button>}>
          {(() => {
            const classifiedSales = derived.departmentCosts.foodSales + derived.departmentCosts.alcoholSales
            const foodShare = classifiedSales > 0 ? derived.departmentCosts.foodSales / classifiedSales * 100 : 0
            const alcoholShare = classifiedSales > 0 ? derived.departmentCosts.alcoholSales / classifiedSales * 100 : 0
            const foodLed = derived.departmentCosts.foodSales >= derived.departmentCosts.alcoholSales
            const leadAmount = Math.abs(derived.departmentCosts.foodSales - derived.departmentCosts.alcoholSales)
            return (
              <div className={`department-sales-mix ${foodLed ? 'food-led' : 'alcohol-led'}`}>
                <div>
                  <span className="department-sales-mix-kicker">Sales Mix</span>
                  <strong>{foodLed ? 'Food sales were higher' : 'Alcohol sales were higher'}</strong>
                  <small>{`${foodLed ? 'Food' : 'Alcohol'} led by ${money(leadAmount)} in the selected period`}</small>
                </div>
                <div className="department-sales-mix-shares">
                  <span><b>{pct(foodShare)}</b><small>Food</small></span>
                  <span><b>{pct(alcoholShare)}</b><small>Alcohol</small></span>
                </div>
              </div>
            )
          })()}
          <div className="department-cost-grid">
            <div className="department-cost-panel department-food-panel">
              <h3>Food Department</h3>
              <RowList rows={[
                { id: 'food-sales', label: 'Food Sales', amount: money(derived.departmentCosts.foodSales), meta: 'Toast food items from Product Mix' },
                { id: 'food-purchases', label: 'Food Purchases', amount: money(derived.departmentCosts.foodPurchases), meta: 'Net of rebates and credits' },
                { id: 'kitchen-payroll', label: 'Kitchen Payroll', amount: money(derived.departmentCosts.kitchenPayroll), meta: '100% allocated to food' },
                { id: 'manager-food', label: 'Manager Allocation', amount: money(derived.departmentCosts.managerFood), meta: 'Default 50% food' },
                { id: 'food-shared', label: 'Shared Supplies, Cintas & Utilities', amount: money(derived.departmentCosts.foodSupplies + derived.departmentCosts.foodShared), meta: 'Food share using Settings percentages' },
                { id: 'true-food-cost', label: 'True Food Cost', amount: money(derived.departmentCosts.trueFoodCost), meta: pct(derived.departmentCosts.foodCostPercent) },
                { id: 'food-profit', label: 'Food Profit', amount: money(derived.departmentCosts.foodProfit), meta: `${pct(derived.departmentCosts.foodProfitMargin)} margin` }
              ]} onRowClick={row => showDetail('department', row.id)} />
            </div>
            <div className="department-cost-panel department-alcohol-panel">
              <h3>Alcohol Department</h3>
              <RowList rows={[
                { id: 'alcohol-sales', label: 'Alcohol Sales', amount: money(derived.departmentCosts.alcoholSales), meta: 'Beer, liquor, wine, margaritas, cocktails and shots' },
                { id: 'beer-purchases', label: 'Beer Purchases', amount: money(derived.departmentCosts.beerPurchases), meta: 'All beer vendors' },
                { id: 'liquor-purchases', label: 'Liquor / Wine', amount: money(derived.departmentCosts.liquorPurchases), meta: 'ABC Store and all liquor/wine vendors' },
                { id: 'margarita-mix', label: 'Margarita Mix', amount: money(derived.departmentCosts.margaritaMix), meta: 'US Foods mix allocated to alcohol' },
                { id: 'manager-alcohol', label: 'Manager Allocation', amount: money(derived.departmentCosts.managerAlcohol), meta: 'Kept separate; percentage from Settings' },
                { id: 'bar-payroll', label: 'Bar Payroll', amount: money(derived.departmentCosts.barPayroll), meta: 'Bartender, barback and bar manager' },
                { id: 'alcohol-shared', label: 'Shared Supplies, Cintas & Utilities', amount: money(derived.departmentCosts.alcoholShared), meta: 'Alcohol share using Settings percentages' },
                { id: 'true-alcohol-cost', label: 'True Alcohol Cost', amount: money(derived.departmentCosts.trueAlcoholCost), meta: pct(derived.departmentCosts.alcoholCostPercent) },
                { id: 'alcohol-profit', label: 'Alcohol Profit', amount: money(derived.departmentCosts.alcoholProfit), meta: `${pct(derived.departmentCosts.alcoholProfitMargin)} margin` }
              ]} onRowClick={row => showDetail('department', row.id)} />
            </div>
          </div>
        </SectionCard>)}

        {visible.cashPosition && (<SectionCard title="Cash Position" icon="dollar" tone="green" total={money(derived.cashRemaining)} subtitle="Cash in vs cash out">
          <RowList rows={[
            { label: 'Cash Collected', amount: money(derived.cashSales), meta: 'From Toast sales' },
            { label: 'Cash Payroll', amount: money(derived.cashPayroll), meta: `${derived.cashPayrollRows.length} cash payroll rows` },
            { label: 'Server Tips Paid', amount: money(derived.customerTipsPaid), meta: 'Tracked separately from operating payroll' },
            { label: 'Invoice Spend', amount: money(derived.invoiceSpend), meta: `${derived.monthInvoices.length} invoices` },
            { label: 'Manual Expenses', amount: money(derived.manualExpenseSpend), meta: `${derived.monthExpenses.length} expenses` }
          ]} />
        </SectionCard>)}

        {visible.profitLoss && (<SectionCard title="Profit & Loss" icon="receipt" tone="purple" total={money(derived.operatingProfit)} subtitle="Selected date range">
          <RowList rows={[
            { id: 'profit-net-sales', label: 'Net Restaurant Sales', amount: money(derived.trueNetSales), meta: 'Net after tax/tips adjustment' },
            { id: 'profit-payroll', label: 'Operating Payroll Cost', amount: money(derived.operatingPayroll), meta: 'Kitchen/manager labor only; server tips excluded' },
            { id: 'profit-spend', label: 'Vendor + Expense Spend', amount: money(derived.totalSpend), meta: 'Invoices, line items, expenses' },
            { id: 'profit-summary', label: 'Profit Margin', amount: pct(derived.profitMargin), meta: 'Operating profit / net sales' }
          ]} onRowClick={row => showDetail(row.id)} />
        </SectionCard>)}

        {visible.salesPerformance && (<SectionCard title="Sales Performance" icon="sales" tone="blue" total={money(derived.grossSales)} subtitle="Gross and payment mix">
          <RowList rows={[
            { id: 'sales-gross', label: 'Gross Sales', amount: money(derived.grossSales), meta: 'Before adjustments' },
            { id: 'sales-credit', label: 'Credit Sales', amount: money(derived.creditSales), meta: 'Card payments' },
            { id: 'sales-tips', label: 'Tips Collected', amount: money(derived.tips), meta: `${money(derived.customerTipsPaid)} paid separately · ${money(derived.tipsWithheld)} withheld` },
            { id: 'sales-tax', label: 'Sales Tax', amount: money(derived.tax), meta: 'Tax collected' }
          ]} onRowClick={row => showDetail(row.id)} />
        </SectionCard>)}

        {visible.vendorPurchases && (<SectionCard title="Vendor Purchases" icon="invoices" tone="orange" total={money(derived.vendorSpend)} subtitle="COGS and vendor spend">
          <RowList rows={derived.vendorRecent.map(row => ({ label: row.vendor || 'Vendor Purchase', meta: `${row.date || ''} · ${row.category || 'Other'}`, amount: money(row.amount) }))} />
          <div className="category-pills">{derived.vendorCategories.slice(0, 6).map(row => <button key={row.id || row.label} type="button" onClick={() => showDetail('vendors', row.label)}><span>{row.label}</span><b>{money(row.amount)}</b></button>)}</div>
        </SectionCard>)}

        {visible.businessExpensePanel && (<SectionCard title="Business Expenses" icon="expenses" tone="red" total={money(derived.businessSpend)} subtitle="Operating expenses">
          <RowList rows={derived.businessRecent.map(row => ({ label: row.vendor || row.description || 'Expense', meta: `${row.date || ''} · ${row.category || 'Other'}`, amount: money(row.amount) }))} />
          <div className="category-pills">{derived.businessCategories.slice(0, 6).map(row => <button key={row.id || row.label} type="button" onClick={() => showDetail('expenses', row.label)}><span>{row.label}</span><b>{money(row.amount)}</b></button>)}</div>
        </SectionCard>)}
      </div>

      <div className="dashboard-grid-secondary">
        {visible.weeklySalesTrend && (<SectionCard title="Weekly Sales Trend" icon="trending" tone="blue" subtitle="Last seven date buckets">
          <MiniBars rows={derived.salesTrend} tone="blue" />
        </SectionCard>)}
        {visible.spendingTrend && (<SectionCard title="Spending Trend" icon="pie" tone="red" subtitle="Invoice + expense activity">
          <MiniBars rows={derived.expenseTrend} tone="red" />
        </SectionCard>)}
        {visible.restaurantIntelligence && (<SectionCard title="Restaurant Intelligence" icon="alert" tone="navy" subtitle="Suggested actions">
          <div className="insight-list">
            <div><b>{derived.healthScore >= 70 ? 'Restaurant health is stable' : 'Restaurant health needs review'}</b><span>Review food cost, operating labor, and cash position before payroll.</span></div>
            <div><b>{derived.foodCostPct > 35 ? 'Food cost is high' : 'Food cost is under control'}</b><span>Food cost is currently {pct(derived.foodCostPct)}.</span></div>
            <div><b>{derived.cashRemaining < 0 ? 'Cash shortfall risk' : 'Cash position looks usable'}</b><span>Remaining cash is {money(derived.cashRemaining)}.</span></div>
          </div>
        </SectionCard>)}
      </div>

      <DetailTable config={detailConfig[detailKey]} setActive={setActive} onClose={() => setDetail('')} />
    </div>
  )
}
