# Phase 3B Full Live Release

- Supabase-backed CRUD now awaits database success before showing confirmation.
- Employees and Vendors map legacy Supabase columns into the current UI fields.
- Vendor expense type and employee base pay mappings are corrected.
- Invoices are registered as a live Supabase collection.
- Vendor logo URL support is included; migration adds `vendors.logo_url` non-destructively.
- Last Week, Last Month, and Yesterday date presets are included.
- Settings includes a live Supabase connection test.
- Missing optional Bank & Checks table remains non-fatal.

Run `supabase/migrations/002_restapay1_live_extensions.sql` once, then build and deploy.
