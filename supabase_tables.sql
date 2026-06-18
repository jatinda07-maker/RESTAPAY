-- Resta Pay Supabase setup
-- Current app uses app_data as the live cloud database row.
-- Run this in Supabase SQL Editor.

create table if not exists public.app_data (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_data (id, data)
values ('restaurant-payroll-vendor', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.app_data enable row level security;

drop policy if exists "restapay anon can read app_data" on public.app_data;
drop policy if exists "restapay anon can insert app_data" on public.app_data;
drop policy if exists "restapay anon can update app_data" on public.app_data;

create policy "restapay anon can read app_data"
on public.app_data
for select
to anon
using (true);

create policy "restapay anon can insert app_data"
on public.app_data
for insert
to anon
with check (true);

create policy "restapay anon can update app_data"
on public.app_data
for update
to anon
using (true)
with check (true);

-- Optional future normalized tables.
-- These are created for future upgrades, but the current app.js saves everything in app_data.data.
create table if not exists public.employees (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.vendors (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.payroll (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.invoices (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.property_expenses (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.sales (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.toast_payroll (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.employees enable row level security;
alter table public.vendors enable row level security;
alter table public.payroll enable row level security;
alter table public.invoices enable row level security;
alter table public.property_expenses enable row level security;
alter table public.sales enable row level security;
alter table public.toast_payroll enable row level security;
alter table public.settings enable row level security;

-- For future normalized version only. Current app does not use these tables.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['employees','vendors','payroll','invoices','property_expenses','sales','toast_payroll','settings']
  loop
    execute format('drop policy if exists "restapay anon can read %I" on public.%I', tbl, tbl);
    execute format('drop policy if exists "restapay anon can insert %I" on public.%I', tbl, tbl);
    execute format('drop policy if exists "restapay anon can update %I" on public.%I', tbl, tbl);
    execute format('drop policy if exists "restapay anon can delete %I" on public.%I', tbl, tbl);
    execute format('create policy "restapay anon can read %I" on public.%I for select to anon using (true)', tbl, tbl);
    execute format('create policy "restapay anon can insert %I" on public.%I for insert to anon with check (true)', tbl, tbl);
    execute format('create policy "restapay anon can update %I" on public.%I for update to anon using (true) with check (true)', tbl, tbl);
    execute format('create policy "restapay anon can delete %I" on public.%I for delete to anon using (true)', tbl, tbl);
  end loop;
end $$;
