$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Building RESTAPAY RC6.16.1..." -ForegroundColor Cyan
npm run build

git add src/pages/ApprovedPayroll.jsx RC6.16.1-BLANK-CHECK-PREVIEW-FIX.txt PUSH_RC6.16.1.ps1
git commit -m "RC6.16.1 fix blank payroll check preview"
git push origin rc5-redesign

Write-Host "RC6.16.1 build and push completed." -ForegroundColor Green
