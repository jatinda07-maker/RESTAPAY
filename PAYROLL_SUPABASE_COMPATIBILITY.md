# Payroll Supabase Compatibility

The current UI now uses the existing `payroll_entries` field contract from the previous RestaPay project.

Database fields preserved:

- id
- employee_id
- employee_name
- source
- pay_type
- method
- check_number
- payroll_date
- hours
- regular_pay
- tips_after_withheld
- tips_withheld
- extra_pay
- extra_reason
- total
- group_id
- group_name
- created_at
- updated_at

Local-only weekly-builder metadata (`weekly_rollup`, `payroll_week_start`, `payroll_week_end`, `source_ids`, etc.) remains available in local mode but is stripped by `toSupabasePayrollEntry()` before future database writes.

Toast summary reports without daily dates are expanded across the detected report period so employees appear in the Monday-Sunday weekly payroll builder.
