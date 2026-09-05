-- RC3.9.37: preserve printed Alabama ABC case pricing and discounts.
alter table if exists public.invoice_items add column if not exists gross_unit_price numeric default 0;
alter table if exists public.invoice_items add column if not exists discount_percent numeric default 0;
alter table if exists public.invoice_items add column if not exists discount_amount numeric default 0;
alter table if exists public.invoice_items add column if not exists net_unit_price numeric default 0;
notify pgrst, 'reload schema';
