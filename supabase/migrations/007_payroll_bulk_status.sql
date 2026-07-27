-- RC4.2: non-destructive payroll bulk payment/status fields.
alter table if exists public.payroll_entries
  add column if not exists approval_status text default 'Approved',
  add column if not exists paid_date date;

create index if not exists idx_payroll_entries_approval_status
  on public.payroll_entries(approval_status);
