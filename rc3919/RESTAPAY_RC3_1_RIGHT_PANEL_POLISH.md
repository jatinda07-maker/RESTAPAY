# RESTAPAY RC3.1 - Right Panel Visual Polish + Expense Types

## Included
- Right-content-only semantic color system; left navigation is unchanged.
- Invoice status filter boxes with counts and status-specific colors.
- Direct invoice bulk buttons for Draft, Approved, Paid, Unpaid/Due, Void, and Delete.
- Color-coded invoice category text and reusable status-pill styling.
- Shared semantic action-button styles for data-heavy pages where status actions are used.
- Small readability increase for table/data rows and monetary values without changing titles, navigation, labels, or form controls.
- Expanded A-Z Expense Type defaults including Payroll Tax, Sales Tax, Business License, Alcohol License / Liquor License, Bank Charges, Service Charges, and related operating expense classifications.
- Case-insensitive custom Expense Type duplicate prevention.
- Preserves RC3 invoice tracker/reconciliation, invoice bulk persistence, payroll job fallback, and optimistic payroll UI behavior.

## Validation
- npm run test:rc31
- npm run test:rc3-invoice
- npm run test:rc3
- npm run test:ui

Production build must be run in the Windows project with node_modules installed.
