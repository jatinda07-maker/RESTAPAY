import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import SftpClient from 'ssh2-sftp-client'
import { createClient } from '@supabase/supabase-js'
import { parse as parseCsv } from 'csv-parse/sync'
import * as XLSX from 'xlsx'

const required = ['TOAST_SFTP_HOST', 'TOAST_SFTP_USERNAME', 'TOAST_PRIVATE_KEY_PATH', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`)

const dryRun = process.argv.includes('--dry-run')
const exportId = process.env.TOAST_EXPORT_ID || '144385'
const lookbackDays = Number(process.env.TOAST_LOOKBACK_DAYS || 8)
const bucket = process.env.TOAST_STORAGE_BUCKET || 'toast-exports'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const sftp = new SftpClient('restapay-toast-worker')

function id(prefix = 'id') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }
function ymd(date) { return date.toISOString().slice(0, 10).replaceAll('-', '') }
function isoDate(folder) { return /^\d{8}$/.test(folder) ? `${folder.slice(0,4)}-${folder.slice(4,6)}-${folder.slice(6,8)}` : null }
function reportType(name = '') {
  const text = name.toLowerCase()
  if (text.includes('product') || text.includes('item')) return 'Product Mix'
  if (text.includes('labor') || text.includes('timeentr') || text.includes('employee')) return 'Labor'
  if (text.includes('payment') || text.includes('sales') || text.includes('order')) return 'Sales'
  if (text.includes('cash')) return 'Cash Closeout'
  if (text.includes('menu')) return 'Menu'
  return 'Other'
}
function parseRows(buffer, fileName) {
  const ext = path.extname(fileName).toLowerCase()
  if (ext === '.csv' || ext === '.txt') return parseCsv(buffer.toString('utf8').replace(/^\uFEFF/, ''), { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true })
  if (ext === '.xlsx' || ext === '.xls') {
    const book = XLSX.read(buffer, { type: 'buffer' })
    return book.SheetNames.flatMap(sheetName => XLSX.utils.sheet_to_json(book.Sheets[sheetName], { defval: '' }).map(row => ({ __sheet: sheetName, ...row })))
  }
  return []
}
async function exists(remotePath) { try { return await sftp.exists(remotePath) } catch { return false } }
async function ensureBucket() {
  const { data } = await supabase.storage.listBuckets()
  if (!(data || []).some(item => item.name === bucket)) await supabase.storage.createBucket(bucket, { public: false })
}
async function findDateFolder() {
  const roots = [`/${exportId}`, '/']
  for (let offset = 0; offset < lookbackDays; offset += 1) {
    const date = new Date(); date.setUTCDate(date.getUTCDate() - offset)
    const folder = ymd(date)
    for (const root of roots) {
      const candidate = root === '/' ? `/${folder}` : `${root}/${folder}`
      if (await exists(candidate)) return { remotePath: candidate, folder, businessDate: isoDate(folder) }
    }
  }
  const rootItems = await sftp.list('/').catch(() => [])
  const dated = rootItems.filter(item => item.type === 'd' && /^\d{8}$/.test(item.name)).sort((a,b) => b.name.localeCompare(a.name))
  if (dated[0]) return { remotePath: `/${dated[0].name}`, folder: dated[0].name, businessDate: isoDate(dated[0].name) }
  throw new Error(`No Toast export folder found for export ${exportId}. Toast may not have generated the first overnight files yet.`)
}

const runId = id('toast-run')
let filesImported = 0
let rowsImported = 0
let runBusinessDate = null
await supabase.from('toast_import_runs').insert({ id: runId, status: 'running', started_at: new Date().toISOString(), message: dryRun ? 'Dry run started' : 'Scheduled import started' })

try {
  const privateKey = await fs.readFile(process.env.TOAST_PRIVATE_KEY_PATH)
  await sftp.connect({ host: process.env.TOAST_SFTP_HOST, port: Number(process.env.TOAST_SFTP_PORT || 22), username: process.env.TOAST_SFTP_USERNAME, privateKey, readyTimeout: 30000 })
  const folder = await findDateFolder()
  runBusinessDate = folder.businessDate
  const entries = (await sftp.list(folder.remotePath)).filter(item => item.type !== 'd')
  if (!entries.length) throw new Error(`Toast folder ${folder.remotePath} exists but contains no files.`)
  if (!dryRun) await ensureBucket()

  for (const entry of entries) {
    const remoteFile = `${folder.remotePath}/${entry.name}`
    const uniqueKey = `${folder.folder}/${entry.name}`
    const { data: existing } = await supabase.from('toast_import_files').select('id,status').eq('remote_path', remoteFile).maybeSingle()
    if (existing?.status === 'Imported') continue
    const buffer = await sftp.get(remoteFile)
    const rows = parseRows(buffer, entry.name)
    const fileId = existing?.id || id('toast-file')
    if (!dryRun) {
      const upload = await supabase.storage.from(bucket).upload(uniqueKey, buffer, { upsert: true, contentType: entry.name.endsWith('.csv') ? 'text/csv' : 'application/octet-stream' })
      if (upload.error) throw upload.error
      const fileRecord = { id: fileId, run_id: runId, business_date: folder.businessDate, report_type: reportType(entry.name), file_name: entry.name, remote_path: remoteFile, storage_path: uniqueKey, file_size: entry.size || buffer.length, row_count: rows.length, status: 'Imported', imported_at: new Date().toISOString() }
      const upsert = await supabase.from('toast_import_files').upsert(fileRecord, { onConflict: 'remote_path' })
      if (upsert.error) throw upsert.error
      if (rows.length) {
        await supabase.from('toast_import_rows').delete().eq('file_id', fileId)
        for (let start = 0; start < rows.length; start += 500) {
          const payload = rows.slice(start, start + 500).map((row, index) => ({ id: id('toast-row'), file_id: fileId, run_id: runId, business_date: folder.businessDate, report_type: reportType(entry.name), row_number: start + index + 1, data: row }))
          const insert = await supabase.from('toast_import_rows').insert(payload)
          if (insert.error) throw insert.error
        }
      }
    }
    filesImported += 1
    rowsImported += rows.length
    console.log(`${dryRun ? '[dry-run] ' : ''}${entry.name}: ${rows.length} rows`)
  }

  await supabase.from('toast_import_runs').update({ status: 'success', business_date: runBusinessDate, files_imported: filesImported, rows_imported: rowsImported, finished_at: new Date().toISOString(), message: dryRun ? `Dry run found ${filesImported} files and ${rowsImported} rows.` : `Imported ${filesImported} new files and ${rowsImported} rows.` }).eq('id', runId)
} catch (error) {
  console.error(error)
  await supabase.from('toast_import_runs').update({ status: 'failed', business_date: runBusinessDate, files_imported: filesImported, rows_imported: rowsImported, finished_at: new Date().toISOString(), message: error.message }).eq('id', runId)
  process.exitCode = 1
} finally {
  await sftp.end().catch(() => {})
}
