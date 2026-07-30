$ErrorActionPreference = "Stop"
Set-Location "C:\Users\jatin\RESTAPAY-RC4-GIT"

Write-Host "Checking project..." -ForegroundColor Cyan
npm install
npm run build

Write-Host "Creating RC6.15 commit..." -ForegroundColor Cyan
git add src/pages/Payroll.jsx RC6.15-MONDAY-SUNDAY-WEEKLY-PAYROLL-FIX.txt PUSH_RC6.15.ps1
git commit -m "RC6.15 fix Monday-Sunday weekly payroll grouping and Sunday pay date"
git push origin rc5-redesign

Write-Host "RC6.15 pushed to origin/rc5-redesign." -ForegroundColor Green
