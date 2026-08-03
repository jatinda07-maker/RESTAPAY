param(
  [string]$Target = "$env:USERPROFILE\RESTAPAY-RC4-GIT"
)

$ErrorActionPreference = "Stop"
$Source = Split-Path -Parent $MyInvocation.MyCommand.Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Target "backups\universal-ui-$Timestamp"

Write-Host "RESTAPAY Universal UI Rebuild" -ForegroundColor Cyan
Write-Host "Source: $Source"
Write-Host "Target: $Target"

if (!(Test-Path (Join-Path $Target "package.json"))) {
  throw "RESTAPAY project not found at $Target"
}

New-Item -ItemType Directory -Path $Backup -Force | Out-Null
Copy-Item (Join-Path $Target "src") (Join-Path $Backup "src") -Recurse -Force
Write-Host "Backup created: $Backup" -ForegroundColor Green

# Replace the presentation source with the rebuilt source.
Remove-Item (Join-Path $Target "src") -Recurse -Force
Copy-Item (Join-Path $Source "src") (Join-Path $Target "src") -Recurse -Force

Set-Location $Target
Write-Host "Building..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed. Restoring source backup." -ForegroundColor Red
  Remove-Item (Join-Path $Target "src") -Recurse -Force
  Copy-Item (Join-Path $Backup "src") (Join-Path $Target "src") -Recurse -Force
  exit 1
}

# Avoid committing generated output when tracked.
git restore dist/index.html 2>$null

git add -A
git status --short

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "No source changes to commit." -ForegroundColor Yellow
  exit 0
}

git commit -m "Universal UI foundation and approved hybrid Dashboard"
if ($LASTEXITCODE -ne 0) { exit 1 }

git pull --rebase origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host "Rebase conflict detected. Resolve it before pushing." -ForegroundColor Red
  exit 1
}

git push origin main
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Build, commit, and push completed." -ForegroundColor Green
