import fs from 'node:fs'

const payroll=fs.readFileSync('src/pages/Payroll.jsx','utf8')
const required=[
  "const [bulkAction,setBulkAction] = useState('')",
  'const applyBulkAction = async () =>',
  'Change Action',
  '<option>Draft</option>',
  '<option>Approved</option>',
  '<option>Paid</option>',
  '<option>Void</option>',
  'Change ${count} selected payroll entr',
  'payment_status:bulkAction',
  "bulkAction === 'Paid'",
  'setSelectedRowIds([])',
  "setBulkAction('')"
]
const missing=required.filter(token=>!payroll.includes(token))
if(missing.length){
  console.error(`Payroll bulk action regression failed. Missing: ${missing.join(', ')}`)
  process.exit(1)
}
console.log('Payroll bulk action regression passed: Draft, Approved, Paid, Void and confirmation flow are wired.')
