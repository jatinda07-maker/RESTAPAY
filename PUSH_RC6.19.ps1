$ErrorActionPreference = "Stop"
Set-Location "C:\Users\jatin\RESTAPAY-RC4-GIT"
Write-Host "Building RC6.19..." -ForegroundColor Cyan
npm run build
git add .
git commit -m "RC6.19 add professional approved payroll batch payment popup"
git push origin rc5-redesign
Write-Host "RC6.19 pushed to origin/rc5-redesign." -ForegroundColor Green
