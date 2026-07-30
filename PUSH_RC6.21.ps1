$ErrorActionPreference = "Stop"
Set-Location "C:\Users\jatin\RESTAPAY-RC4-GIT"

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install --registry=https://registry.npmjs.org

Write-Host "Running production build..." -ForegroundColor Cyan
npm run build

Write-Host "Committing RC6.21..." -ForegroundColor Cyan
git add .
git commit -m "RC6.21 sort all dashboard card details ascending and add sales subtotals"

git push origin rc5-redesign
Write-Host "RC6.21 pushed to origin/rc5-redesign." -ForegroundColor Green
