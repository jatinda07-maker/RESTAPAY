# RESTAPAY RC3.9.8 — Cumulative Data Repair + Invoice Learning + Assistant

- Historical payroll repair now recognizes legacy weekly rows even when the old `weekly_rollup` flag is missing.
- Aug 3–9 repair removes all legacy Sunday payable components and rebuilds one authoritative Sunday record per employee.
- Kitchen repair preserves one legitimate extra component (TOMMY: $700 + $25 = $725) while discarding repeated copies.
- Payroll History only displays weekly payable records; imported Toast shifts remain audit-only.
- Payroll column filters share one deterministic AND-filter engine and pagination is based on the filtered result.
- Invoice reconciliation derives Product Total from authoritative final-total math when an extracted Product Total is inconsistent (US Foods: $3,775.54 + $9 + $2.54 = $3,787.08).
- Printed Product Total is editable during invoice review.
- Corrected invoice line categories can propagate to exact matching historical items and are reused on future uploads.
- Adds the first grounded Resta AI Assistant foundation: read-only search/navigation across invoices, payroll, expenses, vendors, and employees.
