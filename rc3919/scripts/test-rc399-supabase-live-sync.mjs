import fs from 'node:fs'
const store=fs.readFileSync('src/data/liveDataStore.js','utf8')
const hook=fs.readFileSync('src/hooks/useAppData.js','utf8')
const main=fs.readFileSync('src/main.jsx','utf8')
const top=fs.readFileSync('src/components/Topbar.jsx','utf8')
const checks=[
  ['Realtime channel exists',/supabase\.channel\('restapay-live-data'/.test(store)],
  ['Payroll realtime changes merge into shared cache',/mergeRealtimeRow\(key,payload\)/.test(store)&&/dedupePayrollRows\(next\)/.test(store)],
  ['Generic mutations use row diff not syncExact full scan',/await syncRowDiff\(key,current,cache\.get\(key\)\)/.test(store)],
  ['Optimistic rollback restores prior cache on failure',/cache\.set\(key,current\);emit\(key,'rollback'\)/.test(store)],
  ['App connects once at startup',/connectLiveData\(\)\.catch/.test(main)],
  ['Page hook no longer reloads every collection on every mount',!hook.includes("liveKeys=['restapay.sales'")&&!hook.includes('Promise.allSettled(liveKeys.map')],
  ['Visibility/focus reconciliation is throttled',/reconcileLiveData\(\)/.test(hook)&&/currentTime-lastReconcileAt<60000/.test(store)],
  ['Sync UI includes Saving and Sync Error states',top.includes('Saving…')&&top.includes('Sync Error')],
]
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} - ${name}`);if(!ok)process.exitCode=1}
if(!process.exitCode)console.log('RC3.9.9 Supabase always-connected live sync regression passed.')
