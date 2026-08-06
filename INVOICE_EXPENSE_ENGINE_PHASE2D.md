# RestaPay Invoice + Expense Engine Phase 2D

- Manual invoices now support editable line items, tax, discounts, payment details, check/reference fields, notes, and full recalculation.
- Spreadsheet invoice uploads parse line items locally into a review draft. PDF/image uploads create a review draft without writing to Supabase.
- Invoice line items feed Food & Alcohol Cost, Vendor Comparison, and Price Increase.
- Expenses support persistent custom expense types, vendor selection/addition, payment methods, references, recurring status, edit, and delete.
- Vendor Comparison uses normalized invoice-line price history.
- Price Increase shows lower prices in green and increases in red.
- Existing Supabase writes remain disabled. Old layout and styling files were not imported.
