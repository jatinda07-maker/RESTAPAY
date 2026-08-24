# RESTAPAY RC3.9.4 - Payroll Delete Synchronization and Payment Precision

## Changes
- Payroll/check payment cents now truncate rather than round. Example: 758.98 - (758.98 * 3.5%) = 732.4157, paid/displayed as 732.41.
- Withholding keeps full internal precision while payment amounts persist at truncated 2-decimal precision.
- Payroll History now separates Undo Paid from permanent delete.
- Undo Paid removes the paid rollup/history state and restores linked source labor to Ready to Pay.
- Admin permanent delete removes the paid payroll row, logical duplicate copies, and linked source_ids from payroll_entries so the record cannot remain in Supabase.
- Deletion remains optimistic in the UI through the live collection update; Supabase failures trigger reload/error recovery.

## Validation
- npm run test:rc394
- npm run test:rc393
- npm run test:payroll-bulk-actions
- npm run test:tip-pass-through
- npm run test:financial-reconciliation
- npm run test:ui
- npm run build
