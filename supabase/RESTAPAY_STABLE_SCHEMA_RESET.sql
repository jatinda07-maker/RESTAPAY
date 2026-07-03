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
  method text default 'Cash',
  check_number text default '',
  payroll_date date default current_date,
  hours numeric default 0,
  regular_pay numeric default 0,
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
