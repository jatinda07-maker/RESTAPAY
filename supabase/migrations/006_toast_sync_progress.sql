-- RC20.1 Toast live progress and efficient resume metadata
alter table public.toast_import_runs add column if not exists current_business_date date;
alter table public.toast_import_runs add column if not exists current_file text default '';
alter table public.toast_import_runs add column if not exists current_report_type text default '';
alter table public.toast_import_runs add column if not exists total_files integer not null default 0;
alter table public.toast_import_runs add column if not exists processed_files integer not null default 0;
alter table public.toast_import_runs add column if not exists progress_percent integer not null default 0;
alter table public.toast_import_runs add column if not exists heartbeat_at timestamptz;
alter table public.toast_import_files add column if not exists remote_modified_at timestamptz;
alter table public.toast_import_files add column if not exists checked_at timestamptz;
create index if not exists toast_import_runs_status_heartbeat_idx on public.toast_import_runs(status, heartbeat_at desc);
notify pgrst, 'reload schema';
