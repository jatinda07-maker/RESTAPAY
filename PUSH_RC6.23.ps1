$ErrorActionPreference = "Stop"

Write-Host "RESTAPAY RC6.23 - verify, commit, and push" -ForegroundColor Cyan

if (-not (Test-Path ".git")) {
    throw "Run this script from your existing Git project folder after copying the RC6.23 files into it."
}

$conflicts = git diff --name-only --diff-filter=U
if ($conflicts) {
    Write-Host "Marking the RC6.23 replacement files as the resolved merge versions..." -ForegroundColor Yellow
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Running production build..." -ForegroundColor Cyan
npm run build

Write-Host "Staging resolved files..." -ForegroundColor Cyan
git add .

$status = git status --porcelain
if (-not $status) {
    Write-Host "Nothing to commit. Your project is already up to date." -ForegroundColor Yellow
    exit 0
}

git commit -m "RC6.23 merge main with payroll group management and approved payroll editing"

$branch = (git branch --show-current).Trim()
if (-not $branch) { throw "Could not determine the current Git branch." }

Write-Host "Pushing branch $branch..." -ForegroundColor Cyan
git push origin $branch

Write-Host "RC6.23 pushed successfully." -ForegroundColor Green
