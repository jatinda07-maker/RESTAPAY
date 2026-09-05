-- RC3.9.21: manager/admin role PIN reset support.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_role_security (
  role text primary key check (role in ('admin','manager')),
  pin_hash text not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.app_role_security enable row level security;
revoke all on public.app_role_security from anon, authenticated;

-- Preserve any Admin PIN configured by the earlier RC3.8.3 migration.
insert into public.app_role_security(role,pin_hash,updated_by,updated_at)
select 'admin', pin_hash, updated_by, updated_at
from public.app_admin_security
where id=1
on conflict(role) do nothing;

create or replace function public.role_pin_configured(target_role text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists(select 1 from public.app_role_security where role=lower(target_role));
$$;

create or replace function public.verify_role_pin(target_role text, candidate text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists(
    select 1 from public.app_role_security
    where role=lower(target_role)
      and pin_hash = extensions.crypt(candidate, pin_hash)
  );
$$;

create or replace function public.set_role_pin(target_role text, new_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_role text := lower(target_role);
begin
  if normalized_role not in ('admin','manager') then raise exception 'Role must be admin or manager'; end if;
  if new_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN must be 4 to 6 digits'; end if;
  if not exists(select 1 from public.app_user_roles where user_id=auth.uid() and role='admin') then
    raise exception 'Only an authenticated Admin can set or change role PINs';
  end if;
  insert into public.app_role_security(role,pin_hash,updated_by,updated_at)
  values(normalized_role,extensions.crypt(new_pin,extensions.gen_salt('bf')),auth.uid(),now())
  on conflict(role) do update set pin_hash=excluded.pin_hash,updated_by=excluded.updated_by,updated_at=now();
  return true;
end; $$;

grant execute on function public.role_pin_configured(text) to anon, authenticated;
grant execute on function public.verify_role_pin(text,text) to anon, authenticated;
grant execute on function public.set_role_pin(text,text) to authenticated;

-- Keep legacy Admin PIN RPCs working by mirroring role PIN behavior.
create or replace function public.verify_admin_pin(candidate text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$ select public.verify_role_pin('admin', candidate); $$;

create or replace function public.set_admin_pin(new_pin text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$ select public.set_role_pin('admin', new_pin); $$;

grant execute on function public.verify_admin_pin(text) to anon, authenticated;
grant execute on function public.set_admin_pin(text) to authenticated;

notify pgrst, 'reload schema';
