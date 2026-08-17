# RESTAPAY RC3.9.3 - Payroll History Deduplication and Faster Save

This cumulative hotfix prevents duplicate Payroll History rows from reappearing after refresh and removes all logical duplicate copies in a single delete action.

## Changes
- Deduplicates payroll rows when live Supabase data is loaded.
- Deduplicates payroll rows before persistence.
- Payroll History hides exact logical duplicates while preserving legitimately different shifts/pay components.
- Single-row delete removes all exact duplicate copies and persists that deletion to Supabase.
- Bulk delete applies the same duplicate cleanup.
- Payroll persistence no longer scans/reconciles the entire Supabase payroll table on every edit. It directly deletes removed IDs and performs one batched upsert for the current payroll collection.
- Existing weekly rollup source restoration remains intact.

## Regression
Run `npm run test:rc393`.
