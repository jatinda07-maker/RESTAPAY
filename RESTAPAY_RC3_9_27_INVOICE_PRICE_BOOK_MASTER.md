# RESTAPAY RC3.9.27 - Invoice-Driven Price Book Master

- Price Book is rebuilt from all saved invoice lines, independent of the active report date range.
- Each normalized item can be assigned a category from the Price Book.
- Admin can add new categories directly from the Price Book; categories persist through the existing live settings/Supabase path.
- Editing a Price Book item can change the master display name and category across every matching saved invoice line.
- Changed historical rows retain `original_description` and a `price_book_updated_at` audit marker.
- Bulk select allows one category to be applied across multiple Price Book items and all their matching saved invoice entries.
- Future invoice uploads continue using learned category history.
