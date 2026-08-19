# RESTAPAY RC3.9.13 - Invoice Terms, Reconciliation, and Vendor Price Book

- Invoice extraction now prioritizes explicitly labeled INVOICE DATE and keeps ordered/shipped dates separate.
- Added payment terms including Net 14 and automatic due-date calculation.
- Gemini extraction now returns payment terms and printed due/remit date.
- Summary discounts/credits are treated as invoice-level credits and subtracted once.
- Line-item variance is advisory; final summary reconciliation is independently validated.
- Vendor Comparison now includes Price Book and Daily Best Price views.
- Price memory covers food, alcohol, supplies, cleaning, kitchen goods, and other invoice items.
- Conservative AI-similar matching groups comparable vendor descriptions only when normalized basis is compatible.
- Daily Best Price report supports configurable minimum dollar/percent savings thresholds.
- Existing Sam's Club benchmark checks remain available and separate from invoice-vendor history.
