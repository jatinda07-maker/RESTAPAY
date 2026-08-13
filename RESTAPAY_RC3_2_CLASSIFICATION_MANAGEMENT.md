# RESTAPAY RC3.2 - Classification Management

This cumulative RC3.2 patch makes Expense Types and Categories centrally manageable from Settings and uses the shared active lists in Vendors, Expenses and Invoices.

## Included

- Expanded Expense Type defaults including Payroll Tax, Sales Tax, Business License, Alcohol License / Liquor License, Bank Charges and Service Charges.
- Settings > Classifications for Expense Types and Categories.
- Add, rename, merge, activate and deactivate controls.
- Usage counts and confirmation warnings before changing classifications already used by vendors, expenses or invoices.
- Linked records are reassigned during rename/merge.
- Vendor bulk selection can apply Category and Expense Type to selected vendors.
- Add Vendor reads the shared classification lists rather than its former hard-coded short list.
- Expenses and Invoices read the same shared lists.
- A-Z classification ordering and case-insensitive duplicate prevention.
- Dark contrast treatment for the right-side top bar only; left navigation remains unchanged.

## Validation

Run `npm run test:rc32`, `npm run test:rc31`, `npm run test:rc3-invoice`, `npm run test:rc3`, `npm run test:ui`, then `npm run build`.
