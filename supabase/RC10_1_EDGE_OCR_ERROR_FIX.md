# RC10.1 Secure Gemini OCR Error Fix

This update corrects the generic "Edge Function returned a non-2xx status code" problem.

## Changes

- The browser now reads and displays the actual JSON error returned by the Supabase Edge Function.
- The Edge Function validates PDF/image MIME types and file size before calling Gemini.
- Gemini provider errors are logged with the model, HTTP status, MIME type, and safe error message.
- API keys remain server-side in Supabase secrets and are never included in the browser bundle.
- The function uses the `x-goog-api-key` request header instead of putting the key in the URL.
- The function returns structured error codes for missing keys, invalid files, authentication failures, and provider errors.
- Successful responses are normalized before being returned to the application.

## Deploy after replacing files

```cmd
npx supabase@latest functions deploy gemini-invoice --project-ref nzravalposusjrjcwvgz
npm run build
```

Then test **Invoices -> Smart AI Upload**. If Gemini rejects the request, the invoice page will now show the real reason.
