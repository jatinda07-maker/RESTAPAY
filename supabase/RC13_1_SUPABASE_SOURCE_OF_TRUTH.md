# RC13.1 Supabase Source of Truth

- Normalized Supabase tables are authoritative even when empty.
- Legacy `app_data` can no longer repopulate deleted invoices or expenses.
- Cloud save writes normalized tables before the `app_data` backup.
- Cost drilldowns display the originating Supabase table (`invoices`, `invoice_items`, or `expenses`).
- This makes entries such as BANK OF AMERICA traceable and prevents local-only stale data from appearing as cloud data.
