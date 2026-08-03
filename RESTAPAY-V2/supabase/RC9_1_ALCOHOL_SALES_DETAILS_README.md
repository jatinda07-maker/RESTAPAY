# RC9.1 Alcohol Sales and Department Detail Fix

This release preserves the existing RestaPay CSS, icon system, colors, spacing, and dashboard layout.

## Updated
- Alcohol sales now recognizes Product Mix items for beer, liquor, wine, margaritas, cocktails, shots, tequila, vodka, rum, whiskey, mezcal, mixed drinks, and common beer/cocktail names.
- Product Mix department totals are used when Toast Sales Summary does not provide a separate alcohol total.
- Food sales are corrected when a Toast summary places all net sales in a food field while Product Mix identifies alcohol sales.
- Beer purchases include beer-category items and beer vendor items.
- Liquor/wine purchases include ABC Store and all liquor/wine-classified vendors and products.
- Margarita mix and sweet/sour mix from US Foods are allocated to Alcohol Cost.
- Every row in Food & Alcohol Profitability is clickable and opens its related detail table.
- Detail tables include item sales, purchase records, payroll allocations, shared expenses, cost components, and profit summaries.

## Validation
- `npm run build` passed successfully.
