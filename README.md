# Supabase setup

Use `migrations/001_production_alignment.sql` for an existing RESTAPAY database. It is designed to preserve existing rows while adding missing tables and columns.

`DESTRUCTIVE_FULL_RESET_DO_NOT_RUN_ON_PRODUCTION.sql` deletes and recreates tables. Keep it only for a brand-new empty Supabase project.

The Gemini invoice Edge Function is in `functions/gemini-invoice/`.
