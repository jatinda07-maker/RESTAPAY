-- Effective-dated employee pay rates. Historical payroll records remain immutable;
-- payroll builders select the latest rate effective on/before the payroll week start.
create table if not exists public.employee_pay_rates (
  id text primary key,
  employee_id text not null,
  amount numeric not null default 0,
  effective_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_pay_rates_employee_effective_idx
  on public.employee_pay_rates (employee_id, effective_date desc);

alter table public.employee_pay_rates enable row level security;
drop policy if exists "anon employee pay rates all" on public.employee_pay_rates;
create policy "anon employee pay rates all" on public.employee_pay_rates
  for all to anon using (true) with check (true);
drop policy if exists "authenticated employee pay rates all" on public.employee_pay_rates;
create policy "authenticated employee pay rates all" on public.employee_pay_rates
  for all to authenticated using (true) with check (true);

-- Realtime is best-effort; ignore duplicate publication membership.
do $$
begin
  alter publication supabase_realtime add table public.employee_pay_rates;
exception when duplicate_object then null;
end $$;
