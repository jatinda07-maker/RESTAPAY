# Production Stabilization Phase 3A

- Added route-level React error boundaries so one bad record cannot blank the application.
- Added null-safe search, names, initials, status badges, and filters for Employees, Vendors, Invoices, Bank & Checks, and Sales views.
- Added collection normalization for legacy Supabase employee/vendor rows.
- Missing optional `bank_checks` table now produces an empty page instead of blocking application startup.
- Added Render SPA rewrite via `public/_redirects`.
- Hardened shared dashboard data snapshots against undefined/non-array responses.
