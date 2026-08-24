# Phase 3D.1 - Global KPI Date Range + Gemini Health Check

- KPI/detail drawers now open using the currently applied global/page date range.
- Every KPI/detail drawer can switch to Today, Yesterday, This Week, Last Week, This Month, Last Month, This Quarter, Last Quarter, This Year, Last Year, or a Custom Range.
- Drawer Apply recalculates only that drill-down while preserving the page/global range.
- Dashboard and all pages that use DetailDrawer inherit this behavior automatically.
- `useAppData` now accepts an optional date-range override for drill-down calculations.
- Settings now has an Integrations tab showing Supabase readiness and a Test Gemini button.
- `gemini-invoice` Edge Function now supports a safe health-check request that confirms the server-side Gemini secret is configured without exposing it.

No layout JSX or styling files were changed in this phase.
