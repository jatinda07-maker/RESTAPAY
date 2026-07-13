# RC11.2 Food and Alcohol Sales Drilldown Reconciliation

## Corrections
- Food Sales and Alcohol Sales **Open Screen** now navigate to the Sales page, not Menu Costing.
- The Sales page opens a filtered Product Mix detail report for the selected department and dashboard date range.
- The detail report total is calculated directly from the displayed Product Mix rows.
- Toast's original category remains visible for audit purposes, while a normalized department category is shown separately.
- Alcohol classification includes beer, draft beer, liquor, wine, margaritas, cocktails, shots, and named spirits.
- Every non-alcohol Product Mix item is assigned to Food so rows cannot be counted twice and Food + Alcohol reconciles to classified Product Mix sales.
- Added department and Product Mix reconciliation values to the cost engine.

## UI
The existing CSS, colors, navigation icons, and dashboard layout are preserved. Only a department detail table was added to the existing Sales screen.

## Build
`npm run build` completed successfully.
