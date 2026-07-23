# RC12.6.4 Toast Alcohol Category Total Fix

Toast Sales Category Summary is now authoritative for department revenue.

Alcohol includes only:
- BOTTLED BEER
- COCKTAILS & SHOTS
- DRAFT BEER
- MARGARITAS
- WINE

FOOD remains food revenue. No Sales Category Assigned remains unclassified/other revenue. Non-Grat Svc Charges remains excluded service-charge revenue.

Re-importing the same Toast workbook now replaces the prior rows from that file instead of appending duplicate or stale rows.

Verified against SalesSummary_2026-06-01_2026-06-30 (1).xlsx:
- Alcohol sales: $21,086.46
- Food sales: $64,651.96
- No Sales Category Assigned: $2,572.16
- Non-Grat Svc Charges: $698.58
- Toast net sales: $89,009.16
