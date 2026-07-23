# RC20.2 Toast normalization and automatic scheduler

- Uses exact Toast export filenames before header heuristics.
- Stops misclassifying KitchenTimings as CheckDetails.
- Parses Toast MenuExport JSON into normalized menu item rows.
- Builds daily summaries from Product Mix or CheckDetails when a Sales Summary export is unavailable.
- Adds normalized table counts to the Toast status API.
- Adds an optional built-in daily scheduler controlled by environment variables.
- Raises the default sync timeout to 30 minutes for first-time backfills.
- Shows normalized row counts and the active schedule in Toast Integration.
