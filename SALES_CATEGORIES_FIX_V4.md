# RESTAPAY Toast Sales Categories Fix v4

This update keeps the successful v3 Toast sync fixes and adds a reliable fallback for `toast_sales_categories`.

## What changed

- AccountingReport category extraction remains the preferred source.
- When no category rows exist for a business date, the sync rebuilds them from `toast_product_mix`.
- Product Mix rows are paged in batches so more than 1,000 rows are included.
- Categories are grouped by Toast Sales Category and mapped to Food, Alcohol, or Other.
- Daily summaries are refreshed after category generation.
- The fallback also runs for unchanged/skipped dates, so the next sync can repair existing dates without re-downloading all files.

## Expected result after deployment and one sync

- `error_count: 0`
- `progress_percent: 100`
- `toast_sales_categories: greater than 0`
- Food and Alcohol sales totals available to dashboard summaries.
