# RESTAPAY RC6.24 Consolidated Enterprise UI

## Consolidation
- Combines the RC6.4-RC6.21 remote branch work with RC6.23 payroll group management and approved payroll editing.
- Keeps the latest dashboard sorting and sales subtotal work.
- Uses the resolved RC6.23 Payroll, Approved Payroll, Expenses, Date Controls, and global styling as the base.

## Dashboard home page
- Dashboard is now the default page every time the application starts.
- Clicking the RestaPay brand returns to Dashboard.
- Dashboard remains first and highlighted in navigation.

## Payroll group management
- Green + action creates another payroll group.
- Blue Edit action renames a group, changes default payment method, and updates permanent members.
- Red Delete removes a saved group without deleting payroll history.
- Save members to group makes temporary employee selections the group defaults.
- Automatic Kitchen group remains protected from deletion.

## Approved payroll editing
- One selected record opens the complete Edit Approved Payroll dialog.
- Multiple selected records open the batch payment/edit dialog.
- Every row has a visible Edit button.
- Approved amount, payment method, check number, status, paid date, and notes can be updated.

## Project-wide enterprise UI
- Unified compact typography, cards, panels, forms, inputs, buttons, tables, spacing, borders, and shadows.
- Consistent centered modal behavior with internal scrolling.
- Responsive spacing and modal sizing for smaller screens.
- Shared design rules apply throughout Dashboard, Employees, Payroll, Approved Payroll, Vendors, Invoices, Expenses, Sales, Reports, Menu pages, Import Center, Toast Integration, Settings, and Diagnostics.

## Build note
- Source validation and conflict-marker checks were completed.
- A production build could not be completed in the packaging environment because its private npm mirror did not contain one transitive package. The included PowerShell script performs a clean install and production build on the Windows computer before committing or pushing.
