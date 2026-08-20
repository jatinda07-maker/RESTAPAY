# RESTAPAY RC3.9.15 — Reports, Cash, Security & Cost Repair

- Restores Cash Remaining > Cash Balance Adjustment with Supabase-backed closing balance records.
- Supports 08/09/2026 physical closing cash of $203 as a closing balance, not a cash-in/out transaction.
- Carries the prior reconciled closing cash into the next selected period as opening cash.
- Removes Reconciliation Check from the Custom Restaurant Report/PDF.
- Combines tipped payroll report rows to one row per employee for the selected period.
- P&L excludes waiter/server tip pass-through and separates manager payroll from employee labor; manager payroll is counted once inside Food + Alcohol cost.
- Improves food/alcohol invoice classification using line descriptions/item/vendor text.
- Repairs Reports KPI drawers for Period P&L, Sales, Payroll and Expenses.
- Repairs top-right profile menu interaction.
- Replaces placeholder Users & Security Edit buttons with real security modals.
- Administrator password uses Supabase Auth; Manager reset uses the admin-reset-password Edge Function.
- Paid manager Check payroll creates a matching Bank & Checks entry when one does not already exist.

## Deploy
Run migration 009_cash_closing_balance.sql and deploy admin-reset-password.
