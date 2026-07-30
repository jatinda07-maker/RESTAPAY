# RESTAPAY RC6.23 - Merged Payroll Groups and Approved Payroll Editing

This consolidation release resolves the pulled `main` changes against the `rc5-redesign` work and includes the latest payroll update.

## Payroll group management

Inside the Kitchen Payroll Group popup:

- Green `+` creates a saved payroll group.
- Blue **Edit** renames a saved group, changes its default payment method, and updates permanent members.
- Red **Delete** removes only the saved group and does not delete payroll history.
- **Save members to group** stores temporary employee-selection changes as the saved group defaults.
- The automatic Kitchen group remains protected from editing and deletion.

## Approved Payroll editing

- Select one record and click **Edit Approved Payroll** to open the full edit dialog.
- Select multiple records to open the batch payment/edit dialog.
- Every row has a visible **Edit** button.
- Editable fields include approved amount, payment method, check number, status, paid date, and notes.

## Merge resolution

Resolved source conflicts in:

- `src/components/DateControls.jsx`
- `src/pages/Expenses.jsx`
- `src/pages/Payroll.jsx`
- `src/styles.css`

The incoming professional Expenses layout and CSV export were retained while the latest compact date control and payroll functionality were preserved.

## Validation

- No unresolved Git conflict markers remain in application source files.
- Modified JSX files passed Babel syntax parsing.
- A complete Vite production build could not run in the packaging environment because the uploaded Windows `node_modules` did not contain Rollup's Linux native optional package. Run `npm install` and `npm run build` on Windows before pushing.
