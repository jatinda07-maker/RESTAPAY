# Phase 3C.5 - Invoice visibility and placeholder cleanup

- Registered `restapay-invoices` as a live Supabase collection so the invoice loader actually executes.
- Historical invoice headers now load from `public.invoices`; line items are joined from `public.invoice_items` when available.
- Vendor names continue to resolve from `vendor_name`, `vendor_id`, or legacy vendor fields.
- Removed the obsolete global "action is available / engine phase" fallback toast from AppShell.
- Real success, validation, and database error notifications remain intact.
