# RestaPay RC12 — Toast Automation Foundation

This release completes the database and worker foundation required by the Toast Integration screen.

## Included

- Complete Supabase Toast schema
- Secure Render cron service definition
- Multi-day SFTP scanning
- File-hash duplicate protection
- Raw export archive
- Normalized sales category, sales summary, Product Mix, labor, payments, checks, cash-management, menu, merchant-fee, and daily-summary tables
- Food/Alcohol department mapping from Toast categories
- `No Sales Category Assigned` mapped to Food
- Merchant processing fees mapped to operating expenses when available
- Tips stored as pass-through and excluded from labor/profit in the daily summary
- Improved Toast Integration status page with schema status, import history, daily summary, and merchant-fee details

## Required after installation

Run `supabase/RESTAPAY_RC12_TOAST_AUTOMATION.sql` in Supabase SQL Editor before triggering the worker.
