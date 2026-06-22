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
