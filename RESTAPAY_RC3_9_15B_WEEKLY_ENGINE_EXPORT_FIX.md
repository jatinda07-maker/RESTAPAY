# RESTAPAY RC3.9.15B Weekly Payroll Engine Export Fix

Fixes the runtime /src WeeklyPayrollEngine mismatch that caused Vite build errors for missing exports:
- buildHistoricalPayrollRepair
- isWeeklyPayrollRecord
- weeklyPayrollEnd

The complete current WeeklyPayrollEngine is now placed in src/core/engines/WeeklyPayrollEngine.js.
