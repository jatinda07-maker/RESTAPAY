import fs from 'node:fs'

const vendors = fs.readFileSync(new URL('../src/pages/Vendors.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/styles/records.css', import.meta.url), 'utf8')

const must = (cond, message) => { if (!cond) throw new Error(message) }

must(vendors.includes('vendor-select-row vendor-editable-select-row'), 'Add Vendor editable selects need their own layout class')
must(vendors.includes('aria-label={label}'), 'Vendor selects should expose their label')
must(css.includes('grid-template-columns:20px minmax(0,1fr) 42px'), 'Vendor selector must reserve icon, value, and add-button columns')
must(css.includes('.vendor-select-row.vendor-editable-select-row select'), 'Vendor select needs an explicit visible-value rule')
must(css.includes('color:var(--ink-800)'), 'Vendor select text color must stay visible')

console.log('RC2.9 vendor selector alignment regression passed.')
