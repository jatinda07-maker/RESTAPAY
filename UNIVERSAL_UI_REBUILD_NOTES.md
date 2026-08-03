# RestaPay Universal UI Rebuild

This package replaces the active legacy visual layer with one stylesheet:

- `src/styles/universal.css`

Legacy styles removed from the active project:

- `src/styles.css`
- `src/pages/Dashboard.css`
- `src/styles/design-system.css`
- `src/styles/universal-ui.css`
- `src/styles/dashboard-v4.css`

## Locked design rules

- White left navigation
- Four Dashboard KPI cards per desktop row
- Compact 36px buttons, inputs, selects, and date controls
- Solid pastel cards with no gradients
- Lighter typography and tabular financial values
- Shared cards, tables, forms, filters, badges, and modals
- Compact responsive layouts across all pages
- Existing business logic and data functions preserved

## Apply, build, commit, and push

Run in PowerShell from this extracted package:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\APPLY_REBUILD_BUILD_PUSH.ps1
```
