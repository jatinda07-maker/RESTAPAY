param(
  [string]$ProjectPath = "C:\Users\jatin\RESTAPAY-RC4-GIT",
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackupRoot = Join-Path $ProjectPath ("backups\ui-v2-phase1-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

if (-not (Test-Path (Join-Path $ProjectPath "package.json"))) {
  throw "RESTAPAY project was not found at $ProjectPath"
}

Write-Host "Creating backup..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
$backupItems = @(
  "src\main.jsx",
  "src\ui-v2",
  "src\pages-v2",
  "src\styles-v2"
)
foreach ($relative in $backupItems) {
  $source = Join-Path $ProjectPath $relative
  if (Test-Path $source) {
    $destination = Join-Path $BackupRoot $relative
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item $source $destination -Recurse -Force
  }
}

Write-Host "Applying RESTAPAY V2 Phase 1..." -ForegroundColor Cyan
$copyItems = @(
  "src\main.jsx",
  "src\ui-v2",
  "src\pages-v2",
  "src\styles-v2",
  "RESTAPAY_V2_PHASE1.md"
)
foreach ($relative in $copyItems) {
  $source = Join-Path $PackageRoot $relative
  $destination = Join-Path $ProjectPath $relative
  if (Test-Path $destination) { Remove-Item $destination -Recurse -Force }
  New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
  Copy-Item $source $destination -Recurse -Force
}

Push-Location $ProjectPath
try {
  Write-Host "Building..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed." }

  git restore dist/index.html 2>$null
  git add src/main.jsx src/ui-v2 src/pages-v2 src/styles-v2 RESTAPAY_V2_PHASE1.md
  git commit -m "RESTAPAY V2 Phase 1: new app shell and hybrid dashboard"

  if (-not $NoPush) {
    git pull --rebase origin main
    if ($LASTEXITCODE -ne 0) { throw "Pull/rebase failed." }
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
  }

  Write-Host "RESTAPAY V2 Phase 1 completed successfully." -ForegroundColor Green
}
catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "Backup is available at: $BackupRoot" -ForegroundColor Yellow
  throw
}
finally {
  Pop-Location
}
