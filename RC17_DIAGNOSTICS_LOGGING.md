# RC17 Diagnostics and Logging

Adds an in-app Diagnostics page and persistent browser log store.

Logged events include:
- Unhandled JavaScript errors and promise rejections
- Supabase table read failures
- Supabase save failures and local pending-backup creation
- Successful cloud loads and saves
- Page navigation events

Diagnostics can be filtered and downloaded as JSON for support analysis. Logs are retained locally up to 1,500 events and do not include passwords, API keys, or uploaded file contents.
