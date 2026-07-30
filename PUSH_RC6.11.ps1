$ErrorActionPreference = "Stop"
Write-Host "Preparing RC6.11 payroll workspace clearing fix..." -ForegroundColor Cyan
git add .
git commit -m "RC6.11 clear Toast payroll workspace after create and approval"
$branch = git branch --show-current
git push origin $branch
Write-Host "RC6.11 pushed to $branch." -ForegroundColor Green
