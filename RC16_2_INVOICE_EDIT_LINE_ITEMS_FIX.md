# RC16.2 Invoice Edit Line Items Fix

- Normalizes Supabase `quantity` / `line_total` fields back to editor `qty` / `total` fields.
- Matches invoice IDs safely as strings.
- Loads invoice line items directly from Supabase if normalized app state is missing them.
- Supports legacy invoices with embedded `lineItems`.
- Preserves extracted pack, size, item number, brand, and normalized unit-cost fields.
- Displays the number of line items loaded when Edit is opened.
