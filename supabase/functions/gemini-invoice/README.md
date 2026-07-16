# Secure Gemini Invoice OCR Edge Function

This function keeps the Gemini API key out of the browser, GitHub, and the compiled `dist` bundle.

## Deploy

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set GEMINI_API_KEY=YOUR_NEW_KEY GEMINI_MODEL=gemini-2.5-flash
supabase functions deploy gemini-invoice
```

Do not use a `VITE_` prefix for `GEMINI_API_KEY`.

## Verify

After deployment, open RestaPay → Settings. AI/OCR should display **Secure Proxy Ready** when Supabase is configured. Then upload a PDF or image from Invoices.
