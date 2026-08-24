# RESTAPAY RC2.7 Schema / Sorting / Typography Hotfix

- Fixes manual invoice saves on deployed Supabase schemas that do not yet contain duplicate_match_id / duplicate_match_reason / duplicate_override columns.
- Duplicate detection remains active in the application; optional duplicate metadata no longer blocks invoice persistence.
- Manual sales on an existing business date merge into that sales_days row instead of creating a duplicate-date database row.
- Vendor, expense type, invoice category, supplies/utilities/category selectors are sorted A-Z where applicable.
- Removes the RC2.5 global +2px record-data typography override and restores the prior font sizing/weight behavior.
