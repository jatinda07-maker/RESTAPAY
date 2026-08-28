import fs from 'node:fs'
import assert from 'node:assert/strict'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
const access=read('src/lib/accessControl.js'), settings=read('src/pages/Settings.jsx'), dashboard=read('src/pages/Dashboard.jsx'), store=read('src/data/liveDataStore.js'), vendor=read('src/pages/VendorComparison.jsx'), css=read('src/styles.css')
assert.match(access,/DEFAULT_ADMIN_DASHBOARD/)
assert.match(settings,/Admin Dashboard Cards/)
assert.match(settings,/ADMIN_DASHBOARD_ITEMS/)
assert.match(dashboard,/restapay-admin-dashboard/)
assert.match(store,/restapay-admin-dashboard/)
assert.match(vendor,/Apply to Selected Items/)
assert.match(vendor,/PRICE BOOK CATEGORIES/)
assert.match(css,/professional Price Book category toolbar/)
console.log('RC3.9.32 Admin dashboard customization + Price Book toolbar checks passed.')
