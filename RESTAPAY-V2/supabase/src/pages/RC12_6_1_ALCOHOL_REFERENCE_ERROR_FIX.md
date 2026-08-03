# RC12.6.1 Alcohol Reference Error Fix

- Defined `explicitAlcoholSales` before the department-total reconciliation check.
- Alcohol now uses Toast category totals first, then Toast overall alcohol, then component totals.
- Rebuilt the production bundle to remove the blank-screen `ReferenceError`.
