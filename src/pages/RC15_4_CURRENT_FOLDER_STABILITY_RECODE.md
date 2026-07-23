# RC15.4 Current Folder Stability Recode

This release was made directly from the user-uploaded current RESTAPAY-GIT folder.

## Fixed
- Vendor Comparison build failure caused by invalid DateEngine imports.
- Vendor Comparison remains a dedicated left-navigation page.
- Payroll duplicate date preset controls removed.
- Payroll search icon, text, placeholder, and dropdown alignment normalized.
- Search fields clear on focus/click/Tab using React-compatible native input events.
- Payroll KPI cards and filters made compact and consistently aligned.
- Menu Costing KPI cards aligned in a responsive grid with white icons.
- Menu Costing recipe editor is hidden when Recipes or Vendors tabs are selected, so tabs visibly change content.
- Search fields on Sales, Payroll, Menu Costing, Menu Intelligence, and Vendor Comparison use the same focus behavior.

## Validation
- All 36 JavaScript/JSX source files passed Babel syntax parsing.
- The previous Vite compile error in VendorComparison.jsx is removed.
- A full Vite build could not run in the Linux packaging environment because the uploaded node_modules contains Windows-native Rollup/esbuild binaries. Run npm install and npm run build on Windows.
