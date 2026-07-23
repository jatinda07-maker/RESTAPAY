-- RESTAPAY rebate / credit invoice support
-- Safe migration: does not delete data.

alter table public.invoices
add column if not exists invoice_type text default 'Regular Invoice';

-- Make existing negative invoices easier to identify in the UI.
update public.invoices
set invoice_type = case
  when lower(coalesce(notes, '') || ' ' || coalesce(source_file, '') || ' ' || coalesce(invoice_number, '')) like '%rebate%' then 'Rebate'
  when lower(coalesce(notes, '') || ' ' || coalesce(source_file, '') || ' ' || coalesce(invoice_number, '')) like '%return%' then 'Return Credit'
  when lower(coalesce(notes, '') || ' ' || coalesce(source_file, '') || ' ' || coalesce(invoice_number, '')) like '%adjustment%' then 'Vendor Adjustment'
  when total < 0 then 'Credit Memo'
  else coalesce(invoice_type, 'Regular Invoice')
end
where invoice_type is null or invoice_type = 'Regular Invoice';

notify pgrst, 'reload schema';
