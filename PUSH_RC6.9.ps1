$ErrorActionPreference = "Stop"
Set-Location "C:\Users\jatin\RESTAPAY-RC4-GIT"
git add .
git commit -m "RC6.9 fix payroll date range totals and stale weekly rows"
$branch = git branch --show-current
git push origin $branch
