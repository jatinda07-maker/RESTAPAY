-- RESTAPAY production schema alignment (non-destructive)
-- Safe for an existing project: creates missing tables and adds missing columns.

create extension if not exists pgcrypto;

create table if not exists public.app_data (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employees (
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

create table if not exists public.vendors (
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

create table if not exists public.invoices (
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

create table if not exists public.invoice_items (
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

alter table public.invoice_items
  add column if not exists item_number text default '',
  add column if not exists brand text default '',
  add column if not exists manufacturer text default '',
  add column if not exists vendor_item_number text default '',
  add column if not exists upc text default '',
  add column if not exists package_size text default '',
  add column if not exists package_description text default '',
  add column if not exists pack_count numeric default 0,
  add column if not exists pack_size numeric default 0,
  add column if not exists unit_size numeric default 0,
  add column if not exists unit_size_value numeric default 0,
  add column if not exists unit_size_unit text default '',
  add column if not exists unit_type text default '',
  add column if not exists total_case_size numeric default 0,
  add column if not exists normalized_unit text default '',
  add column if not exists normalized_unit_cost numeric default 0,
  add column if not exists product_id text,
  add column if not exists confidence_score numeric,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.payroll_groups (
  id text primary key,
  name text not null,
  method text default 'Cash',
  notes text default '',
  member_ids jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.payroll_entries (
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

create table if not exists public.payroll_imports (
  id text primary key,
  file_name text not null,
  row_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.expenses (
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

create table if not exists public.sales_days (
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
  tips_collected numeric default 0,
  tips_withheld numeric default 0,
  tips_after_withholding numeric default 0,
  food_sales numeric default 0,
  alcohol_sales numeric default 0,
  other_sales numeric default 0,
  excluded_sales numeric default 0,
  food_sales_categories jsonb default '[]'::jsonb,
  alcohol_sales_categories jsonb default '[]'::jsonb,
  other_sales_categories jsonb default '[]'::jsonb,
  excluded_sales_categories jsonb default '[]'::jsonb,
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

create table if not exists public.toast_sales_categories (
  id text primary key,
  business_date date,
  category_name text default '',
  normalized_department text default '',
  net_sales numeric default 0,
  quantity numeric default 0,
  source_file text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sales_imports (
  id text primary key,
  file_name text not null,
  row_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.menu_items (
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
  cost_target numeric default 30,
  cost_type text default 'Food',
  imported_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.menu_recipes (
  id text primary key,
  menu_item_id text,
  menu_item_name text default '',
  target_food_cost numeric default 30,
  confidence text default 'Estimated',
  lines jsonb default '[]'::jsonb,
  recipe_type text default 'Food',
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.menu_imports (
  id text primary key,
  file_name text not null,
  row_count integer default 0,
  imported_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.custom_reports (
  id text primary key,
  name text not null,
  report_type text default 'Custom',
  fields jsonb default '[]'::jsonb,
  filters jsonb default '{}'::jsonb,
  template jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.settings (
  id text primary key default 'main',
  tip_withholding_rate numeric default 3.5,
  gemini_model text default 'gemini-2.5-flash',
  app_settings jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.employee_types (id text primary key, name text not null unique);
create table if not exists public.job_types (id text primary key, name text not null unique);
create table if not exists public.vendor_categories (id text primary key, name text not null unique);
create table if not exists public.expense_categories (id text primary key, name text not null unique);
create table if not exists public.payment_methods (id text primary key, name text not null unique);

insert into public.app_data(id, data) values ('main', '{}'::jsonb) on conflict (id) do nothing;
insert into public.settings(id) values ('main') on conflict (id) do nothing;

create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id);
create index if not exists idx_invoice_items_item_number on public.invoice_items(item_number);
create index if not exists idx_invoice_items_vendor_item_number on public.invoice_items(vendor_item_number);
create index if not exists idx_invoice_items_upc on public.invoice_items(upc);
create index if not exists idx_sales_days_business_date on public.sales_days(business_date);
create index if not exists idx_toast_categories_business_date on public.toast_sales_categories(business_date);
create index if not exists idx_payroll_entries_date on public.payroll_entries(payroll_date);
create index if not exists idx_invoices_date on public.invoices(invoice_date);
create index if not exists idx_expenses_date on public.expenses(expense_date);

-- Current RESTAPAY deployment uses the anon key for direct CRUD.
-- Tighten these policies before exposing the application publicly to untrusted users.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'app_data','employees','vendors','invoices','invoice_items','payroll_groups','payroll_entries',
    'payroll_imports','expenses','sales_days','toast_sales_categories','sales_imports','menu_items',
    'menu_recipes','menu_imports','custom_reports','settings','employee_types','job_types',
    'vendor_categories','expense_categories','payment_methods'
  ] loop
    execute format('alter table public.%I disable row level security', table_name);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', table_name);
  end loop;
end $$;

notify pgrst, 'reload schema';
