create extension if not exists "pgcrypto";

create table if not exists public.employee_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.job_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  employee_type text not null default 'Regular',
  job_type text not null default 'Kitchen',
  pay_type text not null default 'Hourly' check (pay_type in ('Tips','Hourly','Salary')),
  payroll_type text not null default 'Cash' check (payroll_type in ('Cash','Check','Direct Deposit')),
  base_pay numeric(10,2) not null default 0,
  extra_pay numeric(10,2) not null default 0,
  extra_reason text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_margin numeric(5,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Other',
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id) on delete set null,
  vendor_name text not null,
  invoice_date date not null default current_date,
  category text not null default 'Other',
  total numeric(12,2) not null default 0,
  status text not null default 'Pending',
  source_file text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  item_name text not null,
  quantity numeric(12,3) not null default 0,
  unit text not null default 'each',
  unit_price numeric(12,4) not null default 0,
  line_total numeric(12,2) not null default 0,
  category text not null default 'Other',
  created_at timestamptz not null default now()
);

create table if not exists public.sales_records (
  id uuid primary key default gen_random_uuid(),
  sales_date date not null,
  cash_sales numeric(12,2) not null default 0,
  credit_sales numeric(12,2) not null default 0,
  online_orders numeric(12,2) not null default 0,
  gift_cards numeric(12,2) not null default 0,
  tips numeric(12,2) not null default 0,
  refunds numeric(12,2) not null default 0,
  total_sales numeric(12,2) not null default 0,
  source_file text,
  created_at timestamptz not null default now()
);

create table if not exists public.payroll_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  payroll_type text not null default 'Cash' check (payroll_type in ('Cash','Check')),
  created_at timestamptz not null default now()
);

create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text not null,
  pay_date date not null default current_date,
  payroll_type text not null default 'Cash' check (payroll_type in ('Cash','Check')),
  regular_pay numeric(12,2) not null default 0,
  tips numeric(12,2) not null default 0,
  tip_deduction_rate numeric(5,3) not null default 3.5,
  extra_pay numeric(12,2) not null default 0,
  extra_reason text not null default '',
  total_pay numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  expense_date date not null default current_date,
  category text not null default 'Other',
  amount numeric(12,2) not null default 0,
  payment_type text not null default 'Cash',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.employee_types(name) values ('Regular'),('Group'),('Part-time'),('Contract'),('Intern'),('Temporary') on conflict do nothing;
insert into public.job_types(name) values ('Kitchen'),('Server'),('Bartender'),('Manager'),('Dishwasher'),('Prep'),('Cleaner'),('Host'),('Other') on conflict do nothing;

alter table public.employees add column if not exists employee_type text not null default 'Regular';
alter table public.employees add column if not exists pay_type text not null default 'Hourly';
alter table public.employees add column if not exists base_pay numeric(10,2) not null default 0;
update public.employees set base_pay = hourly_rate where base_pay = 0 and hourly_rate is not null;
insert into public.vendor_categories(name, default_margin) values ('Food',30),('Beverage',35),('Beer',45),('Liquor',70),('Supplies',0),('Utilities',0),('Insurance',0),('Maintenance',0),('Other',0) on conflict do nothing;

-- For production, enable RLS and add policies based on your auth setup.
-- alter table public.employees enable row level security;

create table if not exists public.payroll_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.payroll_groups(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(group_id, employee_id)
);

alter table public.payroll_entries add column if not exists group_id uuid references public.payroll_groups(id) on delete set null;
alter table public.payroll_entries add column if not exists group_name text not null default '';
alter table public.payroll_entries add column if not exists pay_type text not null default 'Hourly';
