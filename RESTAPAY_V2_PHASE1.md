# RESTAPAY V2 Phase 1

This package introduces a new presentation layer without altering the existing engines, Supabase services, Toast imports, or legacy pages.

## Added
- `src/ui-v2/AppShellV2.jsx`
- `src/pages-v2/DashboardV2.jsx`
- `src/styles-v2/tokens.css`
- `src/styles-v2/app.css`

## Switched
- Dashboard route now opens `DashboardV2`.
- Application shell now uses `AppShellV2`.
- All other routes still use their existing page logic while they are migrated one at a time.

## Visual rules
- White navigation
- Crisp Inter/Segoe UI typography
- Lighter font weights
- Four KPI cards per row on desktop
- Approved hybrid executive Dashboard
- Compact date controls
- Shared V2 modal design with subtotal, total, and difference
- V2 CSS is namespaced with `rv2-` classes to prevent legacy CSS collisions
