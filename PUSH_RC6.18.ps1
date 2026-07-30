$ErrorActionPreference = "Stop"
Set-Location "C:\Users\jatin\RESTAPAY-RC4-GIT"

Write-Host "Installing dependencies..."
npm install

Write-Host "Running production build..."
npm run build

Write-Host "Creating RC6.18 commit..."
git add .
git commit -m "RC6.18 add professional kitchen group payroll popup and employee selection"
git push origin rc5-redesign
Write-Host "RC6.18 pushed to origin/rc5-redesign."
