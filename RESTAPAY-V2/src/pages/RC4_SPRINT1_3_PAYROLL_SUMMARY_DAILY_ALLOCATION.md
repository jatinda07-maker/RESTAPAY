# RC4 Sprint 1.3 - Payroll Summary Daily Allocation

- Reads the payroll period from Toast payroll export filenames such as `PayrollExport_2026_07_01-2026_07_21.csv`.
- When the file has no Business Date column, expands each employee summary into one row per date in the payroll period.
- Allocates hours, wages, tips, and Toast Tips Withheld across the dates while preserving the exact source totals.
- Keeps tipped managers and assistant managers as tipped employees.
- Files that contain real Business Date rows continue to use those real dates and are not reallocated.
- Verified against the supplied July 1-21 payroll export: 8 employees, 21 dates, 168 daily rows; totals reconcile exactly.
