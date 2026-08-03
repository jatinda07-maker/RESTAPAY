# RC11.8 Toast Category Totals, Popup Drilldowns & Date Filters

## Verified against uploaded Toast Sales Summary (2026-06-01 to 2026-06-30)

- Food: $64,651.96
- No Sales Category Assigned: $2,572.16
- **Food Sales: $67,224.12**

- Bottled Beer: $1,473.50
- Cocktails & Shots: $1,782.20
- Draft Beer: $2,413.99
- Margaritas: $15,362.77
- Wine: $54.00
- **Alcohol Sales: $21,086.46**

- Non-Grat Service Charges (excluded): $698.58
- Reconciled Toast Net Sales: $89,009.16

## Changes

- Toast Sales Category Summary is now the primary Food/Alcohol source.
- Product Mix is only a fallback and no longer mixes into department totals when summary totals exist.
- Food = FOOD + No Sales Category Assigned.
- Alcohol = Bottled Beer + Cocktails & Shots + Draft Beer + Margaritas + Wine.
- Non-Grat Service Charges are excluded from Food and Alcohol.
- Added Today, Last Week, Last Month, This Month, All Dates, and custom date range controls.
- Every Food/Alcohol cost-page total opens a modal showing matching source rows and a subtotal.
- Added reconciliation status in each popup.
- Refined typography to be crisper and less bold.
- Added header-only green/purple background colors.
