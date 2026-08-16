# RESTAPAY RC3.8 — Access Control, Invoice Approval & Cash Ledger

## Included
- Owner/Admin and Manager access-control foundation.
- Manager navigation restricted to Reports, Sales, Import Center, and Invoices.
- Manager can upload/create invoices; edits to existing invoices are saved as Pending Admin Approval.
- Admin Approval Queue on Invoices with Approve/Reject actions.
- App data layer blocks manager edits/deletes to existing invoice records outside the approval flow.
- Persistent Supabase cash_ledger table.
- Cash Withdrawal history with Create / Edit / Delete.
- Cash withdrawals reduce Remaining Cash but do not become operating expenses.
- Cash Balance Adjustment / Set Closing Balance control, defaulting to $203 for the requested one-time reset.
- Cash carry-forward includes prior ledger withdrawals/adjustments.
- Payroll grouping keeps Management separate; Busser/Dishwasher stay BOH/Kitchen; Waiter/Server/Bartender/Host stay FOH.

## Supabase
Run the included migration before using approvals/cash ledger:

    npx supabase db push

The migration creates:
- app_user_roles
- invoice_edit_requests
- cash_ledger

## Notes
Authenticated Supabase users can be mapped through app_user_roles. When no Supabase Auth session exists, RESTAPAY preserves the current owner workflow by falling back to Admin rather than locking the owner out.
