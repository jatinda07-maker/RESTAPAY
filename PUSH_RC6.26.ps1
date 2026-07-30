$ErrorActionPreference = "Stop"
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install
Write-Host "Running production build..." -ForegroundColor Cyan
npm run build
Write-Host "Committing RC6.26..." -ForegroundColor Cyan
git add .
git commit -m "RC6.26 fix Lucas payroll, remove hourly wages, standardize professional UI"
git push origin rc5-redesign
Write-Host "RC6.26 pushed successfully." -ForegroundColor Green
