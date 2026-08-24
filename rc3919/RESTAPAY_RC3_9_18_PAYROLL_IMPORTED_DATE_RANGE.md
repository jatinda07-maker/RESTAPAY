# RESTAPAY RC3.9.18 Payroll Imported Date Range

- Imported Daily Labor now has its own visible From/To date range controls with Apply Range.
- The page-level DateToolbar and imported-labor range both drive the same global payroll range.
- Toast/imported payroll rows are filtered using payroll/work dates, including pay_date, payroll_date, business_date, work_date, shift_date, clock date, period end, and payroll week end.
- Undated records no longer leak into every selected date range through created_at fallback.
- Payroll History now obeys the selected date range too.
- After a Toast labor import, Payroll switches to Imported Labor and sets the active range to the imported file's actual min/max payroll dates.
- Payroll KPI cards now recalculate from the active Payroll tab and selected date range, including Imported Labor.
