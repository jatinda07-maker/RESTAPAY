# RC13.5 Toast Labor Import Reliability

- Added one shared Toast Labor parser used by both Payroll and Import Center.
- Detects the real header row even when Toast adds report titles or blank rows above the table.
- Searches labor, payroll, employee, time, and tips sheets instead of assuming the first sheet.
- Imports total/regular/overtime hours, hourly rate, wages/gross pay, cash and credit tips, withheld tips, net tips, job, date, and check/reference number.
- Excludes subtotal and grand-total rows.
- Preserves the row payroll date and source sheet.
- Re-importing the same labor file replaces its earlier imported rows instead of duplicating them.
- Import status now reports row count, hours, wages, net tips, and withheld tips for reconciliation.
- Includes an automated synthetic Toast workbook test.
