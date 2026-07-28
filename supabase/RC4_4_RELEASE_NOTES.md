# RESTAPAY RC4.4

- Approved Payroll delete is now permanent and removes the linked payroll entry instead of returning it to Pending.
- Added Clear All Payroll with required CLEAR PAYROLL confirmation.
- Payroll deletion clears Supabase payroll rows and removes browser recovery copies that could restore deleted payroll.
- Cloud payroll tables are authoritative during startup so stale local/app-data snapshots cannot resurrect deleted payroll.
- The current page is remembered across browser refreshes.
- Clicking anywhere in a date field or its label opens the native date picker on every page.
- Approved Payroll totals are compact, responsive, clickable cards that filter the table by payment type.
