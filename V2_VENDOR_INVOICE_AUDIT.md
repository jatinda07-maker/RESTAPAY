# RESTAPAY V2 Vendor and Invoice Mockup Rebuild

## Changed
- `src/pages-v2/VendorsV2.jsx`
- `src/pages-v2/InvoicesV2.jsx`
- `src/styles-v2/app.css`

## Verified by source audit
- Vendor V2 no longer imports or renders `LegacyVendors`.
- Invoice V2 no longer imports or renders `LegacyInvoices`.
- Dashboard files were not changed.
- `AppShellV2.jsx` and navigation files were not changed.
- No merge-conflict markers were found in the changed page files.
- Vendor CRUD, filters, pagination, summary cards, and popup are connected to existing `data` / `setData`.
- Invoice CRUD, filters, pagination, summary cards, popup, and file selector are connected to existing `data` / `setData`.
- Invoice deletion also removes related `invoiceItems`.
- Approved upload-bar background was made slightly darker only inside `.rv2-mock-page`.

## Build status
A production build could not be run in this environment because the internal npm registry returned 404 for `@vitejs/plugin-react`. Run `npm install` and `npm run build` locally before merging.
