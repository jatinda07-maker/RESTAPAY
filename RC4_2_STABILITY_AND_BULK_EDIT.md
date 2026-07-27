# RC4.2 Stability and Approved Payroll Bulk Edit

Implemented:
- Approved Payroll / All Payroll bulk edit for payment method, status, check number, and paid date.
- Non-destructive normalized-table upserts (no whole-table wipe before save).
- Startup safe merge of cloud and local records so unsynced local records are retained.
- Automatic retry on online, browser focus, tab visibility, and every 60 seconds.
- Expense recovery scans current, legacy, and pending browser backups and restores only missing records after confirmation.
- Clear expense recovery totals and messages.
- Current navigation page persists across browser refresh.
- Current Payroll tab persists across browser refresh in the same session.
- Optional payroll approval_status and paid_date schema migration.

Database migration (recommended before using bulk status across devices):
Run `supabase/migrations/007_payroll_bulk_status.sql` in Supabase SQL Editor.

Safety:
- Existing records are never deleted during a normal cloud save.
- Browser backup is written before/alongside cloud save.
- Existing expense records are not overwritten by recovery.
