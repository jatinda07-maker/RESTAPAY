# RC3.1 Automatic Toast Payroll Review

## What changed
- Payroll now opens on a **Toast Review** tab.
- Labor rows are pulled directly from the normalized `toast_labor` table for the selected date range.
- Nothing is posted automatically. Every row remains pending until the owner selects and approves it.
- Review supports employee matching, hours, wages, original tips, withholding, tips after withholding, extra pay, payment method, and check number.
- Approved rows are added to Payroll and unmatched Toast employees are added to the employee list.
- The original Toast labor row ID is stored to prevent the same row from being approved twice.
- Manual Labor Summary upload remains available as a fallback.

## Replace / push
This package is based on the uploaded RESTAPAY-CLEAN project. Copy the project contents over your local repository, then run:

```cmd
cd C:\Users\jatin\RESTAPAY-CLEAN
npm install
npm run build
git add src/pages/Payroll.jsx RC3_1_AUTOMATIC_PAYROLL_REVIEW.md
git commit -m "RC3.1 add automatic Toast payroll review and approval"
git push origin clean-main
```

After Render deploys, hard refresh with Ctrl+Shift+R and open Payroll.
