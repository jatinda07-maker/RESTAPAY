# RC17.3 Duplicate, Vendor List, Search, and Recipe Fix

- Removed the duplicate Vendor Comparison hero because the global page header already provides the title and description.
- Removed the duplicate Vendor Comparison module from the Vendors page; the dedicated Vendor Comparison navigation page remains the single comparison workspace.
- Vendor List now combines vendors from vendor records, invoices, invoice line items, and expenses, normalizes similar names, sorts A-Z, shows a visible total, adds Show All, and uses a scrollable full list.
- Search fields use a lighter borderless appearance and clear when focused by click or Tab.
- Recipe editing now offers every edible US Foods/US Foodservice invoice item as a selectable ingredient, including package/unit and calculated unit cost.
- Global duplicate page-title blocks are hidden where the main application header already displays the same title.

Validation: 36 JS/JSX files passed TypeScript syntax transpilation with zero errors. Full Vite build must be run on Windows because the available node_modules contains Windows-native dependencies.
