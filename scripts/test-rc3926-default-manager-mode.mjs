import fs from 'node:fs'

const access = fs.readFileSync(new URL('../src/lib/accessControl.js', import.meta.url), 'utf8')

const checks = [
  ['initial role is manager', access.includes("localStorage.setItem('restapay-current-role','manager')") && access.includes("return 'manager'")],
  ['role sync fallback is manager', access.includes("localStorage.getItem('restapay-current-role')||'manager'")],
  ['Supabase session cannot auto-elevate role', !access.includes("setRole(row.role)") && !access.includes("localStorage.setItem('restapay-current-role',row.role)")],
  ['Admin still requires PIN unlock', access.includes("verifyRolePin('admin',pin)") && access.includes("unlockAdmin")],
  ['Admin lock returns to manager', access.includes("const lockAdmin=()=>applyRole('manager')")],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('RC3.9.26 Default Manager Mode checks passed.')
