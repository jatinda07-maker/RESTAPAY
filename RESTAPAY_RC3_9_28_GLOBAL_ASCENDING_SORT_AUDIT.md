# RESTAPAY RC3.9.28 - Global Ascending Sort Audit

## Sorting policy

- Master/reference lists (vendors, employees, categories, expense types, price-book items, selectable names): A-Z, case-insensitive, numeric-aware.
- Normal transaction/history tables: date ascending (oldest to newest), then name A-Z where a tie breaker is available.
- KPI/detail drawer entry lists: date ascending when entries represent transactions; grouped labels A-Z.
- Payroll imported weeks: chronological ascending in the selector. The automatic next-week builder still derives from the latest saved/source week.
- Reports payroll groups: period ascending, then employee A-Z.
- Explicit ranking semantics remain ranked, not alphabetized: Largest Increase, best price/vendor, top savings, and similar ranked analytics.
- Explicit technical lookups that need the newest record internally may still calculate newest-first, but displayed rows remain consistent with the rules above.

This release does not reorder KPI cards merely for alphabetic appearance when their current sequence communicates a financial workflow or total-before-breakdown hierarchy.
