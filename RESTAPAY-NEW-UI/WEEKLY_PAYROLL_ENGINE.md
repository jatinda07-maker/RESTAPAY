# Weekly Payroll Engine

- Payroll weeks run Monday through Sunday.
- The user selects the Monday start date; the Sunday end date is filled automatically.
- Daily/imported entries in the selected range are grouped into one row per employee.
- Hours, base pay, original tips, tips withheld, net tips, and extra pay are totaled.
- The generated payroll entry uses Sunday as the payroll date.
- Source daily rows remain stored for audit but are marked as rolled up so dashboard and payroll totals do not double count them.
- Rebuilding the same week replaces that week's prior rollup.
- Deleting a weekly rollup restores its original daily entries.
