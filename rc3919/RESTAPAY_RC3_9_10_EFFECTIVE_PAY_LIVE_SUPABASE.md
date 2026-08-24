# RESTAPAY RC3.9.10 — Effective Pay Rates + Project-Wide Live Supabase

- Adds `employee_pay_rates` with effective dates so future pay changes never rewrite historical payroll.
- Employee page exposes **Change Pay Rate**, effective payroll week, reason, and pay-rate history.
- Kitchen weekly payroll resolves the latest rate effective on or before the Monday payroll-week start.
- Adds `app_settings` so accounting/business configuration (cost allocation, categories, expense types, labor classification) is stored in Supabase rather than browser-only state.
- Keeps RC3.9.9 optimistic row-level writes and one persistent Supabase Realtime connection across page navigation.
- Historical payroll rows remain immutable unless the user explicitly edits/repairs a historical record.
