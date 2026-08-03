# RC4.4.1 Payroll Date Filter Merge

Merged into the latest GitHub source without replacing newer payroll or approved-payroll UI.

## Fix

- Payroll Register rows are filtered by one actual payroll date rather than pay-period overlap.
- Toast payroll uses `pay_date`, `payroll_date`, or `date`.
- Manual/group payroll falls back to `period_start`, then `period_end`.
- Payroll summary cards continue to calculate from the exact filtered register rows.
- Existing Approved Payroll inline status and bulk-edit functionality from the latest source is preserved.
