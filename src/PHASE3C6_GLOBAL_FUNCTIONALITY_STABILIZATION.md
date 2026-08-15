# Phase 3C.6 - Global Functionality Stabilization

- Made the global Apply date-range button functional.
- Added Today, Yesterday, This Week, Last Week, This Month, Last Month, This Quarter, Last Quarter, This Year, Last Year, and Custom Range.
- Weeks use Monday through Sunday.
- The selected range persists globally and updates live dashboard/report metrics plus Sales, Payroll, Expenses, Invoices, and Bank & Checks data.
- Added the global date toolbar to Invoices and Bank & Checks.
- Fixed the Expenses `selectedIds is not defined` crash and completed bulk delete state/actions.
- Invoice number is now optional. Vendor and invoice date remain required.
- Invoice, Expense, Sales, and Bank/Check save actions now wait for live persistence before reporting success.
- Hardened Payroll Groups against undefined group collections and retained the live employee list.
- Replaced the top-bar "Not Saved" placeholder with live Saved/Live/Save Failed status.
- Notification bell now responds and reports current save state.
- Disabled visual-only current-page/active controls rather than leaving them as inert buttons.
- Added `npm run test:ui`, which audits JSX buttons for inert controls and checks bulk-selection state declarations.
