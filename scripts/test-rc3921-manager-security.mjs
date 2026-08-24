import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const reports=read('src/pages/Reports.jsx')
const settings=read('src/pages/Settings.jsx')
const access=read('src/lib/accessControl.js')
const shell=read('src/layouts/AppShell.jsx')
const sidebar=read('src/components/Sidebar.jsx')
const topbar=read('src/components/Topbar.jsx')
const migration=read('supabase/migrations/005_restapay_role_pins.sql')
const checks=[
  [reports.includes("managerHiddenSections = new Set(['Period Profit / Loss Analysis','Reconciliation Check'])"),'manager hides P&L and reconciliation report sections'],
  [reports.includes("!access.isManager ? [{ title: 'Period P&L'"),'manager hides Period P&L KPI card'],
  [reports.includes("type!=='Period P&L'"),'manager custom builder hides Period P&L'],
  [reports.includes("!access.isManager&&<div><small>Estimated Profit / Loss"),'manager preview hides profit summary'],
  [settings.includes('Reset Admin PIN') && settings.includes('Reset Manager PIN'),'settings exposes both PIN reset controls'],
  [access.includes("verify_role_pin") && access.includes('unlockManager') && access.includes('setManagerPin'),'access control supports both role PINs'],
  [shell.includes('<RouteAccess><Outlet/></RouteAccess>'),'route access is enforced globally'],
  [sidebar.includes('access.canRoute(to)'),'sidebar hides unauthorized routes'],
  [topbar.includes('switchManager') && topbar.includes('unlockManager'),'manager login requires Manager PIN'],
  [migration.includes('app_role_security') && migration.includes('set_role_pin') && migration.includes('verify_role_pin'),'Supabase role PIN migration included'],
]
let failed=0
for(const [ok,label] of checks){console.log(`${ok?'PASS':'FAIL'} ${label}`); if(!ok) failed++}
if(failed) process.exit(1)
console.log('RC3.9.21 manager report access and role PIN reset regression checks passed.')
