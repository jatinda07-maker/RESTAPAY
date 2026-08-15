import fs from 'node:fs'

const payroll = fs.readFileSync(new URL('../src/pages/Payroll.jsx', import.meta.url), 'utf8')
const liveStore = fs.readFileSync(new URL('../src/data/liveDataStore.js', import.meta.url), 'utf8')

const checks = [
  ['employee job fallback resolver exists', /const resolveEmployeeJob = row =>/],
  ['job fallback uses employee id', /employeeById\.get\(String\(row\?\.employee_id/],
  ['job fallback uses employee name', /employeeByName\.get\(String\(row\?\.employee_name/],
  ['missing jobs become Unassigned', /'Unassigned'/],
  ['imported rows are enriched with employee job', /importedRows[\s\S]*?\.map\(enrichPayrollRow\)/],
  ['ready rows are enriched with employee job', /readyRows[\s\S]*?\.map\(enrichPayrollRow\)/],
  ['paid history rows are enriched with employee job', /paidRows[\s\S]*?\.map\(enrichPayrollRow\)/],
  ['manual save switches UI before Supabase await', /const persistPromise = setSourceRows[\s\S]*?setActiveTab[\s\S]*?setManual\(false\)[\s\S]*?await persistPromise/],
  ['payment status switches UI before Supabase await', /const persistPromise = setSourceRows[\s\S]*?setPaymentOpen\(false\)[\s\S]*?setActiveTab\(targetTab\)[\s\S]*?await persistPromise/],
  ['tip withholding is exact 3.5 percent', /tips\s*\*\s*0\.035/],
  ['live persistence uses optimistic cache emit', /cache\.set\(key,Array\.isArray\(next\)\?next:\[\]\);emit\(key\)/],
]

let failed = false
for (const [name, pattern] of checks) {
  if (!pattern.test(name.includes('live persistence') ? liveStore : payroll)) {
    console.error(`FAIL: ${name}`)
    failed = true
  }
}
if (failed) process.exit(1)
console.log('RC3 production-readiness regression passed: employee job fallback, optimistic payroll UI, 3.5% tips, and live persistence are wired.')
