# RestaPay V2 - Local First Payroll Build

## Run locally

```bash
npm install --registry=https://registry.npmjs.org/
npm run dev
```

Open the local URL shown by Vite, usually `http://localhost:5173`.

## What is included

- Dark navy collapsible sidebar with existing icons unchanged
- Compact aligned Employees screen
- Local auto-save using browser localStorage
- Employee types and job types
- Payroll groups that stay saved when changing pages
- Add/remove employees from groups
- Generate payroll from a group in one click
- Edit/delete payroll entries
- Extra pay and extra pay reason
- Toast Labor Summary CSV/XLSX import preview
- Tip withholding calculation from Settings
- Export/import local backup JSON

## Important

This build intentionally saves data locally first. Supabase sync comes later after the workflow is approved.

If npm hangs, delete any old `package-lock.json` and run:

```bash
npm config set registry https://registry.npmjs.org/
npm install --registry=https://registry.npmjs.org/
```

## Gemini invoice extraction

Create a `.env` file in the project root:

```bash
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_GEMINI_MODEL=gemini-3.5-flash
```

Then restart the dev server:

```bash
npm run dev
```

The app uses Gemini only for PDF/image/phone invoice extraction when local CSV/XLSX extraction cannot read the invoice. CSV and XLSX still extract locally first.

Note: Vite `VITE_` variables are available in the browser. For production, move Gemini calls to a backend/proxy before deploying publicly.

## Sales Module Update

Added Toast Sales Summary import for CSV/XLSX with local autosave.

Sales extracts common Toast columns:
- Business Date / Date
- Gross Sales
- Net Sales
- Cash Sales
- Credit Card Sales
- Gift Cards
- Online / Delivery / Pickup Orders
- Tips
- Refunds
- Voids
- Discounts
- Tax
- Guest Count

Workflow:
1. Open Sales.
2. Click Import Sales.
3. Upload CSV/XLSX.
4. Review compact preview table.
5. Edit inline if needed.
6. Click Save Sales.

Dashboard sales cards update from saved local sales rows.


## Latest update
- Payroll group members are editable.
- You can add employees to a selected group and remove employees from that group.
- The Add Group To Payroll button was moved below the selected group member list.
- Existing UI colors/sidebar are unchanged.

Run locally:
```bash
npm install --registry=https://registry.npmjs.org/
npm run dev
```


## Latest update
- Gemini API key field removed from Invoice screen.
- AI / OCR status moved under Settings.
- Gemini key is read from `.env` using `VITE_GEMINI_API_KEY`.
- Calendar/date picker icons are forced to orange globally.

Example `.env`:
```env
VITE_GEMINI_API_KEY=your_key_here
VITE_GEMINI_MODEL=gemini-2.5-flash
```

Restart after changing `.env`:
```bash
npm run dev
```

## Supabase cloud saving

This build saves the full RESTAPAY app state to Supabase table `app_data` when these Render/local environment variables exist:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run `supabase/schema.sql` in Supabase SQL Editor before deploying.

The app still keeps a localStorage backup, but Supabase is now the shared online source when configured.

## AI Check Processing Backend

This version includes a real backend endpoint for bank statement/check processing.

### Local development

Run the backend in one terminal:

```bash
npm run server
```

Run the React app in another terminal:

```bash
npm run dev
```

The Vite dev server proxies `/api` to the backend on port `4173`.

### Production / Render

The app now starts with:

```bash
npm start
```

which runs `server.js`, serves the built React app from `dist`, and exposes the AI processing API.

### Environment variables

Set these in Render or your server `.env`:

```bash
GEMINI_API_KEY=your-gemini-api-key
GEMINI_CHECK_MODEL=gemini-2.5-flash
```

If `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY` is missing, RestaPay will clearly show `AI Offline` and use backend local text extraction only. Local extraction can find structured statement rows, but true check-image payee extraction requires Gemini.

### Privacy behavior

The backend does not persist uploads. It returns only review rows and strips sensitive fields from responses. It does not save account numbers, routing numbers, MICR lines, balances, signatures, or original statement/check images. Only rows approved in the review screen are saved into RestaPay expenses.
