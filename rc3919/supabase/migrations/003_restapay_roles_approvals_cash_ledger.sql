-- RC3.8: role access, invoice edit approval queue and persistent cash ledger.
create table if not exists public.app_user_roles (
  user_id uuid primary key,
  email text,
  role text not null default 'manager' check (role in ('admin','manager','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_edit_requests (
  id text primary key,
  invoice_id text not null,
  requested_by uuid,
  requested_by_email text,
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  original_invoice jsonb not null default '{}'::jsonb,
  proposed_invoice jsonb not null default '{}'::jsonb,
  decision_notes text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cash_ledger (
  id text primary key,
  entry_date date not null,
  entry_type text not null check (entry_type in ('withdrawal','adjustment')),
  amount numeric not null default 0,
  purpose text,
  notes text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_user_roles enable row level security;
alter table public.invoice_edit_requests enable row level security;
alter table public.cash_ledger enable row level security;

-- Current app still supports anon deployment; app-layer permissions are enforced in addition.
drop policy if exists "restapay app roles read" on public.app_user_roles;
create policy "restapay app roles read" on public.app_user_roles for select to anon, authenticated using (true);
drop policy if exists "restapay app roles write" on public.app_user_roles;
create policy "restapay app roles write" on public.app_user_roles for all to authenticated using (true) with check (true);

drop policy if exists "restapay invoice approvals all" on public.invoice_edit_requests;
create policy "restapay invoice approvals all" on public.invoice_edit_requests for all to anon, authenticated using (true) with check (true);

drop policy if exists "restapay cash ledger all" on public.cash_ledger;
create policy "restapay cash ledger all" on public.cash_ledger for all to anon, authenticated using (true) with check (true);
