$ErrorActionPreference = "Stop"
$branch = git branch --show-current
Write-Host "Pushing RC6.6 on branch: $branch"
git add .
git commit -m "RC6.6 fix labor entries and sticky totals on all dashboard cards"
git push origin $branch
