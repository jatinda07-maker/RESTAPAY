-- Non-destructive RestaPay1 live extensions. Safe to run more than once.
alter table if exists public.vendors add column if not exists vendor_type text;
alter table if exists public.vendors add column if not exists expense_type text;
alter table if exists public.vendors add column if not exists website text;
alter table if exists public.payroll_groups add column if not exists group_type text;
alter table if exists public.payroll_entries add column if not exists original_tips numeric default 0;
alter table if exists public.payroll_entries add column if not exists week_start date;
alter table if exists public.payroll_entries add column if not exists week_end date;
alter table if exists public.payroll_entries add column if not exists payment_status text;
alter table if exists public.payroll_entries add column if not exists payment_date date;
alter table if exists public.payroll_entries add column if not exists ach_reference text;
alter table if exists public.payroll_entries add column if not exists payment_notes text;
alter table if exists public.payroll_entries add column if not exists source_ids jsonb default '[]'::jsonb;
alter table if exists public.payroll_entries add column if not exists rolled_up boolean default false;
alter table if exists public.payroll_entries add column if not exists weekly_rollup boolean default false;
alter table if exists public.expenses add column if not exists status text;
create table if not exists public.bank_checks (
  id text primary key,
  payment_date date not null,
  payment_type text not null default 'Check',
  payee text not null,
  reference_number text,
  amount numeric not null default 0,
  status text not null default 'Pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bank_checks enable row level security;
drop policy if exists "anon bank checks all" on public.bank_checks;
create policy "anon bank checks all" on public.bank_checks for all to anon using (true) with check (true);
alter table if exists public.vendors add column if not exists website_domain text;
alter table if exists public.vendors add column if not exists logo_url text;
alter table if exists public.vendors add column if not exists logo_source text;
alter table if exists public.vendors add column if not exists logo_verified boolean default false;

alter table if exists public.invoices add column if not exists duplicate_override boolean default false;
alter table if exists public.invoices add column if not exists duplicate_match_id text;
alter table if exists public.invoices add column if not exists duplicate_match_reason text;

-- Phase 3D vendor-logo persistence. Public read; writes are performed by the vendor-logo Edge Function/service role.
insert into storage.buckets (id, name, public)
values ('vendor-logos', 'vendor-logos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public vendor logo read" on storage.objects;
create policy "public vendor logo read" on storage.objects
for select to public using (bucket_id = 'vendor-logos');
