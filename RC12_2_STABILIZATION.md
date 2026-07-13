# RC12.2 Stabilization

- Persists Toast Food/Alcohol/Other/Excluded department totals and category detail arrays in `sales_days`.
- Prevents Product Mix combined totals from replacing Toast category totals after cloud reload.
- Adds a safe fallback that totals category arrays when scalar department totals are missing.
- Replaces the default Operating Payroll card with Cash + Management Payroll.
- Keeps Server Tips informational and excluded from profit calculations.
- Adds a reconciled payroll detail view.
- Includes a Supabase migration for existing projects.
