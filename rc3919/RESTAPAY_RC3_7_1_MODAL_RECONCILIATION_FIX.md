# RESTAPAY RC3.7.1 - Modal Entry Reconciliation Fix

This patch makes financial detail drawers use the same source records that produced each displayed value.

## Fixed
- True Food Cost entries now use direct food invoice lines, kitchen/BOH payroll, Food manager allocation, and Food shared-cost allocations only.
- Waiters/servers/FOH rows no longer appear in True Food Cost or Operating Labor entries.
- True Alcohol Cost entries use direct alcohol invoice lines, bar payroll, Alcohol manager allocation, and Alcohol shared-cost allocations.
- Supplies Allocation drill-downs show the source expense, allocation percentage, and allocated amount instead of returning zero records.
- Shared Costs drill-downs no longer double-count Supplies when Supplies has its own Food row.
- Manager Allocation entries show the actual Food/Alcohol allocated amount from each manager payroll record.
- Payroll job-type drill-downs use the employee-enriched job classification used by payroll summaries.
- Front of House, Management, Operating Labor, Unmapped, and Tip Pass-Through entries resolve from the same classified payroll rows as their displayed totals.
- Tip Pass-Through remains audit-visible and excluded from operating labor/Prime Cost.
- Prime Cost and Labor Mix now use BOH/kitchen Operating Labor for the approved RESTAPAY KPI definition; management is handled through department allocation and FOH/tips remain separate.
- Total Hours drill-down displays hours per payroll row instead of dollar values.
- Food/Alcohol sales drill-downs use department sales rows from the same department-cost engine when available.
- Drawer row clicks carry parent KPI context, so a generic label like Manager Allocation resolves correctly for Food vs Alcohol.

## Regression
Run:

    npm run test:rc371
    npm run test:rc37
    npm run test:tip-pass-through
    npm run test:financial-reconciliation
    npm run test:rc351
    npm run test:rc35
    npm run test:rc34
    npm run test:ui
    npm run build

The build must be run after installing dependencies; the packaging environment did not include node_modules.
