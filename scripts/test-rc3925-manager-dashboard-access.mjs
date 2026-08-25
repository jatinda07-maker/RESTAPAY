import fs from 'node:fs'
const access=fs.readFileSync('src/lib/accessControl.js','utf8')
const settings=fs.readFileSync('src/pages/Settings.jsx','utf8')
const dashboard=fs.readFileSync('src/pages/Dashboard.jsx','utf8')
for(const [name,ok] of [
 ['dashboard permission defaults',access.includes('DEFAULT_MANAGER_DASHBOARD')&&access.includes('operatingProfit:false')&&access.includes('weeklyProfit:false')],
 ['dashboard settings editor',settings.includes('Dashboard Access')&&settings.includes('MANAGER_DASHBOARD_ITEMS')],
 ['dashboard KPI enforcement',dashboard.includes('.filter(([key])=>dashboardAccess[key])')],
 ['department comparison enforcement',dashboard.includes('dashboardAccess.foodAlcoholComparison')],
 ['analytics enforcement',dashboard.includes('dashboardAccess.weeklyProfit')],
 ['recent panels enforcement',dashboard.includes('dashboardAccess.recentPayroll')]
]) { if(!ok) throw new Error('FAIL: '+name); console.log('PASS:',name) }
console.log('RC3.9.25 Manager Dashboard Access checks passed.')
