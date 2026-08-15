# Phase 3D.4 - Live Release Completion

This package combines the remaining live-release work after Phase 3D.3.

## Included

- Vendor logos can be uploaded to the public `vendor-logos` Supabase Storage bucket.
- Known vendor/domain logos can be fetched server-side by the `vendor-logo` Edge Function and stored in Supabase Storage.
- Vendor records save the persistent `logo_url`, so logos follow the account across computers/devices.
- Vendors now use the global date toolbar and show live vendor spend from invoices in the selected period.
- Reports use the same live `useAppData` metrics as Dashboard and the same selected date range; old Aug 01-Aug 04 demo ranges/totals were removed.
- Employee saves now wait for Supabase confirmation before showing success.
- Demo seed declarations were removed from Employees, Vendors, and Bank & Checks.
- Added `npm run test:live-release` to catch demo seeds, obsolete engine placeholders, Clearbit, hard-coded report totals/ranges, and missing vendor-logo storage migration.

## Supabase setup required

1. Run `supabase/migrations/002_restapay1_live_extensions.sql` again. It is additive/idempotent and creates/updates the `vendor-logos` public bucket plus public read policy.
2. Deploy the logo persistence function:

```bash
supabase functions deploy vendor-logo
```

The function uses the Supabase service role available to Edge Functions; no service key is exposed to the browser.

## Verification

- Upload a logo on Computer A, save the vendor, then open the live site on Computer B and confirm the same logo appears.
- Use Find Missing Logos and confirm the resulting `logo_url` points to Supabase Storage.
- Change the global date range and confirm Dashboard, Reports, Vendor Spend, and KPI drawers all reconcile to that range.
- Run `npm run test:live-release` and `npm run test:ui` before production push.
