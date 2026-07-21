# RC3.1.1 - Toast Tips and Payroll Table Fit Fix

## Fixed
- Toast Labor now maps `Total Tips`, `Non-Cash Tips`, and `Declared Tips` instead of only looking for a generic `Tips` column.
- Payroll Review reads `Total Tips` and the exact `Tips Withheld` value from the saved raw Toast row.
- `Tips After WH` is calculated as Total Tips minus the actual Toast withheld amount.
- Existing normalized rows can display tips from their `raw` JSON without waiting for a new import.
- Future Toast syncs store the correct tip total in `toast_labor.tips`.
- Payroll Review table now uses a compact fixed layout and no longer forces a 1500px-wide horizontal scrollbar.

## Verified against the uploaded Toast Payroll Export
The uploaded sample contains:
- Total Tips: $147.78
- Tips Withheld: $5.16
- Tips After WH: $142.62

## Deployment note
Deploy both frontend and worker changes. Then run Toast sync once so future `toast_labor` records use the corrected tip mapping.
