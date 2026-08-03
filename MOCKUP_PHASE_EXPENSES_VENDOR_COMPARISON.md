# RESTAPAY V2 Mockup Phase - Expenses, Vendor Comparison, Popups

Updated:
- src/pages-v2/ExpensesV2.jsx
- src/pages-v2/VendorComparisonV2.jsx
- src/styles-v2/app.css

Verified by source audit:
- ExpensesV2 no longer imports or renders LegacyExpenses.
- VendorComparisonV2 no longer imports or renders LegacyVendorComparison.
- DashboardV2.jsx was not modified.
- AppShellV2.jsx and the left navigation were not modified.
- Add/Edit Expense uses the approved compact modal pattern.
- Vendor price history uses the approved compact modal pattern.
- V2 form modals now keep header/footer visible and scroll only the form body.
- Existing invoice/vendor/employee V2 modals inherit the popup sizing correction.

Build note:
- Production build could not run in this container because Vite is not installed in the available node_modules and package installation is unavailable here.
- Run `npm install` and `npm run build` locally before merging.
