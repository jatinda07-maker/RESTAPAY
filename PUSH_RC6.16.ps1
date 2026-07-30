$ErrorActionPreference = "Stop"
Set-Location "C:\Users\jatin\RESTAPAY-RC4-GIT"
Write-Host "Building RC6.16..."
npm install
npm run build
git add .
git commit -m "RC6.16 add approved payroll check printing"
git push origin rc5-redesign
Write-Host "RC6.16 pushed to origin/rc5-redesign" -ForegroundColor Green
