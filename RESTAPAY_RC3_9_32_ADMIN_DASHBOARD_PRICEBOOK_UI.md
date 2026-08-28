# RESTAPAY RC3.9.32

## Admin Dashboard Customization
- Administrator dashboard cards/sections can now be enabled or disabled independently of Manager permissions.
- Controls live in Settings > Users & Security > Administrator > Edit.
- Includes Select All, Clear All, and Restore Defaults.
- Saved through the live `app_settings` path using key `restapay-admin-dashboard`.
- Dashboard reads the Admin preference live; Manager keeps its separate permission map.
- Dashboard item registry now includes all current KPI cards plus analytics/recent/quick-access sections.

## Price Book Category Toolbar
- Rebuilt category controls into a professional two-level toolbar.
- Added clear section hierarchy, aligned field/button heights, selection badge, labeled category selector, responsive layout, and disabled-state styling.
- Renamed `Apply to Saved Entries` to `Apply to Selected Items` while preserving propagation behavior.

## Validation
- `node scripts/test-rc3932-admin-dashboard-pricebook-ui.mjs` passes.
- Full Vite build was not available in the packaging environment because local Vite dependencies were not installed; run `npm run build` locally before push.
