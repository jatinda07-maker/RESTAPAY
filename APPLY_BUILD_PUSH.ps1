$ErrorActionPreference = 'Stop'

$Project = 'C:\Users\jatin\RESTAPAY-RC4-GIT'
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backup = Join-Path $Project ('backup_before_rc22_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))

Write-Host 'Backing up current source...' -ForegroundColor Cyan
New-Item -ItemType Directory -Path $Backup -Force | Out-Null
Copy-Item (Join-Path $Project 'src') $Backup -Recurse -Force

Write-Host 'Applying RC22 structural UI fix...' -ForegroundColor Cyan
Remove-Item (Join-Path $Project 'src') -Recurse -Force
Copy-Item (Join-Path $PackageRoot 'src') $Project -Recurse -Force

Write-Host 'Verifying one active CSS file...' -ForegroundColor Cyan
$cssFiles = Get-ChildItem (Join-Path $Project 'src') -Recurse -Filter *.css
$cssFiles | ForEach-Object { Write-Host $_.FullName }
if ($cssFiles.Count -ne 1 -or $cssFiles[0].Name -ne 'universal.css') {
  throw 'Expected exactly one CSS file: src\styles\universal.css'
}

Set-Location $Project
Write-Host 'Building...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Build failed. Restoring previous source.' -ForegroundColor Red
  Remove-Item (Join-Path $Project 'src') -Recurse -Force
  Copy-Item (Join-Path $Backup 'src') $Project -Recurse -Force
  exit 1
}

git restore dist/index.html 2>$null
git add src
$changes = git status --porcelain
if (-not $changes) {
  Write-Host 'No source changes to commit.' -ForegroundColor Yellow
  exit 0
}

git commit -m 'RC22 fix navigation width, desktop alignment and responsive page flow'
if ($LASTEXITCODE -ne 0) { exit 1 }

git pull --rebase origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Rebase conflict detected. Resolve it before pushing.' -ForegroundColor Red
  exit 1
}

git push origin main
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host 'RC22 built and pushed successfully.' -ForegroundColor Green
