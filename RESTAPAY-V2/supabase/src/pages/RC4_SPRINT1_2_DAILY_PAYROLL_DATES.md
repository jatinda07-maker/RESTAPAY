# RC4 Sprint 1.2 - Toast Daily Payroll Dates

## Fixes
- Imports Toast labor rows by actual business date.
- Groups duplicate shift rows by employee + business date.
- Keeps tip-paid managers and other tipped employees intact.
- Calculates 3.5% withholding for each dated employee row.
- Prefers dated daily labor detail over duplicate employee-summary rows.
- Preserves the overall Toast report period for audit/reference.
- Recognizes additional Toast date headings such as Business Day, Shift Date, Date Worked, Work Date, and Clock In Date.

## Verification
- Automated daily-date import test passed.
- Production Vite build passed (1,655 modules).

## Important
Final verification should also be performed with the exact Toast Labor Summary workbook used by the restaurant, because Toast export layouts can vary by report type and account configuration.
