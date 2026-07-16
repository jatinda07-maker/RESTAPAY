import crypto from 'node:crypto'
import path from 'node:path'
import { supabaseAdmin } from './supabaseAdmin.js'
import { withSftp } from './toastSftp.js'
import { candidateExportPaths } from './datePaths.js'
import { classifyToastFile } from './fileClassifier.js'
import { parseExportBuffer } from './parser.js'
import { config } from './config.js'

function checksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

async function createRun() {
  const { data, error } = await supabaseAdmin.from('toast_sync_runs').insert({ status: 'running', started_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}

async function finishRun(id, values) {
  const { error } = await supabaseAdmin.from('toast_sync_runs').update({ ...values, completed_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

async function alreadyImported(hash) {
  const { data, error } = await supabaseAdmin.from('toast_import_files').select('id').eq('checksum', hash).maybeSingle()
  if (error) throw error
  return Boolean(data)
}

async function persistFile({ remotePath, fileName, buffer, reportType, rows }) {
  const hash = checksum(buffer)
  if (await alreadyImported(hash)) return { duplicate: true, rows: 0 }

  const { data: fileRecord, error: fileError } = await supabaseAdmin.from('toast_import_files').insert({
    export_id: config.toast.exportId,
    remote_path: remotePath,
    file_name: fileName,
    report_type: reportType,
    checksum: hash,
    row_count: rows.length,
    imported_at: new Date().toISOString(),
    status: 'imported'
  }).select().single()
  if (fileError) throw fileError

  const batches = []
  for (let i = 0; i < rows.length; i += 500) {
    batches.push(rows.slice(i, i + 500).map(row => ({
      import_file_id: fileRecord.id,
      report_type: reportType,
      row_number: row.row_number,
      payload: row.payload
    })))
  }
  for (const batch of batches) {
    const { error } = await supabaseAdmin.from('toast_import_rows').insert(batch)
    if (error) throw error
  }
  return { duplicate: false, rows: rows.length }
}

export async function syncToastExports() {
  const run = await createRun()
  let filesFound = 0
  let filesImported = 0
  let rowsImported = 0
  const messages = []

  try {
    await withSftp(async client => {
      let locatedAnyDirectory = false
      for (const directory of candidateExportPaths()) {
        let entries
        try {
          entries = await client.list(directory)
          locatedAnyDirectory = true
        } catch {
          continue
        }
        const files = entries.filter(entry => entry.type !== 'd' && /\.(csv|txt)$/i.test(entry.name))
        filesFound += files.length
        for (const file of files) {
          const remotePath = path.posix.join(directory, file.name)
          const buffer = await client.get(remotePath)
          const reportType = classifyToastFile(file.name)
          const rows = parseExportBuffer(buffer, file.name)
          const result = await persistFile({ remotePath, fileName: file.name, buffer, reportType, rows })
          if (!result.duplicate) {
            filesImported += 1
            rowsImported += result.rows
          }
        }
      }
      if (!locatedAnyDirectory) messages.push('Connected successfully, but no dated export directory is available yet.')
      else if (!filesFound) messages.push('Export directory found, but no CSV or TXT files were available.')
    })

    const message = messages.join(' ') || `Imported ${filesImported} new file(s) and ${rowsImported} row(s).`
    await finishRun(run.id, { status: 'success', files_found: filesFound, files_imported: filesImported, rows_imported: rowsImported, message })
    return { ok: true, message, filesFound, filesImported, rowsImported }
  } catch (error) {
    await finishRun(run.id, { status: 'failed', files_found: filesFound, files_imported: filesImported, rows_imported: rowsImported, message: error.message }).catch(() => {})
    throw error
  }
}
