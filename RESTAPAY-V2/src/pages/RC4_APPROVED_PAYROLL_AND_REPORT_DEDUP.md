# RC4 Approved Payroll and Report Deduplication

Changes in this build:
- Added Approved Payroll navigation and page.
- Approve Payroll now snapshots pending payroll rows into an approved ledger.
- Original calculated amount is retained separately from editable approved amount.
- Approved amount, payment type, check number, status, paid date, and notes are editable.
- The same source payroll row cannot be approved twice.
- Standard Sales, Payroll, Cash Payroll, Check Payroll, and Invoice reports now remove exact duplicate source records before totaling/exporting.
- Approved payroll is stored in the Supabase app_data backup state; no database migration is required for this build.

Validation note:
- Source changes were completed successfully.
- The Linux validation environment could not run Vite because the uploaded Windows node_modules omitted Rollup's Linux optional native package. On Windows, run `npm install` and then `npm run build`.
