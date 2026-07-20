import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createHash } from 'node:crypto'
import SftpClient from 'ssh2-sftp-client'
import { createClient } from '@supabase/supabase-js'
import { parse as parseCsv } from 'csv-parse/sync'
import * as XLSX from 'xlsx'

const REQUIRED = ['TOAST_SFTP_HOST', 'TOAST_SFTP_USERNAME', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const key of REQUIRED) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`)

async function loadPrivateKey() {
  const keyPath = process.env.TOAST_PRIVATE_KEY_PATH || process.env.TOAST_SFTP_PRIVATE_KEY_PATH
  if (keyPath) return fs.readFile(keyPath)
  const base64 = process.env.TOAST_PRIVATE_KEY_BASE64 || process.env.TOAST_SFTP_PRIVATE_KEY_BASE64
  if (base64) return Buffer.from(base64, 'base64')
  const inline = process.env.TOAST_PRIVATE_KEY || process.env.TOAST_SFTP_PRIVATE_KEY
  if (inline) return Buffer.from(inline.replace(/\\n/g, '\n'))
  throw new Error('Missing Toast private key. Configure TOAST_PRIVATE_KEY_PATH, TOAST_PRIVATE_KEY_BASE64, or TOAST_PRIVATE_KEY.')
}

const dryRun = process.argv.includes('--dry-run')
const exportId = process.env.TOAST_EXPORT_ID || '144385'
const lookbackDays = Math.max(1, Number(process.env.TOAST_LOOKBACK_DAYS || 8))
const bucket = process.env.TOAST_STORAGE_BUCKET || 'toast-exports'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const sftp = new SftpClient('restapay-toast-worker')

const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
const digest = value => createHash('sha256').update(value).digest('hex')
const ymd = date => date.toISOString().slice(0, 10).replaceAll('-', '')
const isoDate = value => /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : null
const cleanKey = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const text = value => String(value ?? '').trim()
const number = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-')
  const parsed = Number(raw.replace(/[$,%(),]/g, '').replaceAll(',', ''))
  return Number.isFinite(parsed) ? (negative ? -Math.abs(parsed) : parsed) : 0
}
function value(row, candidates, fallback = '') {
  const normalized = new Map(Object.entries(row || {}).map(([key, val]) => [cleanKey(key), val]))
  for (const candidate of candidates) {
    const found = normalized.get(cleanKey(candidate))
    if (found !== undefined && found !== null && found !== '') return found
  }
  return fallback
}
function rowDate(row, fallback) {
  const raw = value(row, ['Business Date', 'Date', 'Close Date', 'Opened Date', 'Payment Date', 'Order Date'], fallback)
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10)
}
function reportType(name = '', rows = []) {
  const file = name.toLowerCase()
  // Toast's standard export names are more reliable than broad header matching.
  if (/^timeentries\./.test(file)) return 'Labor'
  if (/^paymentdetails\./.test(file)) return 'Payments'
  if (/^checkdetails\./.test(file) || /^orderdetails\./.test(file)) return 'Checks'
  if (/^cashentries\./.test(file)) return 'Cash Management'
  if (/^itemselectiondetails\./.test(file) || /^allitemsreport\./.test(file) || /^modifiersselectiondetails\./.test(file)) return 'Product Mix'
  if (/^menuexport/.test(file)) return 'Menu'
  if (/sales.?category|category.?summary/.test(file)) return 'Sales Categories'
  if (/sales.?summary|restaurant.?summary|accountingreport/.test(file)) return 'Sales Summary'
  if (/kitchentimings|houseaccountexport/.test(file)) return 'Other'

  const headers = Object.keys(rows[0] || {}).join(' ').toLowerCase()
  const source = `${file} ${headers}`
  if (/product.?mix|item.?selection|all.?items/.test(source)) return 'Product Mix'
  if (/labor|time.?entr|employee.?hours|payroll/.test(source)) return 'Labor'
  if (/sales.?category|category.?summary/.test(source)) return 'Sales Categories'
  if (/sales.?summary|restaurant.?summary/.test(source)) return 'Sales Summary'
  if (/payment|credit.?card|settlement|processing|deposit/.test(source)) return 'Payments'
  if (/check.?detail|check.?number/.test(source)) return 'Checks'
  if (/cash.?management|cash.?activity|closeout/.test(source)) return 'Cash Management'
  if (/menu/.test(source)) return 'Menu'
  return 'Other'
}
function departmentFromCategory(category = '') {
  const normalized = text(category).toUpperCase()
  if (['BOTTLED BEER', 'COCKTAILS & SHOTS', 'DRAFT BEER', 'MARGARITAS', 'WINE'].some(name => normalized.includes(name))) return 'Alcohol'
  if (normalized.includes('FOOD') || normalized.includes('NO SALES CATEGORY ASSIGNED')) return 'Food'
  if (/NON-GRAT|SERVICE CHARGE|TIP|TAX|GIFT|DISCOUNT|FEE/.test(normalized)) return 'Other'
  return 'Other'
}
function departmentFromItem(row = {}) {
  const category = text(value(row, ['Sales Category', 'Category', 'Menu Group', 'Department']))
  const mapped = departmentFromCategory(category)
  if (mapped !== 'Other') return mapped
  const item = text(value(row, ['Item Name', 'Menu Item', 'Name', 'Description'])).toLowerCase()
  return /beer|lager|ale|ipa|draft|margarita|cocktail|shot|wine|tequila|vodka|rum|whiskey|bourbon|gin|mezcal|sangria/.test(item) ? 'Alcohol' : 'Food'
}
function flattenJsonRows(value, pathParts = []) {
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenJsonRows(item, [...pathParts, String(index)]))
  if (!value || typeof value !== 'object') return []
  const scalar = {}
  const nested = []
  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === 'object') nested.push([key, item])
    else scalar[key] = item
  }
  const looksLikeMenuItem = Object.keys(scalar).some(key => /name|guid|id|price|salescategory|menugroup/i.test(key))
  const rows = looksLikeMenuItem ? [{ __jsonPath: pathParts.join('.'), ...scalar }] : []
  for (const [key, item] of nested) rows.push(...flattenJsonRows(item, [...pathParts, key]))
  return rows
}
function parseRows(buffer, fileName) {
  const ext = path.extname(fileName).toLowerCase()
  if (ext === '.csv' || ext === '.txt') return parseCsv(buffer.toString('utf8').replace(/^\uFEFF/, ''), { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true })
  if (ext === '.xlsx' || ext === '.xls') {
    const book = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const isAccountingReport = /accountingreport/i.test(fileName)
    return book.SheetNames.flatMap(sheetName => {
      const sheet = book.Sheets[sheetName]
      if (!isAccountingReport) {
        return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }).map(row => ({ __sheet: sheetName, ...row }))
      }

      // AccountingReport.xls is a formatted report, not a normal header-based table.
      // Preserve every visible cell so label/value pairs can be extracted reliably.
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false })
      return matrix.map((cells, rowIndex) => {
        const row = { __sheet: sheetName, __rowNumber: rowIndex + 1 }
        cells.forEach((cell, columnIndex) => { row[`Column ${columnIndex + 1}`] = cell })
        return row
      })
    })
  }
  if (ext === '.json') {
    const parsed = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''))
    return flattenJsonRows(parsed)
  }
  return []
}
async function ensureBucket() {
  const { data, error } = await supabase.storage.listBuckets()
  if (error) throw error
  if (!(data || []).some(item => item.name === bucket)) {
    const result = await supabase.storage.createBucket(bucket, { public: false })
    if (result.error) throw result.error
  }
}
async function tableExists(name) {
  const { error } = await supabase.from(name).select('*', { head: true, count: 'exact' }).limit(1)
  return !error
}
async function assertSchema() {
  const needed = ['toast_import_runs', 'toast_import_files', 'toast_import_rows', 'toast_sales_categories', 'toast_sales_summary', 'toast_product_mix', 'toast_labor', 'toast_payments', 'toast_merchant_fees', 'toast_checks', 'toast_cash_management', 'toast_menu_items', 'toast_daily_summary']
  const missing = []
  for (const table of needed) if (!(await tableExists(table))) missing.push(table)
  if (missing.length) throw new Error(`Toast database schema is missing: ${missing.join(', ')}. Run supabase/RESTAPAY_RC12_TOAST_AUTOMATION.sql first.`)
}
async function normalizedFileComplete(file) {
  if (!file?.id || file.report_type !== 'Sales Summary') return true
  const { count, error } = await supabase
    .from('toast_sales_summary')
    .select('*', { count: 'exact', head: true })
    .eq('file_id', file.id)
  if (error) throw error
  return Number(count || 0) > 0
}
async function listDateFolders() {
  const roots = [`/${exportId}`, '/']
  const found = new Map()
  for (const root of roots) {
    const items = await sftp.list(root).catch(() => [])
    for (const item of items) {
      if (item.type !== 'd' || !/^\d{8}$/.test(item.name)) continue
      const businessDate = isoDate(item.name)
      const ageDays = Math.floor((Date.now() - new Date(`${businessDate}T12:00:00Z`).getTime()) / 86400000)
      if (ageDays < 0 || ageDays >= lookbackDays) continue
      found.set(`${root}/${item.name}`.replace('//', '/'), { remotePath: `${root}/${item.name}`.replace('//', '/'), folder: item.name, businessDate })
    }
  }
  if (!found.size) {
    for (let offset = 0; offset < lookbackDays; offset += 1) {
      const date = new Date(); date.setUTCDate(date.getUTCDate() - offset)
      const folder = ymd(date)
      for (const root of roots) {
        const remotePath = `${root}/${folder}`.replace('//', '/')
        if (await sftp.exists(remotePath)) found.set(remotePath, { remotePath, folder, businessDate: isoDate(folder) })
      }
    }
  }
  return [...found.values()].sort((a, b) => a.folder.localeCompare(b.folder))
}
async function replaceRows(table, fileId, payload, options = {}) {
  const { onConflict = null } = options
  const removed = await supabase.from(table).delete().eq('file_id', fileId)
  if (removed.error) throw removed.error
  if (!payload.length) return

  for (let start = 0; start < payload.length; start += 500) {
    const batch = payload.slice(start, start + 500)
    const query = onConflict
      ? supabase.from(table).upsert(batch, { onConflict })
      : supabase.from(table).insert(batch)
    const result = await query
    if (result.error) throw result.error
  }
}
function baseRecord(fileId, businessDate, fileName, raw, suffix = '') {
  const recordId = suffix
    ? `toast-data-${digest(`${fileId}|${businessDate}|${fileName}|${suffix}`).slice(0, 32)}`
    : id('toast-data')
  return { id: recordId, file_id: fileId, business_date: businessDate, source_file: fileName, raw }
}
function rowCells(row = {}) {
  return Object.entries(row)
    .filter(([key]) => !key.startsWith('__'))
    .map(([, cell]) => text(cell))
    .filter(Boolean)
}
function metricFromAccountingRows(rows, patterns) {
  for (const row of rows) {
    const cells = rowCells(row)
    const labelIndex = cells.findIndex(cell => patterns.some(pattern => pattern.test(cell)))
    if (labelIndex < 0) continue
    for (let index = labelIndex + 1; index < cells.length; index += 1) {
      if (/[-+]?[$]?[0-9][0-9,]*(?:\.[0-9]+)?%?|^\(.*\)$/.test(cells[index])) return number(cells[index])
    }
  }
  return 0
}
function summarizeAccountingRows(rows, businessDate, fileId, fileName) {
  const metrics = {
    gross_sales: metricFromAccountingRows(rows, [/^gross sales?$/i, /^gross$/i]),
    net_sales: metricFromAccountingRows(rows, [/^net sales?$/i, /^net$/i]),
    cash_sales: metricFromAccountingRows(rows, [/^cash( sales| payments?)?$/i, /actual closeout cash/i]),
    credit_sales: metricFromAccountingRows(rows, [/^credit( card)?( sales| payments?)?$/i]),
    tips: metricFromAccountingRows(rows, [/^total tips?$/i, /^tips?$/i]),
    tax: metricFromAccountingRows(rows, [/^total tax(es)?$/i, /^tax(es)?$/i]),
    discounts: metricFromAccountingRows(rows, [/^discounts?$/i]),
    refunds: metricFromAccountingRows(rows, [/^refunds?$/i]),
    guest_count: metricFromAccountingRows(rows, [/^guest count$/i, /^guests?$/i, /^covers?$/i])
  }
  return { ...baseRecord(fileId, businessDate, fileName, { extracted_from: 'AccountingReport.xls' }, 'summary'), ...metrics }
}
function accountingCategoryRows(rows, businessDate, fileId, fileName) {
  const knownCategories = ['BOTTLED BEER', 'COCKTAILS & SHOTS', 'DRAFT BEER', 'FOOD', 'MARGARITAS', 'NO SALES CATEGORY ASSIGNED', 'NON-GRAT SVC CHARGES', 'WINE']
  const totals = new Map()
  for (const row of rows) {
    const cells = rowCells(row)
    const category = cells.find(cell => knownCategories.includes(cell.toUpperCase()))
    if (!category) continue
    const categoryIndex = cells.indexOf(category)
    const amountCell = cells.slice(categoryIndex + 1).find(cell => /[-+]?[$]?[0-9][0-9,]*(?:\.[0-9]+)?%?|^\(.*\)$/.test(cell))
    if (!amountCell) continue
    const key = category.toUpperCase()
    totals.set(key, (totals.get(key) || 0) + number(amountCell))
  }
  return [...totals.entries()].map(([categoryName, netSales]) => ({
    ...baseRecord(fileId, businessDate, fileName, { extracted_from: 'AccountingReport.xls', category_name: categoryName }, `category-${categoryName}`),
    category_name: categoryName,
    normalized_department: departmentFromCategory(categoryName),
    net_sales: netSales,
    quantity: 0
  }))
}
async function writeTypedRows(type, rows, context) {
  const { fileId, businessDate, fileName } = context
  if (type === 'Sales Categories') {
    const grouped = new Map()
    for (const row of rows) {
      const categoryName = text(value(row, ['Sales Category', 'Category', 'Name', 'Department']))
      if (!categoryName) continue
      const date = rowDate(row, businessDate)
      const key = `${date}|${categoryName.toUpperCase()}`
      const current = grouped.get(key) || { businessDate: date, categoryName, netSales: 0, quantity: 0, raw: [] }
      current.netSales += number(value(row, ['Net Sales', 'Sales', 'Amount', 'Total']))
      current.quantity += number(value(row, ['Quantity', 'Qty', 'Count', 'Items']))
      current.raw.push(row)
      grouped.set(key, current)
    }
    const payload = [...grouped.values()].map(item => ({
      ...baseRecord(fileId, item.businessDate, fileName, item.raw, `category-${item.categoryName}`),
      category_name: item.categoryName,
      normalized_department: departmentFromCategory(item.categoryName),
      net_sales: item.netSales,
      quantity: item.quantity
    }))
    await replaceRows('toast_sales_categories', fileId, payload, { onConflict: 'business_date,category_name,source_file' })
    return
  }
  if (type === 'Sales Summary') {
    let payload
    if (/accountingreport/i.test(fileName)) {
      payload = [summarizeAccountingRows(rows, businessDate, fileId, fileName)]
      const categories = accountingCategoryRows(rows, businessDate, fileId, fileName)
      await replaceRows('toast_sales_categories', fileId, categories, { onConflict: 'business_date,category_name,source_file' })
    } else {
      const grouped = new Map()
      for (const row of rows) {
        const date = rowDate(row, businessDate)
        const current = grouped.get(date) || { gross_sales: 0, net_sales: 0, cash_sales: 0, credit_sales: 0, tips: 0, tax: 0, discounts: 0, refunds: 0, guest_count: 0, raw: [] }
        current.gross_sales += number(value(row, ['Gross Sales', 'Gross']))
        current.net_sales += number(value(row, ['Net Sales', 'Net']))
        current.cash_sales += number(value(row, ['Cash', 'Cash Sales', 'Cash Payments', 'Actual Closeout Cash']))
        current.credit_sales += number(value(row, ['Credit', 'Credit Sales', 'Credit Card Payments']))
        current.tips += number(value(row, ['Tips', 'Total Tips']))
        current.tax += number(value(row, ['Tax', 'Taxes']))
        current.discounts += number(value(row, ['Discounts', 'Discount']))
        current.refunds += number(value(row, ['Refunds', 'Refund']))
        current.guest_count += number(value(row, ['Guests', 'Guest Count', 'Covers']))
        current.raw.push(row)
        grouped.set(date, current)
      }
      payload = [...grouped.entries()].map(([date, metrics]) => ({ ...baseRecord(fileId, date, fileName, metrics.raw, 'summary'), ...metrics, raw: metrics.raw }))
    }
    await replaceRows('toast_sales_summary', fileId, payload, { onConflict: 'business_date,source_file' })
    return
  }
  if (type === 'Product Mix') {
    const payload = rows.map(row => {
      const itemName = text(value(row, ['Item Name', 'Menu Item', 'Name', 'Description']))
      if (!itemName) return null
      return { ...baseRecord(fileId, rowDate(row, businessDate), fileName, row), item_name: itemName, sales_category: text(value(row, ['Sales Category', 'Category', 'Department', 'Menu Group'])), normalized_department: departmentFromItem(row), quantity: number(value(row, ['Qty Sold', 'Quantity', 'Qty', 'Count'])), net_sales: number(value(row, ['Net Sales', 'Sales', 'Amount'])), gross_sales: number(value(row, ['Gross Sales', 'Gross'])) }
    }).filter(Boolean)
    await replaceRows('toast_product_mix', fileId, payload)
    return
  }
  if (type === 'Labor') {
    const payload = rows.map(row => {
      const employeeName = text(value(row, ['Employee', 'Employee Name', 'Name']))
      if (!employeeName) return null
      const regularPay = number(value(row, ['Regular Pay', 'Wages', 'Hourly Pay']))
      const overtimePay = number(value(row, ['Overtime Pay', 'OT Pay']))
      const tips = number(value(row, ['Tips', 'Net Tips', 'Tips After Withholding']))
      return { ...baseRecord(fileId, rowDate(row, businessDate), fileName, row), employee_name: employeeName, job_name: text(value(row, ['Job', 'Job Name', 'Role'])), regular_hours: number(value(row, ['Regular Hours', 'Hours'])), overtime_hours: number(value(row, ['Overtime Hours', 'OT Hours'])), regular_pay: regularPay, overtime_pay: overtimePay, tips, total_pay: number(value(row, ['Total Pay', 'Gross Pay'], regularPay + overtimePay + tips)) }
    }).filter(Boolean)
    await replaceRows('toast_labor', fileId, payload)
    return
  }
  if (type === 'Payments') {
    const paymentRows = []
    const feeRows = []
    for (const row of rows) {
      const paymentType = text(value(row, ['Payment Type', 'Type', 'Tender', 'Card Type'], 'Other'))
      const gross = number(value(row, ['Gross Amount', 'Amount', 'Payment Amount', 'Card Sales', 'Gross Sales']))
      const tips = number(value(row, ['Tips', 'Tip Amount']))
      const fee = Math.abs(number(value(row, ['Processing Fee', 'Merchant Fee', 'Fee Amount', 'Fees', 'Toast Fee'])))
      const net = number(value(row, ['Net Amount', 'Net Deposit', 'Deposit Amount'], gross - fee))
      const common = baseRecord(fileId, rowDate(row, businessDate), fileName, row)
      paymentRows.push({ ...common, payment_type: paymentType, card_type: text(value(row, ['Card Type', 'Card Brand', 'Brand'])), gross_amount: gross, tip_amount: tips, fee_amount: fee, net_amount: net })
      if (fee > 0) feeRows.push({ ...common, id: id('toast-fee'), processor: text(value(row, ['Processor'], 'Toast')), payment_type: paymentType, gross_card_sales: gross, fee_amount: fee, net_deposit: net })
    }
    await replaceRows('toast_payments', fileId, paymentRows)
    await replaceRows('toast_merchant_fees', fileId, feeRows)
    await syncMerchantFeeExpenses(feeRows)
    return
  }
  if (type === 'Checks') {
    const payload = rows.map(row => ({ ...baseRecord(fileId, rowDate(row, businessDate), fileName, row), check_number: text(value(row, ['Check Number', 'Check #', 'Check ID'])), order_number: text(value(row, ['Order Number', 'Order #', 'Order ID'])), server_name: text(value(row, ['Server', 'Employee'])), dining_option: text(value(row, ['Dining Option', 'Order Type'])), net_sales: number(value(row, ['Net Sales'])), tax: number(value(row, ['Tax'])), tip: number(value(row, ['Tip', 'Tips'])), total: number(value(row, ['Total', 'Check Total'])) }))
    await replaceRows('toast_checks', fileId, payload)
    return
  }
  if (type === 'Cash Management') {
    const payload = rows.map(row => ({ ...baseRecord(fileId, rowDate(row, businessDate), fileName, row), activity_type: text(value(row, ['Activity Type', 'Type', 'Reason'])), employee_name: text(value(row, ['Employee', 'Employee Name'])), amount: number(value(row, ['Amount', 'Cash Amount'])) }))
    await replaceRows('toast_cash_management', fileId, payload)
    return
  }
  if (type === 'Menu') {
    const payload = rows.map(row => {
      const itemName = text(value(row, ['Item Name', 'Name', 'Menu Item']))
      if (!itemName) return null
      return { ...baseRecord(fileId, businessDate, fileName, row), item_guid: text(value(row, ['GUID', 'Item GUID', 'ID'])), item_name: itemName, menu_group: text(value(row, ['Menu Group', 'Group'])), sales_category: text(value(row, ['Sales Category', 'Category'])), price: number(value(row, ['Price', 'Menu Price'])), active: !/false|inactive|no/i.test(text(value(row, ['Active', 'Status'], 'true'))) }
    }).filter(Boolean)
    await replaceRows('toast_menu_items', fileId, payload)
  }
}
async function syncMerchantFeeExpenses(feeRows) {
  if (!feeRows.length || !(await tableExists('expenses'))) return
  const expenses = feeRows.map(row => ({
    id: `toast-merchant-fee-${row.business_date}-${digest(`${row.source_file}|${row.payment_type}|${row.fee_amount}`).slice(0, 16)}`,
    expense_date: row.business_date,
    name: 'Toast Merchant Processing Fees',
    vendor: row.processor || 'Toast',
    category: 'Merchant Fees',
    payment_type: 'ACH',
    amount: row.fee_amount,
    notes: `Automatically imported from ${row.source_file}. Tips excluded from profit calculations.`,
    recurring: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }))
  const result = await supabase.from('expenses').upsert(expenses, { onConflict: 'id' })
  if (result.error) console.warn(`Merchant fees were saved to toast_merchant_fees but could not be mirrored to expenses: ${result.error.message}`)
}
async function refreshDailySummary(businessDate, runId) {
  const [{ data: categories }, { data: summaries }, { data: productMix }, { data: checks }, { data: payments }, { data: fees }, { data: labor }] = await Promise.all([
    supabase.from('toast_sales_categories').select('normalized_department,net_sales').eq('business_date', businessDate),
    supabase.from('toast_sales_summary').select('net_sales,tips,tax,cash_sales,credit_sales').eq('business_date', businessDate),
    supabase.from('toast_product_mix').select('normalized_department,net_sales').eq('business_date', businessDate),
    supabase.from('toast_checks').select('net_sales,tax,tip,total').eq('business_date', businessDate),
    supabase.from('toast_payments').select('payment_type,gross_amount,tip_amount,net_amount').eq('business_date', businessDate),
    supabase.from('toast_merchant_fees').select('fee_amount').eq('business_date', businessDate),
    supabase.from('toast_labor').select('total_pay,tips').eq('business_date', businessDate)
  ])
  const departmentRows = (categories || []).length ? categories : (productMix || [])
  const food = departmentRows.filter(row => row.normalized_department === 'Food').reduce((sum, row) => sum + number(row.net_sales), 0)
  const alcohol = departmentRows.filter(row => row.normalized_department === 'Alcohol').reduce((sum, row) => sum + number(row.net_sales), 0)
  const other = departmentRows.filter(row => row.normalized_department === 'Other').reduce((sum, row) => sum + number(row.net_sales), 0)
  const summaryNet = (summaries || []).reduce((sum, row) => sum + number(row.net_sales), 0)
  const checkNet = (checks || []).reduce((sum, row) => sum + number(row.net_sales), 0)
  const toastNet = summaryNet || checkNet || food + alcohol + other
  const merchantFees = (fees || []).reduce((sum, row) => sum + number(row.fee_amount), 0)
  const laborPay = (labor || []).reduce((sum, row) => sum + number(row.total_pay) - number(row.tips), 0)
  const summaryTips = (summaries || []).reduce((sum, row) => sum + number(row.tips), 0)
  const checkTips = (checks || []).reduce((sum, row) => sum + number(row.tip), 0)
  const paymentTips = (payments || []).reduce((sum, row) => sum + number(row.tip_amount), 0)
  const tips = summaryTips || checkTips || paymentTips
  const result = await supabase.from('toast_daily_summary').upsert({
    business_date: businessDate,
    food_sales: food,
    alcohol_sales: alcohol,
    other_sales: other,
    toast_net_sales: toastNet,
    merchant_fees: merchantFees,
    labor_pay: laborPay,
    tips,
    last_run_id: runId,
    updated_at: new Date().toISOString()
  }, { onConflict: 'business_date' })
  if (result.error) throw result.error
}

const runId = id('toast-run')
let filesImported = 0
let filesSkipped = 0
let rowsImported = 0
let duplicatesSkipped = 0
let errorCount = 0
let latestBusinessDate = null
let processedFiles = 0
let totalFiles = 0

async function updateRun(patch = {}) {
  const payload = {
    files_imported: filesImported,
    files_skipped: filesSkipped,
    rows_imported: rowsImported,
    duplicates_skipped: duplicatesSkipped,
    error_count: errorCount,
    processed_files: processedFiles,
    total_files: totalFiles,
    progress_percent: totalFiles ? Math.min(100, Math.round((processedFiles / totalFiles) * 100)) : 0,
    heartbeat_at: new Date().toISOString(),
    ...patch
  }
  const { error } = await supabase.from('toast_import_runs').update(payload).eq('id', runId)
  if (error) throw error
}

await assertSchema()
await supabase.from('toast_import_runs').insert({
  id: runId,
  status: 'running',
  started_at: new Date().toISOString(),
  heartbeat_at: new Date().toISOString(),
  message: dryRun ? 'Dry run started' : 'Connecting to Toast SFTP...'
})

try {
  const privateKey = await loadPrivateKey()
  await sftp.connect({
    host: process.env.TOAST_SFTP_HOST,
    port: Number(process.env.TOAST_SFTP_PORT || 22),
    username: process.env.TOAST_SFTP_USERNAME,
    privateKey,
    passphrase: process.env.TOAST_PRIVATE_KEY_PASSPHRASE || process.env.TOAST_SFTP_PRIVATE_KEY_PASSPHRASE || undefined,
    readyTimeout: 30000,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3
  })
  const folders = await listDateFolders()
  if (!folders.length) throw new Error(`No Toast date folders found in the last ${lookbackDays} days for export ${exportId}.`)
  if (!dryRun) await ensureBucket()

  const work = []
  for (const folder of folders) {
    const entries = (await sftp.list(folder.remotePath)).filter(item => item.type !== 'd')
    for (const entry of entries) work.push({ folder, entry, remoteFile: `${folder.remotePath}/${entry.name}` })
  }
  totalFiles = work.length
  await updateRun({ message: `Found ${totalFiles} Toast export files across ${folders.length} business day(s).` })

  for (let workIndex = 0; workIndex < work.length; workIndex += 1) {
    const item = work[workIndex]
    const { folder, entry, remoteFile } = item
    latestBusinessDate = folder.businessDate
    let currentFileId = null
    let remoteModifiedAt = null

    try {
      await updateRun({
        business_date: folder.businessDate,
        current_business_date: folder.businessDate,
        current_file: entry.name,
        current_report_type: 'Detecting',
        message: `Processing ${entry.name}`
      })

      const existingResult = await supabase
        .from('toast_import_files')
        .select('id,status,report_type,file_hash,file_size,remote_modified_at')
        .eq('remote_path', remoteFile)
        .maybeSingle()
      if (existingResult.error) throw existingResult.error
      const existing = existingResult.data
      currentFileId = existing?.id || id('toast-file')

      remoteModifiedAt = entry.modifyTime ? new Date(entry.modifyTime).toISOString() : null
      const normalizedComplete = await normalizedFileComplete(existing)
      const metadataMatches = existing?.status === 'Imported'
        && normalizedComplete
        && Number(existing.file_size || 0) === Number(entry.size || 0)
        && (!remoteModifiedAt || !existing.remote_modified_at || new Date(existing.remote_modified_at).getTime() === new Date(remoteModifiedAt).getTime())

      if (metadataMatches) {
        filesSkipped += 1
        duplicatesSkipped += 1
        processedFiles += 1
        await updateRun({ message: `Skipped unchanged file ${entry.name}` })
      } else {
        const buffer = await sftp.get(remoteFile)
        const fileHash = digest(buffer)
        if (existing?.status === 'Imported' && normalizedComplete && existing.file_hash === fileHash) {
          filesSkipped += 1
          duplicatesSkipped += 1
          processedFiles += 1
          if (!dryRun) {
            const checked = await supabase.from('toast_import_files').update({
              file_size: entry.size || buffer.length,
              remote_modified_at: remoteModifiedAt,
              checked_at: new Date().toISOString()
            }).eq('id', existing.id)
            if (checked.error) throw checked.error
          }
          await updateRun({ message: `Skipped duplicate file ${entry.name}` })
        } else {
          const rows = parseRows(buffer, entry.name)
          const type = reportType(entry.name, rows)
          await updateRun({ current_report_type: type, message: `Importing ${entry.name} (${rows.length} rows)` })

          if (!dryRun) {
            const storagePath = `${folder.folder}/${entry.name}`
            const upload = await supabase.storage.from(bucket).upload(storagePath, buffer, {
              upsert: true,
              contentType: entry.name.toLowerCase().endsWith('.csv') ? 'text/csv' : 'application/octet-stream'
            })
            if (upload.error) throw upload.error

            // Mark the file as Processing first. It becomes Imported only after
            // raw and normalized rows both finish successfully.
            const processingRecord = {
              id: currentFileId,
              run_id: runId,
              business_date: folder.businessDate,
              report_type: type,
              file_name: entry.name,
              remote_path: remoteFile,
              storage_path: storagePath,
              file_hash: fileHash,
              file_size: entry.size || buffer.length,
              remote_modified_at: remoteModifiedAt,
              checked_at: new Date().toISOString(),
              row_count: rows.length,
              status: 'Processing',
              error_message: '',
              imported_at: null
            }
            const processingUpsert = await supabase.from('toast_import_files').upsert(processingRecord, { onConflict: 'remote_path' })
            if (processingUpsert.error) throw processingUpsert.error

            const removeRaw = await supabase.from('toast_import_rows').delete().eq('file_id', currentFileId)
            if (removeRaw.error) throw removeRaw.error
            const rawRows = rows.map((row, index) => ({
              id: `toast-row-${digest(`${currentFileId}|${index + 1}`).slice(0, 32)}`,
              file_id: currentFileId,
              run_id: runId,
              business_date: folder.businessDate,
              report_type: type,
              row_number: index + 1,
              row_hash: digest(JSON.stringify(row)),
              data: row
            }))
            for (let start = 0; start < rawRows.length; start += 500) {
              const insert = await supabase.from('toast_import_rows').upsert(rawRows.slice(start, start + 500), { onConflict: 'file_id,row_number' })
              if (insert.error) throw insert.error
            }

            await writeTypedRows(type, rows, { fileId: currentFileId, businessDate: folder.businessDate, fileName: entry.name })

            const completed = await supabase.from('toast_import_files').update({
              status: 'Imported',
              error_message: '',
              imported_at: new Date().toISOString(),
              checked_at: new Date().toISOString()
            }).eq('id', currentFileId)
            if (completed.error) throw completed.error
          }

          filesImported += 1
          rowsImported += rows.length
          processedFiles += 1
          console.log(`${dryRun ? '[dry-run] ' : ''}${folder.businessDate} ${entry.name} -> ${type}: ${rows.length} rows`)
          await updateRun({ message: `Completed ${entry.name}` })
        }
      }
    } catch (fileError) {
      errorCount += 1
      processedFiles += 1
      console.error(`Failed to import ${remoteFile}:`, fileError)

      if (!dryRun && currentFileId) {
        const failedRecord = {
          id: currentFileId,
          run_id: runId,
          business_date: folder.businessDate,
          report_type: 'Other',
          file_name: entry.name,
          remote_path: remoteFile,
          file_size: entry.size || 0,
          remote_modified_at: remoteModifiedAt,
          checked_at: new Date().toISOString(),
          status: 'Failed',
          error_message: String(fileError?.message || fileError),
          imported_at: null
        }
        const failed = await supabase.from('toast_import_files').upsert(failedRecord, { onConflict: 'remote_path' })
        if (failed.error) console.error(`Unable to mark ${entry.name} as failed:`, failed.error)
      }

      await updateRun({
        message: `Failed ${entry.name}: ${String(fileError?.message || fileError)}`
      }).catch(updateError => console.error('Unable to update run after file failure:', updateError))
    }

    const nextItem = work[workIndex + 1]
    if (!nextItem || nextItem.folder.businessDate !== folder.businessDate) {
      if (!dryRun) {
        try {
          await refreshDailySummary(folder.businessDate, runId)
        } catch (summaryError) {
          errorCount += 1
          console.error(`Unable to refresh daily summary for ${folder.businessDate}:`, summaryError)
          await updateRun({ message: `Daily summary failed for ${folder.businessDate}: ${summaryError.message}` })
        }
      }
    }
  }

  const message = dryRun
    ? `Dry run found ${filesImported} changed files, ${filesSkipped} unchanged files, and ${rowsImported} rows.`
    : `Imported ${filesImported} new/changed files and ${rowsImported} rows; skipped ${filesSkipped} unchanged files.`
  await updateRun({
    status: 'success', business_date: latestBusinessDate, finished_at: new Date().toISOString(),
    progress_percent: 100, current_file: '', current_report_type: '',
    message: errorCount ? `${message} ${errorCount} file or summary error(s) were recorded; retry will process only failed files.` : message
  })
} catch (error) {
  errorCount += 1
  console.error(error)
  await updateRun({
    status: 'failed', business_date: latestBusinessDate, finished_at: new Date().toISOString(),
    message: error.message
  }).catch(updateError => console.error('Unable to save failed Toast run status:', updateError))
  process.exitCode = 1
} finally {
  await sftp.end().catch(() => {})
}
