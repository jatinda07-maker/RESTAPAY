import fs from 'node:fs'
import path from 'node:path'

const files=[]
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.(jsx|js)$/.test(ent.name))files.push(p)}}
walk(path.resolve('src'))
const all=files.map(f=>fs.readFileSync(f,'utf8')).join('\n')
const problems=[]
for(const phrase of ['Data connection will be enabled during the engine phase','final calculation engine when connected','logo.clearbit.com']) if(all.includes(phrase)) problems.push(`Obsolete runtime text/dependency remains: ${phrase}`)
for(const [file,key] of [['src/pages/Employees.jsx','restapay-employees'],['src/pages/Vendors.jsx','restapay-vendors'],['src/pages/BankChecks.jsx','restapay-bank-checks']]){
  const t=fs.readFileSync(file,'utf8')
  if(/const\s+seed\s*=/.test(t)) problems.push(`${file} still contains demo seed rows`)
  if(!t.includes(key)) problems.push(`${file} is not wired to ${key}`)
}
const reports=fs.readFileSync('src/pages/Reports.jsx','utf8')
if(/Aug 01|2026-08-01|\$104,342|\$32,310/.test(reports)) problems.push('Reports still contains hard-coded demo date/totals')
const migration=fs.readFileSync('supabase/migrations/002_restapay1_live_extensions.sql','utf8')
if(!migration.includes("'vendor-logos'")) problems.push('Vendor logo storage bucket migration is missing')
if(problems.length){console.error(problems.join('\n'));process.exit(1)}
console.log(`Live release audit passed across ${files.length} source files.`)
