$ErrorActionPreference = "Stop"
Set-Location "C:\Users\jatin\RESTAPAY-RC4-GIT"

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Running production build..." -ForegroundColor Cyan
npm run build

Write-Host "Committing RC6.20..." -ForegroundColor Cyan
git add .
git commit -m "RC6.20 center kitchen payroll group modal and fix trimmed entries"

git push origin rc5-redesign
Write-Host "RC6.20 pushed to origin/rc5-redesign" -ForegroundColor Green
