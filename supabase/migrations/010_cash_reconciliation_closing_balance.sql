alter table if exists public.cash_ledger
  add column if not exists target_closing_balance numeric;

comment on column public.cash_ledger.target_closing_balance is
  'Authoritative physical closing cash entered during cash reconciliation. This is a balance, not revenue or expense.';
