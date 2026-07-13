# RC13 Toast Category Engine and Food/Alcohol Cost UI

## Verified Toast totals (June 1-30, 2026)
- FOOD: $64,651.96
- Alcohol total: $21,086.46
  - BOTTLED BEER: $1,473.50
  - COCKTAILS & SHOTS: $1,782.20
  - DRAFT BEER: $2,413.99
  - MARGARITAS: $15,362.77
  - WINE: $54.00
- No Sales Category Assigned: $2,572.16
- Non-Grat Svc Charges: $698.58
- Toast Net Sales: $89,009.16

## Changes
- Normalized Supabase tables now override stale app_data transactional sales during cloud loading.
- Toast category rows are mirrored to toast_sales_categories using the RC12 schema.
- Food & Alcohol Cost reads normalized Toast category rows as its primary source.
- app_data remains a full backup but can no longer override newer normalized Toast sales.
- Food header uses a light solid green treatment; Alcohol header uses solid orange.
- Added department and line-item icons.
- Bottom total rows use lighter translucent versions of their header colors.
- Food Sales no longer includes No Sales Category Assigned.

## Verification
The uploaded June Toast workbook was run through ToastSalesEngine and DepartmentCostEngine.
The calculation test returned Food $64,651.96, Alcohol $21,086.46, and Net Sales $89,009.16.
The production Vite build completed successfully.
