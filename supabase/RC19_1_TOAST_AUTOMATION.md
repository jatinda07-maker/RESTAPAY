# RC19.1 Toast Automation

## What changed

- Unified the manual Render web API and scheduled Toast importer around the same import job.
- The Render API now reads and writes `toast_import_runs`, matching the frontend and Supabase schema.
- Added API endpoints:
  - `GET /health`
  - `GET /api/toast/status`
  - `GET /api/toast/history`
  - `POST /api/toast/test`
  - `POST /api/toast/sync`
- Prevents two manual syncs from running at the same time.
- Manual sync executes the same vendor report parser used by the scheduled import.
- Supports private keys supplied by secret-file path, base64, or inline environment variable.
- Scheduled and manual imports support CSV, TXT, XLS, and XLSX Toast exports.
- Imports raw files and rows, then populates normalized Toast tables and daily summaries.
- Frontend now separately checks whether the Render sync API is reachable.
- Added a Render Blueprint with three correctly separated services:
  - RESTAPAY static frontend
  - Toast sync web API
  - Toast scheduled cron import

## Required Supabase migration

Run `supabase/RESTAPAY_RC12_TOAST_AUTOMATION.sql` once if the Toast tables are not already present.

## Render frontend settings

- Branch: `clean-main`
- Root Directory: blank
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Environment:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_TOAST_SYNC_API_URL=https://<toast-sync-service>.onrender.com`

## Render Toast sync API settings

- Service type: Web Service
- Branch: `clean-main`
- Root Directory: `server`
- Build Command: `npm ci --no-audit --no-fund`
- Start Command: `npm start`
- Health Check: `/health`
- Environment:
  - `TOAST_SFTP_HOST`
  - `TOAST_SFTP_PORT=22`
  - `TOAST_SFTP_USERNAME`
  - `TOAST_EXPORT_ID=144385`
  - `TOAST_PRIVATE_KEY_PATH=/etc/secrets/toast_restapay`
  - `TOAST_LOOKBACK_DAYS=8`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ALLOWED_ORIGIN=https://<your-restapay-site>.onrender.com`

## Render scheduled import settings

- Service type: Cron Job
- Branch: `clean-main`
- Root Directory: `server`
- Build Command: `npm ci --no-audit --no-fund`
- Command: `npm run sync`
- Schedule: `30 11 * * *` (6:30 AM Central during daylight time)
- Use the same Toast and Supabase environment variables and the same secret file.

## Validation completed

- Vite production build: passed, 1,655 modules transformed.
- Server JavaScript syntax checks: passed.
- Toast import job syntax check: passed.
