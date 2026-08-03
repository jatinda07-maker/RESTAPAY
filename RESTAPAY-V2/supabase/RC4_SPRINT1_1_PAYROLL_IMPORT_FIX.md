# RC4 Sprint 1.1 - Toast Payroll Import Fix

## Corrected
- Uses the Toast labor report date range instead of the file upload date.
- Stores the Toast period start/end on imported payroll rows.
- Uses the report end date as the payroll date when Toast has no per-row work date.
- Existing employee pay type, payment method, job type, and assignment override generic Toast inference.
- Managers are no longer automatically classified as tipped employees.
- Server tips remain separate from regular wages.
- Displays Regular Pay, Original Tips, 3.5% Withheld, Final Tips, Extra Pay, Final Check, Pay Type, Payment Method, and Check Number during review.
- Fixes double subtraction of tip withholding from final pay.

## Verification
- Automated Toast labor parser test passed.
- Vite production build passed (1,655 modules transformed).
