# RestaPay Business Logic Integration - Phase 1

This package starts the business-logic migration without importing any legacy layout, page styling, CSS, navigation, or formatting files.

## Integrated engines
- BusinessEngine
- CategoryEngine
- DateEngine
- DepartmentCostEngine
- InvoiceProductEngine
- PayrollEngine
- ProfitCenterEngine
- ToastLaborEngine
- ToastSalesEngine
- VendorEngine

## Live UI integration
The Payroll page now derives its table values and KPI totals from the migrated PayrollEngine through `src/core/adapters/payrollAdapter.js`.

The migrated payroll rules now calculate:
- original tips
- tips withheld
- tips after withholding
- final payroll amount
- cash payroll total
- check payroll total
- total hours

## Validation
Run:

```powershell
npm run test:core
```

The included core test verifies tips withholding, net tips, final payroll, and cash/check totals.

## Not imported
- Layout.jsx
- old pages
- old CSS
- old navigation
- old cards or tables
- old modals or visual components
