# RESTAPAY RC5 Payroll Rewrite

Only the Payroll module was rewritten. Other RESTAPAY pages and engines remain intact.

## Included
- Toast labor upload with start/end date selection
- One combined payroll row per employee for the selected period
- Employee search and select-all
- Editable hours, wages, overtime, tips, withholding, extra pay, reason, payment method, and check number
- Required extra-pay reason validation
- Duplicate period replacement by employee
- Pending and approved payroll register
- Manual payroll modal
- CSV export
- Compact, clutter-free payroll layout

## Verification
- Payroll.jsx parsed successfully with Babel JSX parser
- Toast labor daily-date tests passed
- Toast labor summary pay-period tests passed

The full Vite build could not run in the Linux packaging environment because the uploaded project contains Windows-only Rollup optional binaries. Run `npm install` and `npm run build` on Windows after extraction.
