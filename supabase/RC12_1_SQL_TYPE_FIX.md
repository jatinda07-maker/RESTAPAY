# RC12.1 SQL type fix

The prior RC12 SQL used `create table if not exists`. An older partial Toast schema already had UUID primary keys, while the new worker and child tables use text IDs. PostgreSQL therefore rejected the foreign key.

Run `supabase/RESTAPAY_RC12_TOAST_AUTOMATION.sql` again. This corrected script drops only the `toast_*` automation tables and recreates every Toast primary/foreign key as `text`, matching the worker-generated IDs. Existing core RestaPay tables are untouched.
