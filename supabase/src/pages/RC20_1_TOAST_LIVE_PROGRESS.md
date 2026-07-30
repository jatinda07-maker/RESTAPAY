# RC20.1 Toast Live Progress and Resume

- Adds live run progress, current file, report type, business date, heartbeat, and total/processed file counts.
- Skips unchanged SFTP files using remote size and modified time before downloading.
- Retains hash verification when metadata changes.
- Supports encrypted private keys through TOAST_PRIVATE_KEY_PASSPHRASE.
- Cancels stale running records after service restart.
- Adds a migration at supabase/migrations/006_toast_sync_progress.sql.
