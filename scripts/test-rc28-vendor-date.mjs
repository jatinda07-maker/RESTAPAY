import fs from 'node:fs'
import assert from 'node:assert/strict'
import { normalizeVendorName, vendorSimilarity, dedupeVendorOptions, findVendorDuplicateGroups } from '../src/lib/vendorCleanup.js'

assert.equal(normalizeVendorName(' Alabama Alcoholic Beverage Control '), 'alabama alcoholic beverage control')
assert.equal(vendorSimilarity('ABC Supply LLC', 'ABC Supply'), 0.97)
const cleaned = dedupeVendorOptions([
  { id: '1', name: 'Alabama Alcoholic Beverage Control', is_active: true },
  { id: '2', name: 'alabama alcoholic beverage control', is_active: true },
  { id: '3', name: 'Cintas', is_active: true },
])
assert.equal(cleaned.length, 2)
assert.equal(findVendorDuplicateGroups([{id:'1',name:'ABC Supply LLC'},{id:'2',name:'ABC Supply'}]).length, 1)

const vendors = fs.readFileSync('src/pages/Vendors.jsx','utf8')
assert.match(vendors,/Review Similar Vendors/)
assert.match(vendors,/Merge Into Existing/)
assert.match(vendors,/Override Existing/)
assert.match(vendors,/reassignVendorReferences/)
assert.match(vendors,/reloadLiveCollection\('restapay-vendors'\)/)

const expenses = fs.readFileSync('src/pages/Expenses.jsx','utf8')
assert.match(expenses,/dedupeVendorOptions/)
assert.match(expenses,/reloadLiveCollection\('restapay-vendors'\)/)
const invoices = fs.readFileSync('src/pages/Invoices.jsx','utf8')
assert.match(invoices,/dedupeVendorOptions/)

const shell = fs.readFileSync('src/layouts/AppShell.jsx','utf8')
assert.match(shell,/input\[type="date"\]/)
assert.match(shell,/showPicker/)
assert.match(shell,/onPointerDownCapture=\{openDatePicker\}/)

console.log('RC2.8 vendor cleanup/merge and project-wide date picker regression passed.')
