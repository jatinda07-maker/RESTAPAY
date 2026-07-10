# RC8 Toast Auto Sync Setup

## What is included

- React Toast Integration page
- Secure Node/Express SFTP backend
- Toast connection test and manual sync endpoints
- Seven-day dated-folder discovery
- CSV report classification and raw-row import
- Duplicate detection using SHA-256 checksum
- Supabase sync history and import tables
- Daily cron-ready sync command
- Mobile navigation drawer and favicon

## Security

Never place `C:\Users\jatin\.ssh\toast_restapay` in this project, GitHub, the frontend, or the ZIP. Store the private key only as a backend environment secret.

To create a base64 value on Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.ssh\toast_restapay"))
```

Paste the resulting value into the backend secret `TOAST_SFTP_PRIVATE_KEY_BASE64`.

## Supabase

Run `server/sql/RC8_TOAST_SYNC_SCHEMA.sql` in Supabase SQL Editor.

## Backend deployment

Create a separate Render Web Service:

- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`

Add all variables listed in `server/.env.example`.

## Frontend

Set:

`VITE_TOAST_SYNC_API_URL=https://YOUR-BACKEND-SERVICE.onrender.com`

Then rebuild the frontend.

## Daily automation

Create a Render Cron Job using the same backend environment:

- Root directory: `server`
- Command: `npm install && npm run sync`
- Schedule: after Toast exports are expected, such as 5:15 AM America/Chicago.

Until Toast creates its first export directory, Sync Now will correctly report that the SFTP connection works but no dated export directory is available.
