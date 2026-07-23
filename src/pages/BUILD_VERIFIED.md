# Build verification

Verified in a clean Linux build environment on 2026-07-15.

## Checks passed

- `npm ci --no-audit --no-fund`
- `npm run audit`
  - 17 navigation entries checked
  - no unresolved Git conflict markers
  - no internal OpenAI package registry URLs
  - required pages and core files present
- `npm test`
  - actual invoice-line alcohol costing test passed
  - Bank of America expense excluded from alcohol cost
  - Toast Labor Summary hours, wages, credit-card tips, cash tips, withholding, and net tips passed
- `npm run build`
  - Vite 5.4.21
  - 1,655 modules transformed
  - production build completed successfully
  - large dependencies split into separate React, Supabase, XLSX, icon, and vendor chunks

## Important fix found during audit

The Toast Labor parser previously treated `Credit Card Tips` as a generic `Tips` total and omitted cash tips in some files. The clean project now uses exact matching for total-tip columns and correctly sums credit-card and cash tips when no explicit total is present.
