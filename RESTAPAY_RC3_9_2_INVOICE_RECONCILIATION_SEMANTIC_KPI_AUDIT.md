# RESTAPAY RC3.9.2 - Invoice Reconciliation + Semantic KPI Audit

Cumulative on RC3.9.1.

## Invoice reconciliation
- Separates printed Product Total from invoice-level charges, tax, and summary discounts/allowances.
- Uses printed final/remit total as authoritative only after validating invoice-summary math.
- Displays Line Items Total, Printed Product Total, Invoice Charges, Tax, Summary Discount, Calculated Invoice Total, and Printed/Final Total separately.
- Blocks saving an AI-extracted invoice while line items do not reconcile to the printed Product Total or invoice-summary math does not reconcile to the printed final total.
- US Foods regression: 3775.54 product + 9.00 fuel + 2.54 tax = 3787.08 final.
- Gemini extraction now explicitly separates fuel surcharge/other charges from product lines and is instructed never to copy package size from a neighboring item.

## KPI/modal semantic corrections
- Total Expenses > By Category now uses real accounting expense categories. Cash/Check/ACH/Credit remain in a separate Payment Methods section.
- Profit Summary now displays Kitchen/BOH Operating Labor, Management Payroll, Front of House Payroll, Operating Expenses, COGS, and excluded Tip Pass-Through separately.
- Profit Summary Entries includes the actual COGS, payroll, and expense source rows.
- Arbitrary Vendor Comparison / Price Increase item titles with attached price history no longer fall into the generic $0 KPI fallback; they receive an item price-intelligence summary.
- Vendor Comparison KPI cards pass their actual comparison rows into the detail drawer.
- Individual Vendor Comparison items expose a visible Check Sam's action in the detail drawer.

## UI
- Smart AI Upload purple emphasis/hover selector is global, so it applies on the actual Invoices page.

## Validation
Run:
- npm run test:rc392
- npm run test:rc391
- npm run test:rc39
- npm run test:rc383
- npm run test:financial-reconciliation
- npm run test:tip-pass-through
- npm run test:ui
- npm run build

The Gemini invoice Edge Function changed and must be redeployed:
- npx supabase functions deploy gemini-invoice
