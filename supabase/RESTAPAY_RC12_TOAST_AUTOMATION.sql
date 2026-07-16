-- RestaPay RC12 - Complete Toast automation schema
-- Run in Supabase SQL Editor once, then refresh the Toast Integration page.

create extension if not exists pgcrypto;

create table if not exists public.toast_import_runs (
  id text primary key,
  status text not null default 'running',
  business_date date,
  files_imported integer not null default 0,
  files_skipped integer not null default 0,
  rows_imported integer not null default 0,
  duplicates_skipped integer not null default 0,
  error_count integer not null default 0,
  message text default '',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.toast_import_files (
  id text primary key,
  run_id text references public.toast_import_runs(id) on delete set null,
  business_date date,
  report_type text not null default 'Other',
  file_name text not null,
  remote_path text not null unique,
  storage_path text default '',
  file_hash text,
  file_size bigint not null default 0,
  row_count integer not null default 0,
  status text not null default 'Imported',
  error_message text default '',
  imported_at timestamptz not null default now()
);

create table if not exists public.toast_import_rows (
  id text primary key,
  file_id text not null references public.toast_import_files(id) on delete cascade,
  run_id text references public.toast_import_runs(id) on delete set null,
  business_date date,
  report_type text not null default 'Other',
  row_number integer not null default 0,
  row_hash text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(file_id, row_number)
);

create table if not exists public.toast_sales_categories (
  id text primary key,
  file_id text references public.toast_import_files(id) on delete cascade,
  business_date date not null,
  category_name text not null,
  normalized_department text not null default 'Other',
  net_sales numeric not null default 0,
  quantity numeric not null default 0,
  source_file text default '',
  created_at timestamptz not null default now(),
  unique(business_date, category_name, source_file)
);

create table if not exists public.toast_sales_summary (
  id text primary key,
  file_id text references public.toast_import_files(id) on delete cascade,
  business_date date not null,
  gross_sales numeric not null default 0,
  net_sales numeric not null default 0,
  cash_sales numeric not null default 0,
  credit_sales numeric not null default 0,
  tips numeric not null default 0,
  tax numeric not null default 0,
  discounts numeric not null default 0,
  refunds numeric not null default 0,
  guest_count numeric not null default 0,
  source_file text default '',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(business_date, source_file)
);

create table if not exists public.toast_product_mix (
  id text primary key,
  file_id text references public.toast_import_files(id) on delete cascade,
  business_date date not null,
  item_name text not null,
  sales_category text default '',
  normalized_department text not null default 'Food',
  quantity numeric not null default 0,
  net_sales numeric not null default 0,
  gross_sales numeric not null default 0,
  source_file text default '',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.toast_labor (
  id text primary key,
  file_id text references public.toast_import_files(id) on delete cascade,
  business_date date not null,
  employee_name text not null,
  job_name text default '',
  regular_hours numeric not null default 0,
  overtime_hours numeric not null default 0,
  regular_pay numeric not null default 0,
  overtime_pay numeric not null default 0,
  tips numeric not null default 0,
  total_pay numeric not null default 0,
  source_file text default '',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.toast_payments (
  id text primary key,
  file_id text references public.toast_import_files(id) on delete cascade,
  business_date date not null,
  payment_type text not null default 'Other',
  card_type text default '',
  gross_amount numeric not null default 0,
  tip_amount numeric not null default 0,
  fee_amount numeric not null default 0,
  net_amount numeric not null default 0,
  source_file text default '',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.toast_merchant_fees (
  id text primary key,
  file_id text references public.toast_import_files(id) on delete cascade,
  business_date date not null,
  processor text default 'Toast',
  payment_type text default 'Card',
  gross_card_sales numeric not null default 0,
  fee_amount numeric not null default 0,
  net_deposit numeric not null default 0,
  source_file text default '',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.toast_checks (
  id text primary key,
  file_id text references public.toast_import_files(id) on delete cascade,
  business_date date not null,
  check_number text default '',
  order_number text default '',
  server_name text default '',
  dining_option text default '',
  net_sales numeric not null default 0,
  tax numeric not null default 0,
  tip numeric not null default 0,
  total numeric not null default 0,
  source_file text default '',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.toast_cash_management (
  id text primary key,
  file_id text references public.toast_import_files(id) on delete cascade,
  business_date date not null,
  activity_type text default '',
  employee_name text default '',
  amount numeric not null default 0,
  source_file text default '',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.toast_menu_items (
  id text primary key,
  file_id text references public.toast_import_files(id) on delete cascade,
  business_date date,
  item_guid text default '',
  item_name text not null,
  menu_group text default '',
  sales_category text default '',
  price numeric not null default 0,
  active boolean not null default true,
  source_file text default '',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.toast_daily_summary (
  business_date date primary key,
  food_sales numeric not null default 0,
  alcohol_sales numeric not null default 0,
  other_sales numeric not null default 0,
  toast_net_sales numeric not null default 0,
  merchant_fees numeric not null default 0,
  labor_pay numeric not null default 0,
  tips numeric not null default 0,
  last_run_id text,
  updated_at timestamptz not null default now()
);

create index if not exists toast_import_runs_started_idx on public.toast_import_runs(started_at desc);
create index if not exists toast_import_files_business_idx on public.toast_import_files(business_date desc, report_type);
create index if not exists toast_import_rows_report_idx on public.toast_import_rows(business_date desc, report_type);
create index if not exists toast_sales_categories_date_idx on public.toast_sales_categories(business_date desc, normalized_department);
create index if not exists toast_product_mix_date_idx on public.toast_product_mix(business_date desc, normalized_department);
create index if not exists toast_labor_date_idx on public.toast_labor(business_date desc);
create index if not exists toast_payments_date_idx on public.toast_payments(business_date desc);
create index if not exists toast_merchant_fees_date_idx on public.toast_merchant_fees(business_date desc);

alter table public.settings add column if not exists toast_settings jsonb default '{}'::jsonb;
alter table public.settings add column if not exists dashboard_cards jsonb default '{}'::jsonb;

alter table public.toast_import_runs disable row level security;
alter table public.toast_import_files disable row level security;
alter table public.toast_import_rows disable row level security;
alter table public.toast_sales_categories disable row level security;
alter table public.toast_sales_summary disable row level security;
alter table public.toast_product_mix disable row level security;
alter table public.toast_labor disable row level security;
alter table public.toast_payments disable row level security;
alter table public.toast_merchant_fees disable row level security;
alter table public.toast_checks disable row level security;
alter table public.toast_cash_management disable row level security;
alter table public.toast_menu_items disable row level security;
alter table public.toast_daily_summary disable row level security;

grant all on public.toast_import_runs, public.toast_import_files, public.toast_import_rows,
  public.toast_sales_categories, public.toast_sales_summary, public.toast_product_mix,
  public.toast_labor, public.toast_payments, public.toast_merchant_fees, public.toast_checks,
  public.toast_cash_management, public.toast_menu_items, public.toast_daily_summary
  to anon, authenticated, service_role;

insert into storage.buckets (id, name, public)
values ('toast-exports', 'toast-exports', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
