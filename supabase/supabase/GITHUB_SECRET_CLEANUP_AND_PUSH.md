# Remove the blocked secret commit and push RC10 safely

GitHub blocked the prior push because the Gemini key was compiled into `dist`. Do not use the GitHub unblock link.

After extracting this RC10 package over `C:\Users\jatin\RESTAPAY-GIT`, run:

```cmd
cd C:\Users\jatin\RESTAPAY-GIT

git fetch origin
git reset --mixed origin/main

git rm --cached .env 2>nul

npm install --legacy-peer-deps --no-audit --no-fund
npm run build

findstr /s /i "AIza VITE_GEMINI_API_KEY" dist\* src\* .env.example README.md
```

The `findstr` command must not show a real Gemini key. It can show explanatory text such as `VITE_GEMINI_API_KEY` only in documentation if present, but this RC10 package removes that variable from source and build output.

Then commit the safe files:

```cmd
git add .
git add -f dist
git commit -m "RC10 move Gemini invoice OCR to secure Supabase Edge Function"
git pull --rebase origin main
git push origin main
```

## Deploy the Edge Function

```cmd
supabase login
supabase link --project-ref nzravalposusjrjcwvgz
supabase secrets set GEMINI_API_KEY=YOUR_NEW_KEY GEMINI_MODEL=gemini-2.5-flash
supabase functions deploy gemini-invoice
```

Never commit `.env`, never use `VITE_GEMINI_API_KEY`, and never add the Gemini key to Render Static Site environment variables.
