# Phase 3C.4 - Bulk Actions, Real Payroll Groups, Vendor Logo Resolver

- Payroll Groups now load the real active employee list from Supabase instead of demo names.
- Payroll groups store employee IDs in `payroll_groups.member_ids` and support edit/delete.
- Bulk selection/delete added to Payroll, Sales, Employees, Invoices, Expenses, Bank & Checks, plus existing Vendors bulk actions.
- Derived analytics pages are intentionally not bulk-deletable because they do not own source records.
- Vendor logo resolver no longer uses Clearbit; it uses the vendor's verified/saved domain with a favicon fallback and stores the resolved logo URL in the vendor record when saved.
- Historical invoice loading now keeps invoice headers visible even if invoice-item loading has an error, and joins vendor names by `vendor_id` when `vendor_name` is blank.
