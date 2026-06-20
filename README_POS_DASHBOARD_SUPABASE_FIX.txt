RESTAPAY POS dashboard + Supabase persistence fix

Fixes:
- Dashboard replaced with POS-style no-graph layout from the approved design.
- Dashboard totals use deduped expense rows to prevent Insurance/Mortgage/property double counting.
- P&L uses the same deduped totals.
- Price increase alerts compare normalized unit price only and suppress false line-total comparisons like +8100%.
- Supabase cloud persistence made visible and more reliable.
- Adds cloud status badge: Cloud loading / Cloud loaded / Cloud saved / Cloud error.
- If Supabase is empty but browser local data exists, the app seeds Supabase automatically.
- Adds SUPABASE_APP_DATA_SETUP.sql to create app_data table and RLS policies.

Important:
- If dashboard still shows $0.00 after this deploy, Supabase has no data yet or the app_data table/RLS is missing.
- Run SUPABASE_APP_DATA_SETUP.sql in Supabase SQL Editor once.
- Then add/import data or use the browser that still has local data so it can seed cloud.

Validation:
- Node syntax check passed.
