# Payroll Engine V2

Replaced the Toast payroll flow with a daily-entry architecture.

## Replacement files
- `src/engine/ToastLaborEngine.js`
- `src/engine/PayrollEngine.js`
- `src/pages/Payroll.jsx`
- `src/components/PayrollDailyGrid.jsx`
- `src/components/PayrollWeekBuilder.jsx`

## Behavior
- Detects Toast payroll/labor tables in CSV, XLS, and XLSX workbooks.
- Uses actual business/shift dates when present.
- Converts period-only employee summaries into one row per employee per day.
- Uses imported daily sales as allocation weights when matching sales dates exist; otherwise uses an exact even allocation.
- Preserves weekly hours, wages, original tips, withheld tips, and net tips to the cent.
- Prevents duplicate employee/date/source-file imports.
- Keeps daily rows after weekly checks are built.
- Allows editing and deleting individual daily rows.
- Exports the filtered daily payroll register to CSV.
