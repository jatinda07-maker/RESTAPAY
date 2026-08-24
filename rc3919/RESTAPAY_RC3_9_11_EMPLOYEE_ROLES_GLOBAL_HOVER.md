# RESTAPAY RC3.9.11 — Employee Roles + Global Button Hover

## Included
- Canonical employee job normalization: legacy Server / Waitress / Front House / FOH values display as Waiter.
- Employee management separates Job from Department / Classification.
- Labor Classification settings now include Manage Employees / Add Employee actions per role.
- Employees page accepts job-scoped navigation from Settings.
- Payroll resolves legacy Front House job labels through the same canonical job helper.
- Global hover / press feedback for primary, secondary, danger, row-action and status buttons.
- Existing effective-dated pay rates and Supabase live sync are preserved.

## Data safety
No migration is required. The canonical job conversion is applied through the existing employee/payroll Supabase mapping and when employee profiles are explicitly saved. Historical payroll monetary values are not rewritten.
