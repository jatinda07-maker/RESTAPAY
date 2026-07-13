# RC12.6.6 - Stale Toast Range Replacement

## Root cause
RestaPay had two independent Toast import parsers. The Sales page could retain an older partial import when a corrected Toast export was downloaded with a different filename such as `(1)`. The department engine then continued to use stale Food and Alcohol values.

## Fixes
- Sales page now uses the same verified `ToastSalesEngine` parser as Import Center.
- Corrected Toast imports replace every existing sales row in the same business-date range, even when the filename differs.
- Import Center applies the same date-range replacement behavior.
- DepartmentCostEngine deduplicates overlapping sales rows by business date and prefers rows containing the complete Toast Sales Category Summary arrays.

## Verified workbook totals
For `SalesSummary_2026-06-01_2026-06-30 (1).xlsx`:
- Food: $64,651.96
- Alcohol: $21,086.46
- Other / No Sales Category Assigned: $2,572.16
- Excluded / Non-Grat Service Charges: $698.58
- Total Toast Net Sales: $89,009.16

Alcohol includes Bottled Beer, Cocktails & Shots, Draft Beer, Margaritas, and Wine.

## Validation
- Actual workbook parser test: PASS
- Saved daily rows reconcile to category totals: PASS
- Vite production build: PASS
