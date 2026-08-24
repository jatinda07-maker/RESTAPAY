# RESTAPAY RC3.9.9 - Always-Connected Supabase Sync

## Purpose
Replace page-by-page reload behavior with one persistent application-level Supabase connection so data remains synchronized while navigating RESTAPAY.

## Changes
- Persistent Supabase Realtime channel starts once at application bootstrap.
- Realtime INSERT/UPDATE/DELETE events merge directly into the shared live cache.
- Payroll realtime changes reuse payroll deduplication before updating the UI.
- Invoice header/item realtime changes trigger a debounced invoice refresh to preserve header/item joins.
- Normal collection saves use changed-row upserts and deleted-row deletes rather than whole-table scans.
- Payroll keeps its dedicated batched row-level save/delete path.
- Optimistic UI remains authoritative while the Supabase request is in flight.
- Failed writes roll back only the affected collection to its prior in-memory state rather than reloading every page/table.
- Page navigation no longer forces all collections to reload.
- Focus/visibility reconciliation remains as a throttled safety check (maximum once per minute).
- Top bar exposes Live / Saving... / Saved / Sync Error state.

## Validation
Run:

npm run test:rc399
npm run test:rc398
npm run test:rc397
npm run test:rc396
npm run test:rc395
npm run test:rc394
npm run test:rc392
npm run test:invoice
npm run test:payroll-bulk-actions
npm run test:tip-pass-through
npm run test:financial-reconciliation
npm run test:ui
npm run build

The regression suite passed in packaging. The production build could not execute in the packaging Linux environment because the uploaded node_modules contains a Windows-native Rolldown dependency; run npm install/npm run build on the target Windows machine.
