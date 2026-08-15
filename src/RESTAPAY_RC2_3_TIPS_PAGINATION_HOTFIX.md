# RESTAPAY RC2.3 — Exact Tip Withholding + Payroll Pagination

## Fixes
- Enforces exact 3.5% withholding on gross/original tips, rounded to cents.
- Example regression: $995.87 gross tips -> $34.86 withheld -> $961.01 net tips.
- Toast exported `Tips Withheld`/net-tip values no longer override RESTAPAY's 3.5% payroll rule.
- Manual payroll withheld/net fields are calculated read-only values.
- Weekly payroll recalculates 3.5% from aggregated gross tips rather than summing imported deductions.
- Supabase payroll writes canonicalize gross tips, 3.5% withheld, and net tips.
- Adds payroll table pagination: 25/50/100 rows, Previous, Next, page number, and visible range.
- Select All applies to the currently visible page.

## Validation
All available automated suites passed: core, sales, invoice, invoice duplicates, weekly payroll, kitchen weekly payroll, payroll bulk actions, financial reconciliation, live-release audit, UI audit, and RC2 combined regression.

The extracted ChatGPT workspace does not contain node_modules/vite, so run `npm run build` in the Windows RESTAPAY project after applying this replacement package.
