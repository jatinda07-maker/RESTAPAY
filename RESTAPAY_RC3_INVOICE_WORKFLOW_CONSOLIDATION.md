# RESTAPAY RC3 Invoice Workflow Consolidation

## Included
- Bulk invoice actions: Draft, Approved, Paid, Unpaid/Due, Void, Delete.
- Paid bulk action captures payment date, method, and reference.
- Manual Invoice Number starts blank.
- Smart Invoice Upload Tracker with progress stages, retry, review, and reconciliation state.
- Gemini extraction now requests printed subtotal, net amount, final total, summary discount, and printed line amounts.
- Printed line Amount is authoritative after line-level discount; line discount is not subtracted twice.
- Final printed invoice Total is authoritative when present.
- Total mismatch is flagged as Needs Review instead of silently saving a wrong total.
- Regression case for Alabama Alcoholic Beverage Control SINV-11876641: $1,018.59 reconciled total.

## Validation
- test:rc3-invoice PASS
- test:invoice PASS
- test:invoice-duplicates PASS
- test:rc3 PASS
- test:rc213 PASS
- test:ui PASS
- test:live-release PASS
- npm run build was not available in the extracted environment because node_modules/Vite are not installed; run it in the Windows project.
