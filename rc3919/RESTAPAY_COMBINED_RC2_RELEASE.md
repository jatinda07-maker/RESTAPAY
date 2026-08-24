# RESTAPAY Combined RC2 Release

Branch target: `restapay1-root-cleanup`

This combined release carries the root-cleanup line through Phase 3D.7, Phase 3D.8, Phase 3D.9, RC1 and RC2 hardening.

## Phase 3D.7
- Paid payroll history now derives from the persistent payroll collection and uses payment date first for global-range filtering.
- Single-payment and bulk-payment flows stamp paid/history audit metadata before the live Supabase collection is saved.
- Paid history includes weekly and manual paid records without duplicate display rows.
- Saving ready weekly payroll automatically prepares the next Monday-Sunday period and retains Build Another Week as a manual fallback.
- Duplicate next-week weekly rollups are detected before automatically opening the builder.

## Phase 3D.8 / 3D.9
- Payroll status regression coverage retained for Draft, Approved, Paid and Void.
- Weekly and kitchen-weekly payroll engine checks retained.
- Existing live-release, financial reconciliation and UI audits retained.

## RC1 / RC2
- Added configurable Food vs Alcohol allocation rules in Settings for Manager Payroll, Supplies, Cleaning Supplies, Cintas/Linen, Utilities, Insurance and Other Shared Costs.
- Default prior-project model restored: Manager 50/50, Supplies 50/50, Cleaning 50/50, Cintas 50/50, Utilities 70/30, Insurance 50/50, Other Shared 50/50.
- Added dashboard side-by-side Food vs Alcohol true-cost comparison showing sales, direct purchases, department payroll, manager allocation, shared costs, true cost, cost %, profit and margin.
- Added allocation-rule snapshot directly under the comparison.
- Added `test:rc2-combined` regression coverage.

## Validation
The source-level and engine regression suite passes in the packaging environment. The production Vite build cannot run in the packaging environment because its private npm mirror does not contain `xlsx@0.18.5`. Run `npm install` and `npm run build` in the normal RESTAPAY Windows project, where the dependency has previously installed successfully.
