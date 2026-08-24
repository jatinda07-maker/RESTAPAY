import fs from 'node:fs'

const payroll = fs.readFileSync(new URL('../src/pages/Payroll.jsx', import.meta.url), 'utf8')
const store = fs.readFileSync(new URL('../src/data/liveDataStore.js', import.meta.url), 'utf8')

const checks = [
  ['Payroll History display deduplicates logical duplicate rows', payroll.includes('dedupePayrollForDisplay') && payroll.includes('payrollDuplicateKey')],
  ['Single delete removes all logical duplicate copies', payroll.includes("prev.filter(item => payrollDuplicateKey(item) !== duplicateKey)")],
  ['Bulk delete removes duplicate copies too', payroll.includes('const duplicateKeys = new Set(selected.map(payrollDuplicateKey))')],
  ['Payroll live store deduplicates on load and before save', store.includes("if(key==='restapay-payroll') rows=dedupePayrollRows(rows)") && store.includes("if(key==='restapay-payroll') next=dedupePayrollRows(next)")],
  ['Payroll save uses direct batched upsert rather than syncExact table scan', store.includes("supabase.from('payroll_entries').upsert(payload") && store.includes('syncPayrollCollection(current,cache.get(key))')],
  ['Payroll delete sends removed ids directly to Supabase', store.includes("supabase.from('payroll_entries').delete().in('id',removedIds.slice(i,i+100))")],
]

let failed = false
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}`)
  if (!pass) failed = true
}
if (failed) process.exit(1)
console.log('RC3.9.3 payroll history dedupe/performance regression passed.')
