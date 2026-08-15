# RESTAPAY RC2.4 Kitchen Payroll + Next Week Hotfix

## Fixes
- Kitchen weekly payroll saved to Supabase is immediately visible in Ready to Pay even when its week end falls outside the current global payroll date range.
- After kitchen payroll save, the global payroll range expands to include the saved kitchen payroll date instead of hiding the new records.
- Build Weekly Payroll / Build Another Week now derives the next Monday-Sunday period from the latest saved non-kitchen weekly payroll end date.
- Next week starts exactly one day after the prior saved week end and ends six days later.
- Automatic next-week preparation after Save Payroll uses saved weekly rollups only, preventing manual/kitchen rows from choosing the wrong base week.

## Validation
Passed:
- test:weekly-payroll
- test:kitchen-weekly-payroll
- test:payroll-bulk-actions
- test:rc2-combined
- test:ui
