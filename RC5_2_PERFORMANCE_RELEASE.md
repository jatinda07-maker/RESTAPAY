# RC5.2 Performance and Navigation Release

## Changes

- Converted all application pages to React lazy-loaded routes.
- Added a compact loading state while a page chunk loads.
- Split React, Supabase, XLSX, icons, and general vendor dependencies into separate production chunks.
- Added `npm run test:all` to run the existing Toast, payroll, sales, and costing checks in one command.

## Expected result

The dashboard shell can load without downloading every page up front. Large areas such as Reports, Menu Intelligence, Invoices, and Toast tools load only when opened. This addresses the previous Vite warning caused by one 1.25 MB application bundle.

## Verification commands

```powershell
npm install
npm run test:payroll-engine
npm run build
```
