# Phase 3D.5 - Dashboard and Reports Reconciliation

- Centralized financial calculations in `FinancialReconciliation.js` so Dashboard, Reports, and KPI drawers use the same formulas.
- Invoice food/alcohol cost classification now preserves the invoice header total, including tax/discount, and no longer drops line-less invoices when other invoices contain line items.
- Cash Remaining now reconciles as Cash Sales - Cash Payroll - Cash-paid Vendor Invoices - Cash Operating Expenses.
- Operating Profit reconciles as Net Sales - Food/Alcohol COGS - Payroll - Operating Expenses.
- Reports now show period-based P&L wording and a reconciliation section with equation variances.
- KPI drawer Cash/Credit entry counts now use daily cash_sales/credit_sales values instead of the generic `payment` field.
- KPI Entries tab displays metric-specific cash/credit records and date-scoped live records.
- Added `npm run test:financial-reconciliation`.
