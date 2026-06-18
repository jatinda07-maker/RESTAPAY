-- RESTAPAY Supabase cloud storage table
-- Run this once in Supabase SQL Editor if data is not saving/loading.
create table if not exists public.app_data (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

-- For RESTAPAY single-user public anon app.
-- This allows the app's anon key to read/write only this table.
drop policy if exists "RESTAPAY app_data read" on public.app_data;
drop policy if exists "RESTAPAY app_data write" on public.app_data;

create policy "RESTAPAY app_data read"
on public.app_data
for select
to anon
using (true);

create policy "RESTAPAY app_data write"
on public.app_data
for insert
to anon
with check (true);

create policy "RESTAPAY app_data update"
on public.app_data
for update
to anon
using (true)
with check (true);
