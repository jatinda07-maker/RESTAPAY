# RESTAPAY RC3.9.7 - Historical Payroll Repair

This release adds a controlled historical payroll repair workflow on top of RC3.9.6.

## Repair workflow
- Admin opens Payroll -> Repair Payroll Week.
- Select a Monday through Sunday payroll week.
- RESTAPAY rebuilds imported Toast labor into one Sunday payroll row per employee.
- Existing Kitchen/Cash weekly records are consolidated into one Sunday row per employee.
- Repeated duplicate components are discarded while one legitimate distinct extra-pay component is preserved.
- The preview shows Check total, Kitchen/Cash total, corrected total, existing corrupted weekly total, and duplicate inflation removed.
- Imported daily source rows remain in Supabase as audit-only source data.
- Applying the repair replaces only the weekly/payroll-history rows for the selected week.

## Aug 3-9 regression
TOMMY week ending 2026-08-09 is covered by the regression fixture:
- Regular pay: $700.00
- Legitimate extra pay: $25.00
- Correct one-row weekly total: $725.00 Cash
- Repeated $25 copies are not added again.

## Safety
The repair is blocked if Kitchen historical components are ambiguous enough to require review. The current working Aug 10-16 payroll flow is not modified by the repair.
