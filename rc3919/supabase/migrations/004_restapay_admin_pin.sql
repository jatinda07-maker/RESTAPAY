-- RC3.8.3: secure Admin PIN storage and verification.
-- Supabase installs pgcrypto in the extensions schema, so crypt/gen_salt are
-- referenced explicitly to avoid schema-cache / search-path failures.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_admin_security (
  id integer primary key default 1 check (id = 1),
  pin_hash text not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.app_admin_security enable row level security;

-- Never expose pin_hash directly through table policies.
revoke all on public.app_admin_security from anon, authenticated;

create or replace function public.admin_pin_configured()
returns boolean
language sql
security definer
set search_path = public, extensions
as $$ select exists(select 1 from public.app_admin_security where id=1); $$;

create or replace function public.verify_admin_pin(candidate text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists(
    select 1 from public.app_admin_security
    where id=1 and pin_hash = extensions.crypt(candidate, pin_hash)
  );
$$;

create or replace function public.set_admin_pin(new_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new_pin !~ '^[0-9]{4,6}$' then raise exception 'Admin PIN must be 4 to 6 digits'; end if;
  if not exists(select 1 from public.app_user_roles where user_id=auth.uid() and role='admin') then
    raise exception 'Only an authenticated Admin can set or change the Admin PIN';
  end if;
  insert into public.app_admin_security(id,pin_hash,updated_by,updated_at)
  values(1,extensions.crypt(new_pin,extensions.gen_salt('bf')),auth.uid(),now())
  on conflict(id) do update set pin_hash=excluded.pin_hash,updated_by=excluded.updated_by,updated_at=now();
  return true;
end; $$;

grant execute on function public.admin_pin_configured() to anon, authenticated;
grant execute on function public.verify_admin_pin(text) to anon, authenticated;
grant execute on function public.set_admin_pin(text) to authenticated;

notify pgrst, 'reload schema';
