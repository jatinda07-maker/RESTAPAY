# RESTAPAY RC3.9.21 — Manager Security + Report Access

- Manager mode no longer exposes Period Profit / Loss Analysis or Reconciliation Check in the weekly report preview/PDF.
- Manager mode no longer shows the Period P&L KPI or profit summary.
- Manager report builder cannot add Period P&L.
- Route permissions are now enforced around the live page outlet; unauthorized pages redirect to Reports.
- Sidebar hides routes the active role cannot access.
- Admin and Manager access PINs can both be reset from Settings > Users & Security by an authenticated Admin.
- Switching to Manager now requires the Manager PIN; switching back to Admin requires the Admin PIN.
- Supabase migration 005_restapay_role_pins.sql stores both role PIN hashes and preserves the previous Admin PIN hash when present.

IMPORTANT: deploy the code AND run supabase/migrations/005_restapay_role_pins.sql in the Supabase SQL editor once before using the new Manager PIN/reset controls.
