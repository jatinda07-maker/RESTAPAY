# Payroll workflow separation

- **Imported Labor** stores Toast daily/source entries for audit and weekly-building.
- **Ready to Pay** stores weekly Sunday rollups that have not been marked Paid.
- **Payroll History** stores weekly rollups marked Paid.
- **Manual Labor** stores manual entries separately.
- Weekly rollups support Check, Cash, and ACH payment details.
- Deleting a weekly rollup restores its source daily entries for rebuilding.
- Editing opens every payroll field, including hours, pay, tips, withholding, extras, week, group, payment method/status/date, check number, ACH reference, and notes.
- Supabase compatibility is preserved because local workflow-only fields are excluded by `toSupabasePayrollEntry()`.
