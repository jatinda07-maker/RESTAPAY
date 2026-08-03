param(
  [string]$ProjectPath = "C:\Users\jatin\RESTAPAY-RC4-GIT"
)

$ErrorActionPreference = "Stop"
$SourceRoot = $PSScriptRoot
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectPath "ui-backups\universal-ui-$Timestamp"

Write-Host "" 
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " RESTAPAY UNIVERSAL UI - APPLY BUILD PUSH" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $ProjectPath "package.json"))) {
  throw "RESTAPAY project was not found at $ProjectPath"
}
if (-not (Test-Path (Join-Path $SourceRoot "src\styles\universal.css"))) {
  throw "The rebuilt universal.css file is missing from this package."
}

Write-Host "Creating source backup..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
Copy-Item (Join-Path $ProjectPath "src") (Join-Path $BackupRoot "src") -Recurse -Force

Write-Host "Installing rebuilt source..." -ForegroundColor Yellow
Remove-Item (Join-Path $ProjectPath "src") -Recurse -Force
Copy-Item (Join-Path $SourceRoot "src") (Join-Path $ProjectPath "src") -Recurse -Force

Set-Location $ProjectPath

Write-Host "Running production build..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed. Restoring original source..." -ForegroundColor Red
  Remove-Item (Join-Path $ProjectPath "src") -Recurse -Force
  Copy-Item (Join-Path $BackupRoot "src") (Join-Path $ProjectPath "src") -Recurse -Force
  throw "Build failed; the previous source was restored and nothing was committed."
}

# Do not commit generated build output.
git restore dist/index.html 2>$null

Write-Host "Changed source files:" -ForegroundColor Yellow
git status --short

git add src
$changes = git diff --cached --name-only
if (-not $changes) {
  Write-Host "No source changes to commit." -ForegroundColor Yellow
  exit 0
}

git commit -m "Universal UI: synchronize all pages and fix alignment"
if ($LASTEXITCODE -ne 0) { throw "Git commit failed." }

git pull --rebase origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host "Rebase conflict detected. Resolve it before pushing." -ForegroundColor Red
  exit 1
}

git push origin main
if ($LASTEXITCODE -ne 0) { throw "Git push failed." }

Write-Host "" 
Write-Host "==============================================" -ForegroundColor Green
Write-Host " UNIVERSAL UI BUILT AND PUSHED SUCCESSFULLY" -ForegroundColor Green
Write-Host " Backup: $BackupRoot" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
