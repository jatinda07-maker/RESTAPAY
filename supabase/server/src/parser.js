import { parse } from 'csv-parse/sync'

export function parseExportBuffer(buffer, fileName) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '')
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true
  })
  return rows.map((row, index) => ({ row_number: index + 1, payload: row, source_file: fileName }))
}
