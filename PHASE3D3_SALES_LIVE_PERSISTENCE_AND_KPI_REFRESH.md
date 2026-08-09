# Phase 3D.3 - Sales Live Persistence and KPI Refresh

- Sales Toast import now awaits the Supabase write and performs a read-back verification before reporting success.
- Imported sales automatically set the global Sales date range to the workbook's detected range.
- Toast import preview reconciles report totals against parsed rows and paginates all daily rows.
- Daily Net Sales are identified as exact Toast daily values; report-level category/payment fields are labeled as allocated daily values that reconcile to source totals.
- Dashboard/app data refreshes live collections on mount, focus, and return to the tab so direct Supabase deletions do not linger in cached KPI values.
- Dashboard KPI drawer mappings for Cash Flow, Cash Collected, Cash Remaining, Prime Cost, Labor Mix, Operating Profit, and Business Expenses now use the correct live collection instead of a generic maximum-record fallback.
- Drawer Entries for cash/sales-related KPIs now display live sales rows.
