# RESTAPAY RC2.8 Vendor Cleanup + Date Picker Hotfix

- Vendor selectors now use one normalized, de-duplicated A-Z source.
- Newly added vendors refresh from Supabase immediately.
- Vendors page includes Review Similar Vendors.
- Duplicate review supports Merge Into Existing, Override Existing, or intentional Create Separate.
- Merge/override reassigns linked invoice and expense vendor references and writes an audit note to the canonical vendor.
- Vendor type/category/expense-type options remain A-Z.
- Clicking anywhere on a date field/label opens the native date picker across the app when supported by the browser.
- Adds RC2.8 regression coverage while preserving RC2.7 compatibility checks.
