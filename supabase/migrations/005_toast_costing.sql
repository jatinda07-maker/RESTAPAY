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
