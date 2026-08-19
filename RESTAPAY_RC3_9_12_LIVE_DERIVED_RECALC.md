# RESTAPAY RC3.9.12 — Live Derived Recalculation

- Every Supabase collection write emits an immediate derived-data invalidation event.
- `useAppData` now consumes fresh immutable snapshots so Food Cost, Alcohol Cost, P&L, Reports, Dashboard and KPI calculations recompute immediately after payroll/invoice/expense/sales changes.
- Cost allocation and labor classification use the Supabase-backed live settings cache instead of stale localStorage copies.
- Payroll entries persist `job_type`, `labor_classification`, and `department` so manager allocation can classify realtime/manual payroll rows immediately.
- Migration `007_payroll_live_classification.sql` adds those classification fields to `payroll_entries`.
