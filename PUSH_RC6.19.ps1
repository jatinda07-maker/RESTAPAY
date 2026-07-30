$ErrorActionPreference = "Stop"
Set-Location "C:\Users\jatin\RESTAPAY-RC4-GIT"

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Running production build..." -ForegroundColor Cyan
npm run build

Write-Host "Committing RC6.19..." -ForegroundColor Cyan
git add .
$changes = git status --porcelain
if ($changes) {
  git commit -m "RC6.19 add approved payroll payment popup and prevent clipped entries"
} else {
  Write-Host "No changes to commit." -ForegroundColor Yellow
}

Write-Host "Pushing rc5-redesign..." -ForegroundColor Cyan
git push origin rc5-redesign
Write-Host "RC6.19 pushed successfully." -ForegroundColor Green
