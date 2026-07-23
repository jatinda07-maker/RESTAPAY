# RC19.2 Toast Resume and Cancel Fix

This update fixes the misleading `Scheduled import started` error when a running sync is stopped with Ctrl+C or terminated by Render.

## Changes

- Tracks the active child importer process.
- Gracefully terminates the importer when the API service receives SIGINT or SIGTERM.
- Marks an interrupted `toast_import_runs` record as `cancelled` with a completion timestamp.
- Returns the terminating signal in API diagnostics.
- Explains that the next run resumes safely and skips files already imported.
- Prevents stale `running` records from being reported as the current error message.

## Important

The initial 8-day backfill can take several minutes because it downloads and processes all Toast exports from the configured lookback period. Let the first run finish. Future runs skip unchanged files.
