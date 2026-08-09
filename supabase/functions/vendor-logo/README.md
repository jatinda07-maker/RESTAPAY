# Vendor Logo Persistence

Creates a persistent vendor logo in the public `vendor-logos` Supabase Storage bucket.

Deploy after running migration `002_restapay1_live_extensions.sql`:

```bash
supabase functions deploy vendor-logo
```

The Edge Function uses the built-in Supabase service-role environment to write the image. The browser never receives the service-role key.
