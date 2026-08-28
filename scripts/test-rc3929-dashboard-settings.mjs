import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const dash=read('src/pages/Dashboard.jsx');
const settings=read('src/pages/Settings.jsx');
const access=read('src/lib/accessControl.js');
const store=read('src/data/liveDataStore.js');
const drawer=read('src/components/DetailDrawer.jsx');
const checks=[
 ['Prime Cost restored',dash.includes("'Prime Cost'")],
 ['Operating Profit restored',dash.includes("'Operating Profit'")],
 ['Alcohol Cost restored',dash.includes("'Alcohol Cost'")],
 ['Manager payroll card',dash.includes("'Manager / GM & Other Payroll'")],
 ['Kitchen payroll card',dash.includes("'Kitchen Payroll'")],
 ['Tips check card',dash.includes("'Tips Check - Tipped Waiters'")],
 ['Generic payroll card removed from dashboard',!dash.includes("'Payroll Total',appMoney(metrics.payrollTotal)")],
 ['Cost settings live key',store.includes("'restapay-cost-settings'") && store.includes("app_settings")],
 ['Save button confirms Supabase',settings.includes('Settings saved to Supabase.')],
 ['Admin persistence',access.includes("saved==='admin'?'admin'")],
 ['Payroll drilldowns added',drawer.includes("'Manager / GM & Other Payroll'") && drawer.includes("'Tips Check - Tipped Waiters'")],
];
let failed=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'}: ${name}`); if(!ok)failed++;}
if(failed){process.exitCode=1}else console.log('RC3.9.29 Dashboard + Supabase settings checks passed.');
