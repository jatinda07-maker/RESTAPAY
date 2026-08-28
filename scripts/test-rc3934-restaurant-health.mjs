import fs from 'node:fs'
const dashboard=fs.readFileSync(new URL('../src/pages/Dashboard.jsx',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../src/styles/dashboard.css',import.meta.url),'utf8')
const checks=[
 ['health card component',/function RestaurantHealthCard/],
 ['health card rendered',/<RestaurantHealthCard metrics=\{metrics\}/],
 ['operating margin factor',/Operating Margin/],
 ['prime cost factor',/Prime Cost/],
 ['labor factor',/Labor Mix/],
 ['cash factor',/Cash Position/],
 ['reconciliation factor',/Reconciliation/],
]
for(const [name,re] of checks){if(!re.test(dashboard)) throw new Error(`FAIL ${name}`);console.log(`PASS ${name}`)}
if(!/restaurant-health-card/.test(css)) throw new Error('FAIL health card CSS')
console.log('PASS health card CSS')
console.log('RC3.9.34 restaurant health card regression checks passed.')
