# RC12.3 Reconciled Drilldowns

Fixes included:

- Cash + Management Payroll popup now uses the same rows as the dashboard card.
- Cash Payroll, Manager, and Assistant Manager subtotals are shown separately.
- Popup subtotal now sums `total_pay` correctly instead of displaying $0.00.
- Every dashboard drilldown shows Clicked Total, actual Subtotal, and Difference/Reconciled status.
- Profit & Loss and Sales Performance rows are clickable and open matching detail popups.
- Food & Alcohol Cost popups now calculate their actual row subtotal instead of repeating the clicked total.
- Food/Alcohol profit reconciliation rows no longer double-count the profit result.
- Product Mix fallback uses normalized item department classification, so beer, wine, cocktails, shots, and margaritas are not left in Food when Toast's raw category is inconsistent.
- Existing design/CSS is preserved.

After installing, re-import the Toast Sales Summary once if old saved sales rows do not contain department category fields.
