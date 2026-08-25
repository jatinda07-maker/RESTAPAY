# RESTAPAY RC3.9.23 — Financial + Security Reconciliation

- One canonical payroll dataset now drives Dashboard/P&L and Food vs Alcohol department costing.
- Weekly rollups supersede their daily source rows for the same employee/pay period.
- Employee Payroll Total is wage-only; customer tip pass-through is excluded from labor expense.
- Cash/check payment totals still preserve tip pass-through for cash reconciliation.
- Food/Alcohol department payroll uses the same canonical wage-only payroll to prevent duplicate labor.
- Native browser role PIN prompts are replaced by a RESTAPAY modal using secure Supabase RPC verification.
