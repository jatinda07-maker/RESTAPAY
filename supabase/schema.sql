-- RESTAPAY stable Supabase schema reset
-- WARNING: this drops and recreates RestaPay tables. Browser localStorage backup can resync after refresh.

create extension if not exists pgcrypto;

drop table if exists public.invoice_items cascade;
drop table if exists public.invoices cascade;
drop table if exists public.expenses cascade;
drop table if exists public.payroll_entries cascade;
drop table if exists public.payroll_imports cascade;
drop table if exists public.payroll_groups cascade;
drop table if exists public.vendors cascade;
drop table if exists public.employees cascade;
drop table if exists public.sales_days cascade;
drop table if exists public.sales_imports cascade;
drop table if exists public.custom_reports cascade;
drop table if exists public.menu_recipes cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.menu_imports cascade;
drop table if exists public.settings cascade;
drop table if exists public.employee_types cascade;
drop table if exists public.job_types cascade;
drop table if exists public.vendor_categories cascade;
drop table if exists public.expense_categories cascade;
drop table if exists public.payment_methods cascade;
drop table if exists public.app_data cascade;

create table public.app_data (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.employees (
  id text primary key,
  name text not null,
  employee_type text default 'Regular',
  job_type text default 'Other',
  pay_type text default 'Hourly',
  payroll_type text default 'Cash',
  payroll_classification text default 'Operating Labor',
  default_check_number text default '',
  base_pay numeric default 0,
  extra_pay numeric default 0,
  extra_reason text default '',
  active boolean default true,
  phone text default '',
  email text default '',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.vendors (
  id text primary key,
  name text not null,
  category text default 'Other',
  contact text default '',
  phone text default '',
  email text default '',
  default_check_number text default '',
  notes text default '',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.invoices (
  id text primary key,
  vendor_id text,
  vendor_name text default '',
  invoice_number text default '',
  invoice_date date default current_date,
  due_date date,
  category text default 'Other',
  payment_type text default 'Check',
  invoice_type text default 'Regular Invoice',
  check_number text default '',
  subtotal numeric default 0,
  tax numeric default 0,
  total numeric default 0,
  status text default 'Open',
  source_file text default '',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.invoice_items (
  id text primary key,
  invoice_id text references public.invoices(id) on delete cascade,
  description text default '',
  item_name text default '',
  quantity numeric default 0,
  unit text default '',
  unit_price numeric default 0,
  line_total numeric default 0,
  category text default 'Other',
  created_at timestamptz default now()
);

create table public.payroll_groups (
  id text primary key,
  name text not null,
  method text default 'Cash',
  notes text default '',
  member_ids jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.payroll_entries (
  id text primary key,
  employee_id text,
  employee_name text not null,
  source text default 'Manual',
  pay_type text default 'Hourly',
  payroll_type text default 'Cash',
  payroll_classification text default 'Operating Labor',
  method text default 'Cash',
  check_number text default '',
  payroll_date date default current_date,
  pay_date date default current_date,
  hours numeric default 0,
  regular_pay numeric default 0,
  tips numeric default 0,
  tip_deduction numeric default 0,
  tips_after_withheld numeric default 0,
  tips_withheld numeric default 0,
  extra_pay numeric default 0,
  extra_reason text default '',
  total numeric default 0,
  group_id text,
  group_name text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.payroll_imports (
  id text primary key,
  file_name text not null,
  row_count integer default 0,
  created_at timestamptz default now()
);

create table public.expenses (
  id text primary key,
  expense_date date default current_date,
  name text not null,
  vendor text default '',
  category text default 'Other',
  payment_type text default 'Cash',
  check_number text default '',
  amount numeric default 0,
  notes text default '',
  recurring boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.sales_days (
  id text primary key,
  business_date date not null,
  gross_sales numeric default 0,
  net_sales numeric default 0,
  cash_sales numeric default 0,
  credit_sales numeric default 0,
  gift_card_sales numeric default 0,
  online_orders numeric default 0,
  delivery_orders numeric default 0,
  pickup_orders numeric default 0,
  tips numeric default 0,
  refunds numeric default 0,
  voids numeric default 0,
  discounts numeric default 0,
  tax numeric default 0,
  guest_count numeric default 0,
  source_file text default '',
  import_note text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.sales_imports (
  id text primary key,
  file_name text not null,
  row_count integer default 0,
  created_at timestamptz default now()
);

create table public.menu_items (
  id text primary key,
  name text not null,
  category text default 'Food',
  vendor_source text default 'US Foods',
  qty_sold numeric default 0,
  avg_price numeric default 0,
  gross_sales numeric default 0,
  net_sales numeric default 0,
  date_start date,
  date_end date,
  source_file text default '',
  status text default 'Estimated',
  imported_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.menu_recipes (
  id text primary key,
  menu_item_id text,
  menu_item_name text default '',
  target_food_cost numeric default 30,
  confidence text default 'Estimated',
  lines jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table public.menu_imports (
  id text primary key,
  file_name text not null,
  row_count integer default 0,
  imported_at timestamptz default now()
);

create table public.custom_reports (
  id text primary key,
  name text not null,
  report_type text default 'Custom',
  fields jsonb default '[]'::jsonb,
  filters jsonb default '{}'::jsonb,
  template jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.settings (
  id text primary key default 'main',
  tip_withholding_rate numeric default 3.5,
  gemini_model text default 'gemini-2.5-flash',
  app_settings jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table public.employee_types (id text primary key, name text not null unique);
create table public.job_types (id text primary key, name text not null unique);
create table public.vendor_categories (id text primary key, name text not null unique);
create table public.expense_categories (id text primary key, name text not null unique);
create table public.payment_methods (id text primary key, name text not null unique);

insert into public.app_data(id, data) values ('main', '{}');
insert into public.settings(id) values ('main');

insert into public.employee_types values
('regular','Regular'),('manager','Manager'),('kitchen','Kitchen'),('front-house','Front House'),('seasonal','Seasonal'),('other','Other');
insert into public.job_types values
('bartender','Bartender'),('busser','Busser'),('cashier','Cashier'),('cook','Cook'),('host','Host'),('kitchen','Kitchen'),('manager','Manager'),('server','Server'),('other','Other');
insert into public.vendor_categories values
('food','Food'),('beverage','Beverage'),('beer','Beer'),('liquor','Liquor'),('utilities','Utilities'),('insurance','Insurance'),('supplies','Supplies'),('maintenance','Maintenance'),('other','Other');
insert into public.expense_categories values
('restaurant-expenses','Restaurant Expenses'),('loans','Loans'),('accounting-fees','Accounting Fees'),('utilities','Utilities'),('supplies','Supplies'),('maintenance','Maintenance'),('insurance','Insurance'),('cash-expenses','Cash Expenses'),('other','Other');
insert into public.payment_methods values
('cash','Cash'),('check','Check'),('credit','Credit'),('ach','ACH');



-- RC6 invoice rebate / credit support
alter table public.invoices
add column if not exists invoice_type text default 'Regular Invoice';

-- RC3 payroll classification / tips separation columns
alter table public.employees
add column if not exists payroll_classification text default 'Operating Labor';

alter table public.payroll_entries
add column if not exists payroll_type text default 'Cash',
add column if not exists payroll_classification text default 'Operating Labor',
add column if not exists pay_date date default current_date,
add column if not exists tips numeric default 0,
add column if not exists tip_deduction numeric default 0,
add column if not exists check_number text default '',
add column if not exists regular_pay numeric default 0,
add column if not exists total_pay numeric default 0;

alter table public.app_data disable row level security;
alter table public.employees disable row level security;
alter table public.vendors disable row level security;
alter table public.invoices disable row level security;
alter table public.invoice_items disable row level security;
alter table public.payroll_groups disable row level security;
alter table public.payroll_entries disable row level security;
alter table public.payroll_imports disable row level security;
alter table public.expenses disable row level security;
alter table public.sales_days disable row level security;
alter table public.sales_imports disable row level security;
alter table public.menu_items disable row level security;
alter table public.menu_recipes disable row level security;
alter table public.menu_imports disable row level security;
alter table public.custom_reports disable row level security;
alter table public.settings disable row level security;
alter table public.employee_types disable row level security;
alter table public.job_types disable row level security;
alter table public.vendor_categories disable row level security;
alter table public.expense_categories disable row level security;
alter table public.payment_methods disable row level security;

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

notify pgrst, 'reload schema';
-- RestaPay RC8: Toast automation + food/alcohol costing
-- Safe additive migration. Run once in Supabase SQL Editor.

create table if not exists public.toast_import_runs (
  id text primary key,
  status text not null default 'running',
  business_date date,
  files_imported integer default 0,
  rows_imported integer default 0,
  message text default '',
  started_at timestamptz default now(),
  finished_at timestamptz
);

create table if not exists public.toast_import_files (
  id text primary key,
  run_id text references public.toast_import_runs(id) on delete set null,
  business_date date,
  report_type text default 'Other',
  file_name text not null,
  remote_path text not null unique,
  storage_path text default '',
  file_size bigint default 0,
  row_count integer default 0,
  status text default 'Imported',
  imported_at timestamptz default now()
);

create table if not exists public.toast_import_rows (
  id text primary key,
  file_id text not null references public.toast_import_files(id) on delete cascade,
  run_id text references public.toast_import_runs(id) on delete set null,
  business_date date,
  report_type text default 'Other',
  row_number integer default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists toast_import_runs_started_idx on public.toast_import_runs(started_at desc);
create index if not exists toast_import_files_business_idx on public.toast_import_files(business_date desc, report_type);
create index if not exists toast_import_rows_file_idx on public.toast_import_rows(file_id, row_number);
create index if not exists toast_import_rows_report_idx on public.toast_import_rows(business_date desc, report_type);

alter table public.menu_items add column if not exists cost_target numeric default 30;
alter table public.menu_items add column if not exists cost_type text default 'Food';
alter table public.menu_recipes add column if not exists recipe_type text default 'Food';

alter table public.settings add column if not exists target_food_cost numeric default 30;
alter table public.settings add column if not exists target_beer_cost numeric default 24;
alter table public.settings add column if not exists target_liquor_cost numeric default 20;
alter table public.settings add column if not exists target_beverage_cost numeric default 18;
alter table public.settings add column if not exists toast_settings jsonb default '{}'::jsonb;

alter table public.toast_import_runs disable row level security;
alter table public.toast_import_files disable row level security;
alter table public.toast_import_rows disable row level security;
grant all on public.toast_import_runs, public.toast_import_files, public.toast_import_rows to anon, authenticated, service_role;

insert into storage.buckets (id, name, public)
values ('toast-exports', 'toast-exports', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
