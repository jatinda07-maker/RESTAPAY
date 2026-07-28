# RC5 Payroll Calculation Repair

## Root cause found
The saved Toast Payroll Builder rows contained hours, but `regular_pay`, tips, and final payroll were stored as zero. The page displayed those stale stored values without recalculating wages from the employee hourly rate. In addition, older employee records often store the hourly rate in `base_pay`, even when `pay_type` is blank or inconsistent.

The uploaded Toast source represented hours-only data. A Toast Shifts Closed report does not provide credit-card tips or wage amounts, so those values cannot be invented from hours alone.

## Corrections
- Resolve hourly rate from `hourly_rate`, `pay_rate`, `rate`, or legacy `base_pay`.
- Calculate missing regular wages as hours x employee hourly rate.
- Calculate final tips from original credit-card tips minus withholding.
- Calculate final payroll as regular wages + overtime + final tips + extra pay.
- Apply the same formula to summary cards, payroll table, and CSV export.
- Added a Payroll Source Check warning.
- Added Recalculate from Employee Rates to repair saved rows in the selected range.
- Clearly warns when the imported Toast report has no credit-card tip data and requests a Labor Summary report.

## Important
Tips remain zero when the source file has no Non-Cash Tips or Credit Card Tips column. Import Toast Labor Summary for correct tips.
