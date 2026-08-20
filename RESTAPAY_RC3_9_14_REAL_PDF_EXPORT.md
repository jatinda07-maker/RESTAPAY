# RESTAPAY RC3.9.14 - Real PDF Export

- Replaces placeholder Report PDF buttons with real client-side PDF generation.
- Standard reports export actual live Sales, Payroll, Vendor/Expense data for the selected date range.
- Custom Restaurant Report exports the same visible sections, subtotals, report period, cash balance, and P&L summary.
- PDF generation uses jsPDF + AutoTable and downloads a real `.pdf` file; it does not depend on `window.print()` or a blank popup.
- Existing Print action remains available separately.
