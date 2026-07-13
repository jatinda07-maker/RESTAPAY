# RC13.3 Dashboard Card Audit and Reconciliation

## Corrected dashboard card sources

- Total Sales: Toast Net Sales only.
- Cash Collected: Toast Payments Summary -> Cash Amount only. Actual Closeout Cash is excluded.
- Operating Profit: Toast Net Sales - vendor invoices - business operating expenses - operating payroll.
- Cash Remaining: Toast Cash Sales - cash operating payroll - cash vendor/business spending.
- Vendor Spend: invoice items and invoice headers only.
- Business Expenses: expense-table rows only; credit-card payments, transfers, loan principal and owner draws are excluded.
- Server Tips: customer/server tip payroll rows only and excluded from operating payroll/profit.
- True Food Cost: actual categorized food invoice line totals only.
- True Alcohol Cost: actual Beer + Liquor/Wine + Margarita Mix invoice line totals only.
- Prime Cost: Direct Food Cost + Direct Alcohol Cost + Operating Payroll. Customer tips are excluded.

## Drill-down corrections

Each dashboard card now opens its own matching detail dataset with a subtotal, clicked total and reconciliation difference. True Alcohol Cost no longer opens generic Vendor Spending Details.

## Verified against June Toast workbook

- Toast Net Sales: $89,009.16
- Toast Cash Sales: $16,783.21
- Toast Credit Sales: $76,266.74
- Food Sales: $64,651.96
- Alcohol Sales: $21,086.46

Automated Toast category/payment reconciliation passed. Actual line-item costing test passed. Production Vite build passed.
