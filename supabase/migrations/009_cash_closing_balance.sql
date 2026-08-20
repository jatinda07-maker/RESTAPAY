create table if not exists public.cash_ledger (
  id uuid primary key default gen_random_uuid(), entry_date date not null, entry_type text not null,
  amount numeric(12,2) not null default 0, purpose text, notes text, created_by uuid, created_by_email text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists cash_ledger_entry_date_idx on public.cash_ledger(entry_date);
alter table public.cash_ledger enable row level security;
drop policy if exists cash_ledger_authenticated_all on public.cash_ledger;
create policy cash_ledger_authenticated_all on public.cash_ledger for all to authenticated using (true) with check (true);
