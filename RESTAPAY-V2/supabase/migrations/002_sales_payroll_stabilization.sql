-- RC12.2 sales category persistence and payroll/dashboard stabilization
alter table public.sales_days add column if not exists tips_collected numeric default 0;
alter table public.sales_days add column if not exists tips_withheld numeric default 0;
alter table public.sales_days add column if not exists tips_after_withholding numeric default 0;
alter table public.sales_days add column if not exists food_sales numeric default 0;
alter table public.sales_days add column if not exists alcohol_sales numeric default 0;
alter table public.sales_days add column if not exists other_sales numeric default 0;
alter table public.sales_days add column if not exists excluded_sales numeric default 0;
alter table public.sales_days add column if not exists food_sales_categories jsonb default '[]'::jsonb;
alter table public.sales_days add column if not exists alcohol_sales_categories jsonb default '[]'::jsonb;
alter table public.sales_days add column if not exists other_sales_categories jsonb default '[]'::jsonb;
alter table public.sales_days add column if not exists excluded_sales_categories jsonb default '[]'::jsonb;
notify pgrst, 'reload schema';
