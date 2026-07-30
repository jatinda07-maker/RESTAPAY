Set-Location "C:\Users\jatin\RESTAPAY-RC4-GIT"
npm install
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed. Do not push." -ForegroundColor Red; exit 1 }
git add .
git commit -m "RC6.13 fix Toast payroll weekly employee merge"
git push origin main
