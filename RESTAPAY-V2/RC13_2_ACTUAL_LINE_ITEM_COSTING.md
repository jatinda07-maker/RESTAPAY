# RC13.2 Actual Line-Item Costing

- Food and alcohol direct cost now comes only from Supabase invoice line items, with invoice-header fallback only when an invoice has no lines.
- General expenses, bank payments, credit-card payments, loans, transfers, owner draws, taxes, and licenses cannot be classified as food or alcohol inventory cost.
- BANK OF AMERICA expense rows are explicitly excluded from alcohol COGS even when legacy category data says Liquor.
- Cost drilldowns now show Supabase source, cost category, vendor/employee, actual invoice line item, and line total.
- True Food Cost and True Alcohol Cost popups now display the actual underlying rows whose subtotal equals the card total.
- Verified automated test: $100 beer + $200 liquor/wine + $50 margarita mix = $350 direct alcohol cost; $1,500 BANK OF AMERICA expense excluded.
- Production Vite build completed successfully.
