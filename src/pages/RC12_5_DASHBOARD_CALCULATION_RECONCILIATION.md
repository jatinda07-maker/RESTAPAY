# RC12.5 Dashboard Calculation & Reconciliation

- Total Sales now comes only from imported Toast sales rows, preferring Toast Net Sales and using Toast Total/Gross only as a row-level fallback.
- Cash Collected supports Toast cash fields including Actual Closeout Cash.
- Cash Remaining subtracts cash operating payroll and cash-paid invoices/expenses; customer tips are excluded.
- Credit memos, rebates, returns, and vendor adjustments reduce invoice spend.
- Added gift, online, and other payment handling with a sales/payment reconciliation difference.
- Added Cash Needed when cash remaining is negative.
- Added Business Health strip for food cost, alcohol sales, margarita sales, labor, prime cost, profit, average check, and reconciliation status.
- Margaritas remain included in Alcohol through the existing Department Cost classifier.
- Added clickable Dashboard Reconciliation detail popup.
- Corrected tips-after-withholding logic in the shared BusinessEngine.

Validation: `npm run build` completed successfully.
