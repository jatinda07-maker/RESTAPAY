# RC12 Toast Automation Setup

## 1. Create the Toast tables

Open Supabase Dashboard → SQL Editor and run:

`supabase/RESTAPAY_RC12_TOAST_AUTOMATION.sql`

Then refresh the RestaPay Toast Integration page. The schema card should say **Ready**.

## 2. Configure the Render cron job

The included `render.yaml` defines `restapay-toast-import`, scheduled for 11:30 UTC (approximately 6:30 AM Central during daylight time).

Add these secrets to the cron job in Render:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Secret file named `toast_restapay` containing the private SSH key

The private key path is `/etc/secrets/toast_restapay`.

## 3. Test before waiting for the schedule

In the Render cron job, use **Trigger Run**. Or locally from `toast-worker`:

```cmd
npm install
npm run test
```

A local test also requires the private-key path and environment variables.

## 4. Data imported

The worker archives the raw Toast files and normalizes available exports into:

- `toast_sales_categories`
- `toast_sales_summary`
- `toast_product_mix`
- `toast_labor`
- `toast_payments`
- `toast_merchant_fees`
- `toast_checks`
- `toast_cash_management`
- `toast_menu_items`
- `toast_daily_summary`

Merchant processing fees are also mirrored into the main `expenses` table when that table exists. Tips are stored for reporting but excluded from labor/profit calculations in the daily summary.

## 5. Duplicate safety

The worker stores a SHA-256 file hash and skips files whose remote path and hash have already been imported.
