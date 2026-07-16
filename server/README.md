# RestaPay RC8 Toast Auto Sync Backend

This service securely connects to Toast Data Exports over SFTP. The private SSH key stays on the backend and is never sent to the browser.

## Setup

1. Run `server/sql/RC8_TOAST_SYNC_SCHEMA.sql` in Supabase SQL Editor.
2. Copy `server/.env.example` to `server/.env` for local testing.
3. Fill in Supabase service-role and Toast SFTP values.
4. From `server/`, run `npm install` and `npm start`.
5. Test `GET /health`, then `POST /api/toast/test`.
6. Set frontend `VITE_TOAST_SYNC_API_URL` to this backend URL and rebuild the frontend.

## Render backend service

- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Add all environment variables from `.env.example`.
- Store `TOAST_SFTP_PRIVATE_KEY_BASE64` as a secret. Do not commit the private key.

## Render Cron Job

Create a daily cron job with root directory `server` and command:

`npm install && npm run sync`

Schedule it after Toast's overnight export window, for example 5:15 AM America/Chicago.
