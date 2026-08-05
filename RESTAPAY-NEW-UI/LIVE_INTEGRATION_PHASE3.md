# Phase 3 Live Supabase + Gemini Integration

Business records now load from and save directly to the existing Supabase normalized tables. Local storage remains only for UI preferences and unsaved transient settings.

## Required Render variables
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

## Required one-time database step
Run `supabase/migrations/002_restapay1_live_extensions.sql` in Supabase SQL Editor.

## Gemini
The UI invokes the existing `gemini-invoice` Supabase Edge Function. Keep GEMINI_API_KEY and GEMINI_MODEL as Edge Function secrets.
