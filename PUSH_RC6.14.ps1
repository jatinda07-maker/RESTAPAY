$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host 'Installing dependencies...' -ForegroundColor Cyan
npm install

Write-Host 'Building RESTAPAY...' -ForegroundColor Cyan
npm run build

Write-Host 'Committing RC6.14...' -ForegroundColor Cyan
git add src/pages/Dashboard.jsx src/pages/Sales.jsx RC6.14-ASCENDING-DATES-COMPLETE-SALES.txt PUSH_RC6.14.ps1
git commit -m "RC6.14 sort card details ascending and show complete sales by date"
git push origin rc5-redesign

Write-Host 'RC6.14 pushed to rc5-redesign.' -ForegroundColor Green
