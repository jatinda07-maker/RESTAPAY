alter table if exists public.invoices add column if not exists payment_terms text;
alter table if exists public.invoices add column if not exists printed_subtotal numeric default 0;
alter table if exists public.invoices add column if not exists discount numeric default 0;
alter table if exists public.invoices add column if not exists charges numeric default 0;
alter table if exists public.invoices add column if not exists printed_total numeric default 0;
