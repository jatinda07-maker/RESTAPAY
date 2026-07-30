$ErrorActionPreference = 'Stop'

Write-Host 'RESTAPAY RC6.4 - Commit and Push' -ForegroundColor Cyan

git status

git add .

$changes = git diff --cached --name-only
if (-not $changes) {
    Write-Host 'No new changes to commit. Pushing current branch...' -ForegroundColor Yellow
} else {
    git commit -m "RC6.4 fix reconciliation modal clipping on all cards"
}

$branch = git branch --show-current
if (-not $branch) { throw 'Unable to determine the current Git branch.' }

git push origin $branch
Write-Host "Pushed RC6.4 to origin/$branch" -ForegroundColor Green
