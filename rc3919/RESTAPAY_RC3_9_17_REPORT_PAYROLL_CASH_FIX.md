# RESTAPAY RC3.9.17 — Report Payroll + Cash Reconciliation Fix

This package fixes the active `src/` application used by Vite/Render.

## Fixed

- Payroll report rows are grouped by employee + payroll period instead of showing duplicate daily lines.
- Cash Payment Employees and Employees With Tips are grouped the same way.
- Payroll PDF report data uses the same grouped payroll-period rows.
- Cash Remaining now includes prior-period reconciliation/carry-forward.
- A saved closing cash reconciliation becomes the authoritative carry-forward for the next period.
- Cash Overview shows carry-forward, withdrawals, and current-period cash adjustments.
- Cash Remaining drawer includes Record Cash Withdrawal and Cash Balance Adjustment / Set Closing Balance controls.
- Drawer date controls are compact: preset + start date + end date + Apply stay on one row on desktop.

## Branch

Use `restapay1-root-cleanup`.

## Verify on Windows

```powershell
npm install
npm run build
node scripts/test-rc3917-report-payroll-cash-reconciliation.mjs
```
