$ErrorActionPreference = "Stop"
Write-Host "Installing RC6.25 dependencies..." -ForegroundColor Cyan
npm install
Write-Host "Running production build..." -ForegroundColor Cyan
npm run build
Write-Host "Staging RC6.25..." -ForegroundColor Cyan
git add .
git commit -m "RC6.25 simplify final payroll and remove approved payroll"
Write-Host "Pushing current branch..." -ForegroundColor Cyan
git push origin HEAD
Write-Host "RC6.25 pushed successfully." -ForegroundColor Green
