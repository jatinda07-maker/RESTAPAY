# RC10 Secure Gemini OCR Setup

## What changed

- Removed direct Gemini calls from the browser.
- Removed `VITE_GEMINI_API_KEY` usage.
- Added a Supabase Edge Function at `supabase/functions/gemini-invoice`.
- Invoice PDF/image OCR now calls the Edge Function through the existing Supabase client.
- The Gemini key is never included in `dist`, localStorage, GitHub, or browser settings.

## 1. Revoke the exposed key

Revoke any Gemini key that appeared in a blocked Git commit or compiled JavaScript bundle. Create a fresh key.

## 2. Configure Supabase CLI

```cmd
npm install -g supabase
supabase login
supabase link --project-ref nzravalposusjrjcwvgz
```

## 3. Store the new key securely

```cmd
supabase secrets set GEMINI_API_KEY=YOUR_NEW_KEY GEMINI_MODEL=gemini-2.5-flash
```

Do not use a `VITE_` prefix.

## 4. Deploy the function

```cmd
supabase functions deploy gemini-invoice
```

## 5. Build RestaPay

Your local `.env` should contain only the browser-safe Supabase values:

```env
VITE_SUPABASE_URL=https://nzravalposusjrjcwvgz.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Then run:

```cmd
npm install --legacy-peer-deps --no-audit --no-fund
npm run build
```

## 6. Test

Open Invoices and upload a PDF or image using AI OCR. Settings should show `Secure Proxy Ready` when Supabase is configured.
