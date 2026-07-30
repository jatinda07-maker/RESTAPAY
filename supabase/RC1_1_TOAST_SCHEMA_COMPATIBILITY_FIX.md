# RESTAPAY RC1.1 Toast Schema Compatibility Fix

## Fixed
- Removed the unsupported `raw` field from every write to `toast_sales_categories`.
- Kept `raw` data for normalized tables whose schema supports it.
- Preserved conflict-safe category upserts on `business_date,category_name,source_file`.
- Preserved Product Mix fallback repair for dates where sales categories are missing.

## Why the sync failed
The deployed Supabase table `toast_sales_categories` does not contain a `raw` column. The category repair introduced in v4 inherited `raw` from the shared base record, causing PostgREST to reject the write.

## Deploy
Replace `server/src/syncToastJob.js`, commit, push to `clean-main`, and wait for Render to redeploy.
