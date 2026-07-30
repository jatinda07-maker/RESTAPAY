$ErrorActionPreference = "Stop"
Set-Location "C:\Users\jatin\RESTAPAY-RC4-GIT"

Write-Host "Installing dependencies..."
npm install

Write-Host "Running production build..."
npm run build

Write-Host "Creating RC6.17 commit..."
git add .
git commit -m "RC6.17 add kitchen payroll popup and distinct payroll button colors"

git push origin rc5-redesign
Write-Host "RC6.17 pushed to origin/rc5-redesign."
