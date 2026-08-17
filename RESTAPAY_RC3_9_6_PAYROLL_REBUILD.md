# RESTAPAY RC3.9.6 - Payroll Rebuild

Rebuilds the weekly payroll flow around a Monday-Sunday source period and a single Sunday-dated payable row per employee.

## Rules
- Imported Toast daily labor remains source/audit data only.
- Build Weekly Payroll consolidates Monday-Sunday source rows into one weekly row per employee dated Sunday.
- The Ready to Pay tab/stage is removed from the weekly flow; created rows appear in Weekly Payroll.
- Weekly Payroll shows direct Mark Cash Paid, Mark Checks Paid, Mark All Paid, and per-row payment actions.
- Paid rows move to Payroll History.
- Weekly duplicate identity is employee + week start + week end + weekly source, not source_ids, preventing regenerated source-id sets from creating duplicate payable/history rows.
- On payroll load, exact historical weekly duplicates are collapsed and redundant Supabase payroll_entries IDs are removed.
- Source rows are marked rolled-up and remain available for audit but are excluded from payroll/P&L labor summaries, preventing source + weekly double counting.
- Payroll week remains Monday through Sunday and the weekly payroll date is Sunday.
- Payment amounts retain the RC3.9.5 truncate-to-cents rule.
