# RC11 Cost Classification Corrections

This release keeps the existing RestaPay CSS and screen formatting intact while correcting food, alcohol, tax, and payroll allocation logic.

## Corrected

- AL-DEPT OF REV, Alabama Department of Revenue, AL ONESPOT, OneSpot, tax, license, and permit payments are excluded from Food and Alcohol purchase cost.
- Assistant Manager / Asistente Manager payroll is treated as Other Operating Payroll and is not split into Food or Alcohol.
- General/restaurant/store manager payroll continues to use the configured manager allocation rule (50% Food / 50% Alcohol by default).
- Bar Manager, Bartender, and Barback payroll is classified as Alcohol labor before generic manager matching.
- US Foods Margarita Mix line items are allocated to Alcohol Purchase Cost even when the invoice header/vendor category is Food.
- Expanded Margarita Mix matching includes Margarita Base, Marg Mix, Marg MX, Sweet & Sour, Sweet N Sour, Sour Mix, Bar Mix, concentrates, and syrups.
- Expanded beer and liquor/wine vendor/item matching.
- Negative invoice line items and credits now remain in department calculations so rebates and credits reduce purchase cost correctly.
- AI-extracted invoice line items receive a department-aware category suggestion without changing the existing invoice UI.

## Verified examples

- AL-DEPT OF REV with a legacy Liquor category -> Taxes & Licenses / Other Operating Expense.
- AL ONESPOT tax payment -> Taxes & Licenses / Other Operating Expense.
- US Foods `MARG MIX 4/1 GAL` -> Margarita Mix / Alcohol Purchase Cost.
- Asistente Manager -> Other Operating Payroll, not Manager Allocation.
- General Manager -> Manager Allocation according to Settings.

## Build verification

`npm run build` completed successfully.
