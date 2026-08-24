import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const access=read('src/lib/accessControl.js')
const invoice=read('src/pages/Invoices.jsx')
const drawer=read('src/components/DetailDrawer.jsx')
const store=read('src/data/liveDataStore.js')
const payroll=read('src/core/adapters/payrollAdapter.js')
const migration=read('supabase/migrations/003_restapay_roles_approvals_cash_ledger.sql')
const checks=[
  ['manager route restrictions',access.includes("'/reports','/sales','/import-center','/invoices'")],
  ['manager edit requires approval',invoice.includes('submitted for Admin approval')&&invoice.includes('restapay-invoice-approvals')],
  ['admin approval queue',invoice.includes('Admin Approval Queue')&&invoice.includes('approveRequest')&&invoice.includes('rejectRequest')],
  ['cash ledger live collection',store.includes("'restapay-cash-ledger'")],
  ['cash withdrawal edit/delete',drawer.includes('Edit Cash Withdrawal')&&drawer.includes('Cash Withdrawal History')&&drawer.includes('deleteCashEntry')],
  ['cash balance adjustment',drawer.includes('Set Closing Balance')&&drawer.includes('Cash balance reconciliation')],
  ['manager separate from BOH',payroll.includes("return 'management'")],
  ['busser classified BOH',/dishwasher\|dish washer\|busser/.test(payroll)],
  ['supabase migration',migration.includes('invoice_edit_requests')&&migration.includes('cash_ledger')&&migration.includes('app_user_roles')],
]
let failed=false
for(const [name,ok] of checks){console.log(`${ok?'✅':'❌'} ${name}`);if(!ok)failed=true}
if(failed)process.exit(1)
console.log('RC3.8 access/cash/approval regression passed')
