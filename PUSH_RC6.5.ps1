$ErrorActionPreference = "Stop"

Write-Host "RESTAPAY RC6.5 - Labor Mix Card Functionality Fix" -ForegroundColor Cyan

git status
git add .

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No new files to commit. Pushing the current branch." -ForegroundColor Yellow
} else {
    git commit -m "RC6.5 fix Labor Mix dashboard card drilldown"
}

$branch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($branch)) {
    throw "Could not determine the current Git branch."
}

git push origin $branch
Write-Host "Pushed RC6.5 to origin/$branch" -ForegroundColor Green
