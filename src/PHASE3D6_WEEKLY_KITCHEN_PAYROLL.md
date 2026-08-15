# Phase 3D.6 — Weekly Kitchen Payroll

- Added a dedicated Build Weekly Kitchen Payroll workflow.
- Kitchen payroll uses a Monday-through-Sunday date range and dates each payroll row on Sunday.
- Uses active employees from Supabase and saved employee Base Pay/default payment method.
- Supports saved Kitchen payroll groups or all active kitchen staff.
- Employees can be selected individually before payroll is created.
- Kitchen weekly payroll saves to the same live payroll_entries collection and moves to Ready to Pay.
- Server/Toast weekly payroll and Kitchen weekly payroll can coexist for the same week without overwriting each other.
- Fixed payroll week_start/week_end mapping to Supabase so weekly ranges persist after refresh.
- Added test:kitchen-weekly-payroll.

## Phase 3D.6 — Bulk Payroll Actions

- Payroll row checkboxes now support bulk status/action changes.
- Select individual rows or Select All visible rows.
- Bulk `Change Action` supports Draft, Approved, Paid, and Void.
- Applying a bulk action requires confirmation with the selected record count.
- Marking records Paid preserves an existing payment date or stamps today's date, then moves the view to Payroll History.
- Existing single-row View, Edit, Pay, Duplicate, and Delete actions remain available.
- Added `test:payroll-bulk-actions` regression coverage.
