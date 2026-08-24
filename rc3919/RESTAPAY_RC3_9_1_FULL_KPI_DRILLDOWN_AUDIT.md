# RESTAPAY RC3.9.1 — Full KPI Drilldown Audit

This cumulative hotfix builds on RC3.9 and removes remaining generic KPI-detail fallbacks from the most visible record-driven areas.

## Included
- Vendor Comparison KPI cards now pass their actual normalized price-history rows into DetailDrawer.
- Individual Vendor Comparison item rows open their own real item price history instead of the generic KPI fallback.
- Best Vendor Matches and Invoice Lines have explicit entry resolvers.
- Total Vendors, Inventory Vendors, Expense Vendors, and Vendor Spend carry source records into drilldowns.
- Invoice Total, Food Invoices, Alcohol Invoices, and Open Balance carry exact selected-period invoice records.
- Bank & Checks Total Payments, Cleared, Pending, and Entries carry exact selected-period transactions.
- Price Increase cards carry the exact price-history rows used to calculate each KPI.
- Import Center, Toast Integration, and Settings KPI cards no longer fall into the generic $0 / no calculation mapping.
- Existing RC3.9 vendor price memory, normalized quantity comparison, and Sam's Club benchmark action are preserved.

## Validation
- `npm run test:rc391`
- `npm run test:rc39`
- `npm run test:rc383`
- `npm run test:ui`
- `npm run build` should be run on the Windows project with dependencies installed.
