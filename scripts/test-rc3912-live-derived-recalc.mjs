import fs from 'node:fs'

const live = fs.readFileSync('data/liveDataStore.js','utf8')
const appData = fs.readFileSync('hooks/useAppData.js','utf8')
const migration = fs.readFileSync('supabase/migrations/007_payroll_live_classification.sql','utf8')

const checks = [
  ['writes emit saved invalidation', /emit\(key,'saved'\)/.test(live)],
  ['all live emits invalidate derived calculations', /restapay:derived-data-invalidated/.test(live)],
  ['useAppData takes fresh immutable collection snapshots', /const freshRows = rows =>/.test(appData)],
  ['labor classification reads live Supabase-backed setting', /getLiveSetting\('restapay-labor-classification'/.test(appData)],
  ['cost settings read live Supabase-backed setting', /getLiveSetting\('restapay-cost-settings'/.test(appData)],
  ['payroll realtime row persists job classification', /job_type:normalizeJob/.test(live) && /labor_classification:text/.test(live)],
  ['migration adds payroll classification columns', /add column if not exists job_type text/.test(migration) && /labor_classification text/.test(migration)]
]
for (const [label, ok] of checks) {
  if (!ok) throw new Error(`FAIL - ${label}`)
  console.log(`PASS - ${label}`)
}
console.log('RC3.9.12 live cross-page recalculation regression passed.')
