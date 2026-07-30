alter table public.invoice_items add column if not exists item_number text default '';
alter table public.invoice_items add column if not exists brand text default '';
alter table public.invoice_items add column if not exists package_size text default '';
alter table public.invoice_items add column if not exists pack_count numeric default 0;
alter table public.invoice_items add column if not exists unit_size_value numeric default 0;
alter table public.invoice_items add column if not exists unit_size_unit text default '';
alter table public.invoice_items add column if not exists normalized_unit text default '';
alter table public.invoice_items add column if not exists normalized_unit_cost numeric default 0;
