# RESTAPAY RC6.25 - Payroll Engine Stability

## Fixed

- Removed an infinite recursion between `netTips()` and `originalTips()` when a payroll row had no stored tip fields.
- Restored overtime pay in non-tipped hourly payroll totals.
- Preserved explicit approved `total_pay` / `total` values for manual non-tipped payroll rows.
- Kept tipped payroll totals aligned to the restaurant rule: net customer tips plus approved extra pay.
- Normalized gross tips, withheld tips, net tips, and final payroll aliases consistently.

## Verification

Passed:

- `node scripts/test-payroll-engine.mjs`
- `node scripts/test-actual-costing.mjs`
- `node scripts/audit-project.mjs`

The production Vite build was not regenerated in the container because the dependency registry timed out while reinstalling Linux-compatible packages. Run `npm install` and `npm run build` on the target machine.
