param(
  [string]$ProjectPath = "C:\Users\jatin\RESTAPAY-RC4-GIT"
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path (Join-Path $ProjectPath ".git"))) {
  throw "Git project not found at $ProjectPath"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $ProjectPath "backups\ui-rebuild-$stamp"
New-Item -ItemType Directory -Path $backup -Force | Out-Null

$backupFiles = @(
  "src\main.jsx",
  "src\styles.css",
  "src\pages\Dashboard.jsx",
  "src\pages\Dashboard.css",
  "src\styles\design-system.css",
  "src\styles\universal-ui.css",
  "src\styles\dashboard-v4.css"
)
foreach ($relative in $backupFiles) {
  $source = Join-Path $ProjectPath $relative
  if (Test-Path $source) {
    $destination = Join-Path $backup $relative
    New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
    Copy-Item $source $destination -Force
  }
}

Write-Host "Applying universal UI rebuild..." -ForegroundColor Cyan
Copy-Item (Join-Path $PackageRoot "src\*") (Join-Path $ProjectPath "src") -Recurse -Force

$legacyFiles = @(
  "src\styles.css",
  "src\pages\Dashboard.css",
  "src\styles\design-system.css",
  "src\styles\universal-ui.css",
  "src\styles\dashboard-v4.css"
)
foreach ($relative in $legacyFiles) {
  $target = Join-Path $ProjectPath $relative
  if (Test-Path $target) { Remove-Item $target -Force }
}

Set-Location $ProjectPath

Write-Host "Building..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed. Nothing was committed or pushed." }

if (Test-Path "dist\index.html") { git restore dist/index.html 2>$null }

git add src
$changes = git status --short
if (-not $changes) {
  Write-Host "No source changes detected; nothing to push." -ForegroundColor Yellow
  exit 0
}

Write-Host $changes
git commit -m "Universal UI rebuild: replace legacy styles across all pages"
if ($LASTEXITCODE -ne 0) { throw "Commit failed." }

git pull --rebase origin main
if ($LASTEXITCODE -ne 0) { throw "Rebase failed. Resolve conflicts before pushing." }

git push origin main
if ($LASTEXITCODE -ne 0) { throw "Push failed." }

Write-Host "Universal UI rebuild successfully built and pushed." -ForegroundColor Green
Write-Host "Backup: $backup" -ForegroundColor DarkGray
