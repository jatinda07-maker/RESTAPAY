RESTAPAY UNIVERSAL UI REBUILD

This package activates one stylesheet only:
  src/styles/universal.css

Removed from the active project:
  src/styles.css
  src/pages/Dashboard.css
  src/styles/design-system.css
  src/styles/universal-ui.css
  src/styles/dashboard-v4.css
  src/styles/ui-v5.css

Major changes:
- White navigation remains isolated and locked.
- Dashboard uses four compact KPI cards per row on wide desktop screens.
- Dashboard cards use lighter solid pastel backgrounds and lighter typography.
- Date controls and buttons use one synchronized 40px control height.
- Dashboard detail popups use one compact professional reconciliation layout.
- Sales upload actions, date controls, KPI totals, filters, and tables are aligned.
- Cost Analysis, Vendors, Invoices, Employees, Payroll, Expenses, and Reports receive synchronized grids, forms, tables, spacing, and controls.
- Duplicate visual overrides and page-level Dashboard CSS imports were removed.
- Business calculations, imports, Supabase logic, and data handling were not intentionally changed.

Run APPLY_BUILD_PUSH.ps1 from the extracted package.
