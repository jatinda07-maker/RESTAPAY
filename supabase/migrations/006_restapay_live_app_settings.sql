-- Shared business configuration that must remain synchronized across pages/devices.
create table if not exists public.app_settings (
  setting_key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
drop policy if exists "anon app settings all" on public.app_settings;
create policy "anon app settings all" on public.app_settings for all to anon using (true) with check (true);
drop policy if exists "authenticated app settings all" on public.app_settings;
create policy "authenticated app settings all" on public.app_settings for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.app_settings;
exception when duplicate_object then null;
end $$;
