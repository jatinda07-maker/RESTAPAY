# RestaPay Engine Integration Phase 2B

Connected the migrated Toast engines to the approved new UI.

## Live engine connections
- Toast Sales Summary CSV/XLSX/XLS parsing through `ToastSalesEngine`
- Toast Labor/Payroll CSV/XLSX/XLS parsing through `ToastLaborEngine`
- Sales category mapping, payment totals, taxes, tips, and daily allocation
- Payroll hours, wages, original tips, 3.5% withholding, and net tips
- Import review uses parsed engine results rather than file placeholders
- Imported records remain in safe local storage; Supabase writes remain disabled
- Re-importing the same source file replaces the matching local import instead of duplicating it

## UI preserved
No old Layout.jsx, pages, CSS, formatting, or styling files were copied.
