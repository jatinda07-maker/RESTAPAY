# RESTAPAY RC3.9.20 — Operating Expense Deduplication + Tipped Employee PDF

- Operating Expenses exclude Food and Alcohol expense rows already represented by COGS.
- Operating Expenses exclude employee payroll/wage/tip expense rows already represented by Payroll; payroll tax remains an operating expense.
- Employee Payroll Total is employer wage/labor cost only and excludes customer tips.
- Cash employee payments still include actual tip payments for cash-balance reconciliation.
- Tipped employee preview/PDF uses canonical gross tips, exact 3.5% withholding, and canonical net tips instead of treating a generic `tips` field as gross tips.
- RC3.9.19 report payroll deduplication remains included.
