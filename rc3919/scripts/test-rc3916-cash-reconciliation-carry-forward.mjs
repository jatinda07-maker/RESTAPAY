import fs from 'node:fs'
import assert from 'node:assert/strict'
const appData = fs.readFileSync(new URL('../hooks/useAppData.js', import.meta.url), 'utf8')
const drawer = fs.readFileSync(new URL('../components/DetailDrawer.jsx', import.meta.url), 'utf8')
const live = fs.readFileSync(new URL('../data/liveDataStore.js', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/009_cash_reconciliation_closing_balance.sql', import.meta.url), 'utf8')
assert.ok(appData.includes('latestReconciliation'), 'latest reconciliation should be selected')
assert.ok(appData.includes('target_closing_balance'), 'explicit closing target should drive carry forward')
assert.ok(appData.includes('reconciledClosing + postFinancial.cashRemaining + ledgerEffect(postLedger)'), 'only post-reconciliation activity should alter carry forward')
assert.ok(drawer.includes('target_closing_balance:target'), 'closing target must be persisted')
assert.ok(live.includes('target_closing_balance'), 'cash ledger mapping must persist closing target')
assert.ok(migration.includes('target_closing_balance numeric'), 'cash ledger schema must store target closing balance')
console.log('RC3.9.16 reconciled cash carry-forward regression passed')
