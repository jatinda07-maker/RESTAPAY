# RESTAPAY RC3 — Production Readiness Consolidation

RC3 consolidates the RC2.x acceptance fixes into a production-readiness pass.

## Payroll hardening
- Payroll Job/Duty now falls back to the Employees record when a payroll row has no job value.
- Employee matching uses employee ID first and employee name second.
- Missing duties display as `Unassigned` rather than a blank cell.
- Manual payroll saves update the visible Payroll tab immediately, while Supabase persistence completes in the background.
- Paid/payment status changes move rows immediately to the correct tab while Supabase sync completes.
- Exact 3.5% tip withholding remains the automatic rule.

## Validation
Run `npm run test:rc3` plus the existing payroll/UI/live-release regression suite before production integration.
