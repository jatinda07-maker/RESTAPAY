# RestaPay Toast SFTP Worker

Create a Render Cron Job using this folder as the Root Directory.

- Build command: `npm install`
- Start command: `npm run sync`
- Schedule: `30 11 * * *` (6:30 AM Central during daylight time)

Environment variables:

- `TOAST_SFTP_HOST=s-9b0f88558b264dfda.server.transfer.us-east-1.amazonaws.com`
- `TOAST_SFTP_PORT=22`
- `TOAST_SFTP_USERNAME=IsabellaMexicanDataExports`
- `TOAST_EXPORT_ID=144385`
- `TOAST_PRIVATE_KEY_PATH=/etc/secrets/toast_restapay`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `TOAST_STORAGE_BUCKET=toast-exports`
- `TOAST_LOOKBACK_DAYS=8`

Upload the private key as a Render Secret File named `toast_restapay`. Never commit it to GitHub.
