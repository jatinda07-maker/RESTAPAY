# RC16 Smart Invoice Pack Extraction, Vendor Merge, and Navigation

- Extracts item number, brand, package size, case pack, unit size, and unit from AI invoice uploads.
- Parses common foodservice formats such as 2/20 LB, 4/10 LB, 12/750 ML, and 24/12 OZ.
- Calculates normalized cost per pound, liter, kilogram, gallon, or each for apples-to-apples vendor comparison.
- Prevents automatic creation of near-duplicate vendor names and offers a duplicate review message.
- Adds a Vendor Merge tool that reassigns invoices, invoice items, and expenses to the retained vendor.
- Organizes the left navigation into Overview, Purchasing, People, Operations, Menu & Toast, and System sections.
- Includes Supabase migration `RESTAPAY_RC16_INVOICE_PACK_FIELDS.sql` for the new invoice item fields.
