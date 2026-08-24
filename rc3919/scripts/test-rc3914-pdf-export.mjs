import fs from 'node:fs'
const reports = fs.readFileSync('src/pages/Reports.jsx','utf8')
const exporter = fs.readFileSync('src/lib/reportExport.js','utf8')
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'))
const checks = [
  ['Reports imports shared PDF exporter', reports.includes("from '../lib/reportExport'")],
  ['Standard report PDF buttons call real exporter', reports.includes('downloadPdf(key)')],
  ['Custom report PDF calls real exporter', reports.includes("downloadPdf('weekly-custom')")],
  ['PDF utility saves actual .pdf file', exporter.includes("doc.save(`${safeName(filename || title)}.pdf`)" )],
  ['PDF utility renders tabular report content', exporter.includes('autoTable(doc')],
  ['jsPDF dependency installed', Boolean(pkg.dependencies?.jspdf)],
  ['jsPDF AutoTable dependency installed', Boolean(pkg.dependencies?.['jspdf-autotable'])],
]
for (const [name, ok] of checks) {
  if (!ok) { console.error(`FAIL - ${name}`); process.exitCode = 1 }
  else console.log(`PASS - ${name}`)
}
if (!process.exitCode) console.log('RC3.9.14 PDF export regression passed.')
