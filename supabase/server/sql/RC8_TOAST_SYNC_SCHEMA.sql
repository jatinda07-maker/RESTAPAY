create extension if not exists pgcrypto;

create table if not exists public.toast_sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  files_found integer not null default 0,
  files_imported integer not null default 0,
  rows_imported integer not null default 0,
  message text
);

create table if not exists public.toast_import_files (
  id uuid primary key default gen_random_uuid(),
  export_id text not null,
  remote_path text not null,
  file_name text not null,
  report_type text not null default 'unknown',
  checksum text not null unique,
  row_count integer not null default 0,
  status text not null default 'imported',
  imported_at timestamptz not null default now()
);

create table if not exists public.toast_import_rows (
  id bigint generated always as identity primary key,
  import_file_id uuid not null references public.toast_import_files(id) on delete cascade,
  report_type text not null,
  row_number integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists toast_sync_runs_started_at_idx on public.toast_sync_runs(started_at desc);
create index if not exists toast_import_files_report_type_idx on public.toast_import_files(report_type, imported_at desc);
create index if not exists toast_import_rows_file_idx on public.toast_import_rows(import_file_id);

alter table public.toast_sync_runs enable row level security;
alter table public.toast_import_files enable row level security;
alter table public.toast_import_rows enable row level security;

-- Backend uses the Supabase service-role key and bypasses RLS.
-- Authenticated frontend users may read sync history only.
drop policy if exists "Authenticated users read toast sync runs" on public.toast_sync_runs;
create policy "Authenticated users read toast sync runs" on public.toast_sync_runs for select to authenticated using (true);

drop policy if exists "Authenticated users read toast import files" on public.toast_import_files;
create policy "Authenticated users read toast import files" on public.toast_import_files for select to authenticated using (true);
