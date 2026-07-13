# RC12.6.5 Import Center Toast Reconciliation

Root cause fixed: Import Center previously parsed the Sales category summary, but discarded Food/Alcohol/Other/Excluded category totals whenever the Toast workbook also contained Sales by day rows.

Fixes:
- Added a shared pure Toast category parser.
- Distributes exact Toast category totals across daily rows using net-sales weights.
- Preserves category detail arrays on every saved daily row.
- Re-importing the same source filename replaces older incomplete rows.
- Added an automated test against SalesSummary_2026-06-01_2026-06-30 (1).xlsx.

Verified totals:
- Food: $64,651.96
- Alcohol: $21,086.46
- No Sales Category Assigned: $2,572.16
- Non-Grat Service Charges: $698.58
- Toast Net Sales: $89,009.16

Production build completed successfully.
