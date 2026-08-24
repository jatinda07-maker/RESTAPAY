# RESTAPAY RC3.9.19 — Reports Payroll Deduplication

Scope: Reports only. Payroll page and Supabase records are not modified.

- Reports ignore daily source payroll rows already marked `payroll_status: rolled-up`.
- If a weekly rollup exists for an employee/payroll period, Reports use that canonical rollup instead of also summing the imported daily source rows.
- Duplicate weekly rollups for the same employee/payroll period are reduced to one preferred record, favoring Paid/Approved weekly rollups.
- Custom report preview and PDF Payroll Detail use the same canonical grouped dataset.
