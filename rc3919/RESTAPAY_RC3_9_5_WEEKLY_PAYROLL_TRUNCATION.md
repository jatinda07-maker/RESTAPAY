# RESTAPAY RC3.9.5 - Weekly Payroll Truncation Hotfix

- Weekly Payroll now keeps tip withholding at full calculation precision.
- Actual payroll/check payment amounts are truncated to two decimals, never rounded up.
- Exact regression: $758.98 tips - $26.5643 withholding = $732.4157 -> $732.41 paid.
- The employee selector and Weekly Payroll Preview render the already-truncated weekly payment total instead of recomputing and rounding it.
- The created weekly-rollup row carries the same $732.41 into normalization, Ready to Pay, Payroll History, reports, and Supabase persistence.
- Imported daily labor remains the source data and should not be deleted before rebuilding weekly payroll.
