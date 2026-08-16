# RESTAPAY RC3.8.3 — Admin Navigation + Report Subtotals

This cumulative hotfix is based on RC3.8.2 and includes:

- Fixes role synchronization between Topbar, Sidebar, and route guards so switching Manager -> Admin immediately restores the full Admin navigation after successful PIN verification.
- Keeps Manager navigation restricted without trapping the user in Manager mode.
- Adds a subtotal/footer row to every grouped section in the Custom Restaurant Report.
- Adds detailed monetary subtotals for Cash Payment Employees and Employees With Tips.
- Changes Employees With Tips summary to show Payroll Tips Total (original employee tips) instead of emphasizing entry count.
- Includes section subtotals in on-screen reports, Print/PDF output, and CSV/Excel export.
- Carries forward the corrected Supabase pgcrypto Admin PIN migration using the extensions schema.

Validation scripts:

- `npm run test:rc383`
- `npm run test:rc382`
- `npm run test:rc381`
- `npm run test:ui`
- `npm run build`
