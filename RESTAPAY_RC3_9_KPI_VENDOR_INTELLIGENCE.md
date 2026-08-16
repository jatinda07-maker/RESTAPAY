# RESTAPAY RC3.9 - KPI Re-Audit + Vendor Price Intelligence

This cumulative release builds on RC3.8.3 and includes the changes discussed on 2026-08-16.

## Included
- Full KPI detail mapping re-audit for vendor, invoice, payroll, employee, price-comparison and Food/Alcohol cards.
- Derived Food/Alcohol KPIs now render calculation components instead of misleading `0 entries` screens.
- True Food Cost / True Alcohol Cost / Food Profit / Alcohol Profit show their component math for the selected period.
- Vendor price memory uses normalized item identity and comparable unit/quantity rather than raw invoice package price.
- Best Vendor Matches requires comparable multi-vendor history.
- Potential Savings is calculated against the latest comparable quantity.
- Vendor Comparison covers food, alcohol, kitchen supplies and all other invoice-line categories.
- Sam's Club online benchmark button with a best-effort Supabase Edge Function and safe fallback to Sam's search.
- Online benchmark values stay separate from internal vendor history because club/member/location pricing may differ.
- Smart AI Upload gets a purple emphasized hover treatment.
- Employee summary cards use the approved role grouping: Kitchen/Busser/Dishwasher = BOH, Waiter/Bartender = FOH, Manager separate.
- Carries forward RC3.8.3 Admin/Manager navigation recovery, Admin PIN, report subtotals, report PDF/print fixes, cash ledger, approvals and labor classification.

## Online benchmark limitation
The Sam's Club checker is a best-effort public-web benchmark. Sam's may block automated requests or show different prices by club/member/fulfillment method. If automatic extraction is unavailable, RESTAPAY opens a matching Sam's Club search for verification. Online prices are never silently promoted above internal invoice history without a comparable item/unit match.
