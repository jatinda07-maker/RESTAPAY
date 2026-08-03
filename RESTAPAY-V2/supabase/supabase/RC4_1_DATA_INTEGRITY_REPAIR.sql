-- RESTAPAY RC4.1 non-destructive data integrity repair
-- Run this in Supabase SQL Editor. This script does NOT drop business tables.

begin;

alter table if exists public.expenses
  add column if not exists payment_type text default 'Cash',
  add column if not exists check_number text default '',
  add column if not exists updated_at timestamptz default now();

alter table if exists public.invoices
  add column if not exists payment_type text default 'Check',
  add column if not exists check_number text default '',
  add column if not exists invoice_type text default 'Regular Invoice',
  add column if not exists updated_at timestamptz default now();

alter table if exists public.toast_sales_categories
  add column if not exists updated_at timestamptz default now();

alter table if exists public.app_data
  add column if not exists updated_at timestamptz default now();

-- Remove duplicate lookup rows while retaining one row for each name.
-- Business records store category names, so removing duplicate lookup IDs is safe.
delete from public.employee_types a
using public.employee_types b
where lower(trim(a.name)) = lower(trim(b.name)) and a.ctid > b.ctid;

delete from public.job_types a
using public.job_types b
where lower(trim(a.name)) = lower(trim(b.name)) and a.ctid > b.ctid;

delete from public.vendor_categories a
using public.vendor_categories b
where lower(trim(a.name)) = lower(trim(b.name)) and a.ctid > b.ctid;

delete from public.expense_categories a
using public.expense_categories b
where lower(trim(a.name)) = lower(trim(b.name)) and a.ctid > b.ctid;

delete from public.payment_methods a
using public.payment_methods b
where lower(trim(a.name)) = lower(trim(b.name)) and a.ctid > b.ctid;

create unique index if not exists employee_types_name_ci_key on public.employee_types (lower(trim(name)));
create unique index if not exists job_types_name_ci_key on public.job_types (lower(trim(name)));
create unique index if not exists vendor_categories_name_ci_key on public.vendor_categories (lower(trim(name)));
create unique index if not exists expense_categories_name_ci_key on public.expense_categories (lower(trim(name)));
create unique index if not exists payment_methods_name_ci_key on public.payment_methods (lower(trim(name)));

insert into public.payment_methods (id, name) values
  ('cash', 'Cash'),
  ('check', 'Check'),
  ('credit', 'Credit'),
  ('credit-card', 'Credit Card'),
  ('ach', 'ACH'),
  ('debit-card', 'Debit Card'),
  ('other', 'Other')
on conflict do nothing;

insert into public.app_data (id, data, updated_at)
values ('main', '{}'::jsonb, now())
on conflict (id) do nothing;

commit;
