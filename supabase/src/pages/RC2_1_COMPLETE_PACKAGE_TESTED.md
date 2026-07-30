# RESTAPAY RC2.1 Complete Tested Package

This package consolidates the working Toast automation and the active dashboard release.

## Included fixes

- Keeps the successful Toast SFTP sync and sales-category normalization fixes.
- Keeps all dashboard cards, KPI rows, section headers, and summaries active.
- Updates Toast Integration to use the live Render `/api/toast/status` response as the primary health source.
- Prevents an optional merchant-fee table error from incorrectly marking the entire Toast schema as unavailable.
- Shows the latest worker run and normalized row totals even when direct browser Supabase queries are unavailable.
- Uses the backend `connected` value for the Toast SFTP connection indicator.
- Removes internal package-registry URLs from distributable lock files.

## Verification performed

- Production Vite build completed successfully.
- Corrected Toast labor tip parsing so separate credit-card and cash tip columns are added together instead of the generic `Tips` alias matching only one column.
- Toast labor parser test passed.
- Actual department-costing test passed.
- Project audit passed.
- Backend Toast sync job passed Node syntax validation.

## Git push

```powershell
cd C:\Users\jatin\RESTAPAY-CLEAN
git add .
git commit -m "RESTAPAY RC2.1 complete tested package"
git push -u origin clean-main
```
