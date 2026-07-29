$ErrorActionPreference = "Stop"
Set-Location "C:\Users\jatin\RESTAPAY-RC4-GIT"
git add .
git commit -m "RC6.7 restore sticky totals and correct Labor Mix detail formula"
$branch = git branch --show-current
git push origin $branch
