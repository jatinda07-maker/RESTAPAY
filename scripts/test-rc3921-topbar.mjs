import fs from 'node:fs'
const top=fs.readFileSync(new URL('../src/components/Topbar.jsx',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../src/styles/components.css',import.meta.url),'utf8')
for(const [name,ok] of [
 ['profile dropdown state',top.includes('setMenu')&&top.includes('profile-switch-menu')],
 ['role switch controls',top.includes('Switch to Admin')&&top.includes('Switch to Manager')],
 ['notification popover',top.includes('notification-popover')&&top.includes('System is live')],
 ['notification settings route',top.includes("navigate('/settings')")],
 ['outside click close',top.includes("document.addEventListener('mousedown'")],
 ['popover css',css.includes('.notification-popover')&&css.includes('.profile-switch-menu')]
]){if(!ok)throw new Error(`FAIL ${name}`);console.log(`PASS ${name}`)}
console.log('RC3.9.21 topbar regression checks passed.')
