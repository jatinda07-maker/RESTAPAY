# RESTAPAY RC4.5 - Supabase Performance Optimization

## Changes

- Coalesces rapid UI changes into one Supabase save after a 300 ms pause.
- Detects which top-level dataset changed and mirrors only the affected normalized tables.
- Runs independent normalized-table saves in parallel.
- Keeps immediate local recovery storage before cloud synchronization.
- Preserves serialized cloud writes, offline recovery, reconnect behavior, and payroll deletion tombstones.
- Uses exact synchronization for changed business tables so deleted records and invoice lines do not return.
- Continues to maintain `app_data` as the compatibility backup after normalized table writes complete.

## Expected behavior

Normal employee, vendor, payroll, expense, invoice, or settings edits should no longer rewrite every Supabase table. The screen updates immediately, and cloud synchronization completes in the background.

## Validation

- `node --check src/lib/localStore.js` passed.
- `node --check src/lib/useLocalData.js` passed.
- Full Vite build could not be executed in the packaging environment because project dependencies were not installed (`vite: not found`). Run `npm install` and `npm run build` locally before deployment.
