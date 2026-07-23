# RC4 Payroll Period Calculation Fix

Reference file: `PayrollExport_2026_07_01-2026_07_19.csv`

## Corrected behavior

- A Toast Payroll Export that has no business-date column is treated as one pay-period summary row per employee.
- It is no longer divided evenly across every calendar date, which previously created nearly identical daily checks.
- Original Tips come from Toast `Total Tips`.
- Tips Withheld come from Toast `Tips Withheld` when present; otherwise the configured withholding percentage is used.
- Final Tips = Original Tips - Tips Withheld.
- Final Check = Regular Pay + Final Tips + Extra Pay.
- Extra Pay can be entered during import review or later through Edit Payroll.
- Payment type can be selected as Cash, Check, ACH, Card, or Other.
- Reimporting the same summary period replaces prior Toast rows for those employees in that period instead of stacking duplicates.

## Reference result for Lucas H

- Original Tips: $4,123.43
- Tips Withheld: $143.91
- Final Tips: $3,979.52
- Final Check before wages or extra pay: $3,979.52
