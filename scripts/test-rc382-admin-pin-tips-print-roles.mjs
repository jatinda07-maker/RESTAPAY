import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const reports=read('src/pages/Reports.jsx'), settings=read('src/pages/Settings.jsx'), topbar=read('src/components/Topbar.jsx'), access=read('src/lib/accessControl.js'), store=read('src/data/liveDataStore.js'), migration=read('supabase/migrations/004_restapay_admin_pin.sql')
const checks=[
 ['report tips accepts original_tips',reports.includes('r.original_tips')],
 ['print opens writable about blank',reports.includes("window.open('about:blank','_blank')")],
 ['six standardized labor roles',settings.includes("['Kitchen','Waiter','Manager','Bartender','Busser','Dishwasher']")],
 ['admin pin settings',settings.includes('Set / Change Admin PIN')],
 ['profile admin switch',topbar.includes('Switch to Admin')&&topbar.includes('Lock Admin Mode')],
 ['pin rpc verify',access.includes("supabase.rpc('verify_admin_pin'")],
 ['server normalized to waiter',store.includes("/^(server|waitress)$/i")],
 ['pin hashed in postgres',migration.includes("crypt(new_pin,gen_salt('bf'))")]
]
let failed=0;for(const[c,ok]of checks){console.log(`${ok?'PASS':'FAIL'} ${c}`);if(!ok)failed++}if(failed)process.exit(1)
