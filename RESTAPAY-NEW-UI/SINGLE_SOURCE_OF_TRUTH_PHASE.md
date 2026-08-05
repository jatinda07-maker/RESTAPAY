# RestaPay Single Source of Truth Phase

This package removes dashboard/cost/report demo totals and calculates them from the current local collections:
- restapay.sales
- restapay-payroll
- restapay-invoices
- restapay-expenses
- restapay-vendors
- restapay-employees

All writes dispatch a `restapay:data-change` browser event so Dashboard, drawers, Food & Alcohol Cost, and Reports refresh immediately.
Fresh installs now start core record pages with empty collections instead of demo records.

Supabase writes remain disabled.
