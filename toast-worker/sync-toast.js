import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createHash } from 'node:crypto'
import SftpClient from 'ssh2-sftp-client'
import { createClient } from '@supabase/supabase-js'
import { parse as parseCsv } from 'csv-parse/sync'
import * as XLSX from 'xlsx'

const REQUIRED = ['TOAST_SFTP_HOST', 'TOAST_SFTP_USERNAME', 'TOAST_PRIVATE_KEY_PATH', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const key of REQUIRED) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`)

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
  const headers = Object.keys(rows[0] || {}).join(' ').toLowerCase()
  const source = `${file} ${headers}`
  if (/product.?mix|item.?selection|all.?items/.test(source)) return 'Product Mix'
  if (/labor|time.?entr|employee.?hours|payroll/.test(source)) return 'Labor'
  if (/sales.?category|category.?summary/.test(source)) return 'Sales Categories'
  if (/sales.?summary|restaurant.?summary/.test(source)) return 'Sales Summary'
  if (/payment|credit.?card|settlement|processing|deposit/.test(source)) return 'Payments'
  if (/check.?detail|checks?/.test(source)) return 'Checks'
  if (/cash.?management|cash.?activity|closeout/.test(source)) return 'Cash Management'
  if (/menu/.test(source)) return 'Menu'
  if (/order/.test(source)) return 'Orders'
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
function parseRows(buffer, fileName) {
  const ext = path.extname(fileName).toLowerCase()
  if (ext === '.csv' || ext === '.txt') return parseCsv(buffer.toString('utf8').replace(/^\uFEFF/, ''), { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true })
  if (ext === '.xlsx' || ext === '.xls') {
    const book = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    return book.SheetNames.flatMap(sheetName => XLSX.utils.sheet_to_json(book.Sheets[sheetName], { defval: '', raw: false }).map(row => ({ __sheet: sheetName, ...row })))
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
  const needed = ['toast_import_runs', 'toast_import_files', 'toast_import_rows', 'toast_sales_categories', 'toast_product_mix', 'toast_labor', 'toast_payments', 'toast_merchant_fees']
  const missing = []
  for (const table of needed) if (!(await tableExists(table))) missing.push(table)
  if (missing.length) throw new Error(`Toast database schema is missing: ${missing.join(', ')}. Run supabase/RESTAPAY_RC12_TOAST_AUTOMATION.sql first.`)
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
async function replaceRows(table, fileId, payload) {
  const removed = await supabase.from(table).delete().eq('file_id', fileId)
  if (removed.error) throw removed.error
  for (let start = 0; start < payload.length; start += 500) {
    const inserted = await supabase.from(table).insert(payload.slice(start, start + 500))
    if (inserted.error) throw inserted.error
  }
}
function baseRecord(fileId, businessDate, fileName, raw) {
  return { id: id('toast-data'), file_id: fileId, business_date: businessDate, source_file: fileName, raw }
}
async function writeTypedRows(type, rows, context) {
  const { fileId, businessDate, fileName } = context
  if (type === 'Sales Categories') {
    const payload = rows.map(row => {
      const categoryName = text(value(row, ['Sales Category', 'Category', 'Name', 'Department']))
      if (!categoryName) return null
      return { ...baseRecord(fileId, rowDate(row, businessDate), fileName, row), category_name: categoryName, normalized_department: departmentFromCategory(categoryName), net_sales: number(value(row, ['Net Sales', 'Sales', 'Amount', 'Total'])), quantity: number(value(row, ['Quantity', 'Qty', 'Count', 'Items'])) }
    }).filter(Boolean)
    await replaceRows('toast_sales_categories', fileId, payload)
    return
  }
  if (type === 'Sales Summary') {
    const payload = rows.map(row => ({ ...baseRecord(fileId, rowDate(row, businessDate), fileName, row), gross_sales: number(value(row, ['Gross Sales', 'Gross'])), net_sales: number(value(row, ['Net Sales', 'Net'])), cash_sales: number(value(row, ['Cash', 'Cash Sales', 'Cash Payments', 'Actual Closeout Cash'])), credit_sales: number(value(row, ['Credit', 'Credit Sales', 'Credit Card Payments'])), tips: number(value(row, ['Tips', 'Total Tips'])), tax: number(value(row, ['Tax', 'Taxes'])), discounts: number(value(row, ['Discounts', 'Discount'])), refunds: number(value(row, ['Refunds', 'Refund'])), guest_count: number(value(row, ['Guests', 'Guest Count', 'Covers'])) }))
    await replaceRows('toast_sales_summary', fileId, payload)
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
      const tips = number(value(row, ['Total Tips', 'Tips', 'Non-Cash Tips', 'Declared Tips', 'Net Tips', 'Tips After Withholding']))
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
  const [{ data: categories }, { data: summaries }, { data: fees }, { data: labor }] = await Promise.all([
    supabase.from('toast_sales_categories').select('normalized_department,net_sales').eq('business_date', businessDate),
    supabase.from('toast_sales_summary').select('net_sales,tips').eq('business_date', businessDate),
    supabase.from('toast_merchant_fees').select('fee_amount').eq('business_date', businessDate),
    supabase.from('toast_labor').select('total_pay,tips').eq('business_date', businessDate)
  ])
  const food = (categories || []).filter(row => row.normalized_department === 'Food').reduce((sum, row) => sum + number(row.net_sales), 0)
  const alcohol = (categories || []).filter(row => row.normalized_department === 'Alcohol').reduce((sum, row) => sum + number(row.net_sales), 0)
  const other = (categories || []).filter(row => row.normalized_department === 'Other').reduce((sum, row) => sum + number(row.net_sales), 0)
  const toastNet = (summaries || []).reduce((sum, row) => sum + number(row.net_sales), 0) || food + alcohol + other
  const merchantFees = (fees || []).reduce((sum, row) => sum + number(row.fee_amount), 0)
  const laborPay = (labor || []).reduce((sum, row) => sum + number(row.total_pay) - number(row.tips), 0)
  const tips = (summaries || []).reduce((sum, row) => sum + number(row.tips), 0)
  const result = await supabase.from('toast_daily_summary').upsert({ business_date: businessDate, food_sales: food, alcohol_sales: alcohol, other_sales: other, toast_net_sales: toastNet, merchant_fees: merchantFees, labor_pay: laborPay, tips, last_run_id: runId, updated_at: new Date().toISOString() }, { onConflict: 'business_date' })
  if (result.error) throw result.error
}

const runId = id('toast-run')
let filesImported = 0
let filesSkipped = 0
let rowsImported = 0
let duplicatesSkipped = 0
let errorCount = 0
let latestBusinessDate = null

await assertSchema()
await supabase.from('toast_import_runs').insert({ id: runId, status: 'running', started_at: new Date().toISOString(), message: dryRun ? 'Dry run started' : 'Scheduled import started' })

try {
  const privateKey = await fs.readFile(process.env.TOAST_PRIVATE_KEY_PATH)
  await sftp.connect({ host: process.env.TOAST_SFTP_HOST, port: Number(process.env.TOAST_SFTP_PORT || 22), username: process.env.TOAST_SFTP_USERNAME, privateKey, readyTimeout: 30000 })
  const folders = await listDateFolders()
  if (!folders.length) throw new Error(`No Toast date folders found in the last ${lookbackDays} days for export ${exportId}.`)
  if (!dryRun) await ensureBucket()

  for (const folder of folders) {
    latestBusinessDate = folder.businessDate
    const entries = (await sftp.list(folder.remotePath)).filter(item => item.type !== 'd')
    for (const entry of entries) {
      const remoteFile = `${folder.remotePath}/${entry.name}`
      const buffer = await sftp.get(remoteFile)
      const fileHash = digest(buffer)
      const { data: existing } = await supabase.from('toast_import_files').select('id,status,file_hash').eq('remote_path', remoteFile).maybeSingle()
      if (existing?.status === 'Imported' && existing.file_hash === fileHash) {
        filesSkipped += 1
        duplicatesSkipped += 1
        continue
      }
      const rows = parseRows(buffer, entry.name)
      const type = reportType(entry.name, rows)
      const fileId = existing?.id || id('toast-file')
      if (!dryRun) {
        const storagePath = `${folder.folder}/${entry.name}`
        const upload = await supabase.storage.from(bucket).upload(storagePath, buffer, { upsert: true, contentType: entry.name.toLowerCase().endsWith('.csv') ? 'text/csv' : 'application/octet-stream' })
        if (upload.error) throw upload.error
        const fileRecord = { id: fileId, run_id: runId, business_date: folder.businessDate, report_type: type, file_name: entry.name, remote_path: remoteFile, storage_path: storagePath, file_hash: fileHash, file_size: entry.size || buffer.length, row_count: rows.length, status: 'Imported', error_message: '', imported_at: new Date().toISOString() }
        const upsert = await supabase.from('toast_import_files').upsert(fileRecord, { onConflict: 'remote_path' })
        if (upsert.error) throw upsert.error
        await supabase.from('toast_import_rows').delete().eq('file_id', fileId)
        const rawRows = rows.map((row, index) => ({ id: id('toast-row'), file_id: fileId, run_id: runId, business_date: folder.businessDate, report_type: type, row_number: index + 1, row_hash: digest(JSON.stringify(row)), data: row }))
        for (let start = 0; start < rawRows.length; start += 500) {
          const insert = await supabase.from('toast_import_rows').insert(rawRows.slice(start, start + 500))
          if (insert.error) throw insert.error
        }
        await writeTypedRows(type, rows, { fileId, businessDate: folder.businessDate, fileName: entry.name })
      }
      filesImported += 1
      rowsImported += rows.length
      console.log(`${dryRun ? '[dry-run] ' : ''}${folder.businessDate} ${entry.name} -> ${type}: ${rows.length} rows`)
    }
    if (!dryRun) await refreshDailySummary(folder.businessDate, runId)
  }

  const message = dryRun ? `Dry run found ${filesImported} changed files, ${filesSkipped} unchanged files, and ${rowsImported} rows.` : `Imported ${filesImported} new/changed files and ${rowsImported} rows; skipped ${filesSkipped} unchanged files.`
  await supabase.from('toast_import_runs').update({ status: 'success', business_date: latestBusinessDate, files_imported: filesImported, files_skipped: filesSkipped, rows_imported: rowsImported, duplicates_skipped: duplicatesSkipped, error_count: errorCount, finished_at: new Date().toISOString(), message }).eq('id', runId)
} catch (error) {
  errorCount += 1
  console.error(error)
  await supabase.from('toast_import_runs').update({ status: 'failed', business_date: latestBusinessDate, files_imported: filesImported, files_skipped: filesSkipped, rows_imported: rowsImported, duplicates_skipped: duplicatesSkipped, error_count: errorCount, finished_at: new Date().toISOString(), message: error.message }).eq('id', runId)
  process.exitCode = 1
} finally {
  await sftp.end().catch(() => {})
}
