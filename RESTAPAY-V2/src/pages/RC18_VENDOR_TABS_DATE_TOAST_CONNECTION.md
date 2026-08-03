# RC18 Vendor Workspace and Toast Connection Audit

## Vendor workspace
- Compact tabs: Vendor List, Add/Edit Vendor, Duplicate Review, Activity.
- Month-to-date date range by default.
- Presets: Today, Last Week, Last Month, This Month, All Dates.
- Vendor spend and activity totals reconcile from invoices and expenses in the selected range.
- Vendor list remains a master list; the selected range adds spend, invoice count, and last-activity context.
- Search and filters sit directly above the vendor table.

## Toast integration
- Added a four-stage connection audit:
  1. Browser to Supabase
  2. Render worker to Supabase
  3. Toast SFTP to Render worker
  4. Normalized Toast data availability
- The browser does not directly access the private Toast SFTP key.
- A recent successful `toast_import_runs` record and imported files prove the SFTP connection works.
- Added stale/failed/no-run states and last check time.

## Validation
- TypeScript transpilation syntax check passed for all source JavaScript/JSX files.
- Render log supplied by the user shows a successful production build and live deployment.
- Full Linux Vite build could not run against the uploaded Windows node_modules because Rollup's Linux native optional dependency is absent.
