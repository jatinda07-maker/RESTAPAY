$ErrorActionPreference = 'Stop'

$SourceRoot = $PSScriptRoot
$TargetRoot = 'C:\Users\jatin\RESTAPAY-RC4-GIT'

if (-not (Test-Path $TargetRoot)) {
    throw "RESTAPAY project was not found at $TargetRoot"
}

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $TargetRoot "backups\universal-ui-$Stamp"
$TargetSrc = Join-Path $TargetRoot 'src'
$SourceSrc = Join-Path $SourceRoot 'src'

Write-Host "Creating backup: $BackupRoot" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
Copy-Item $TargetSrc (Join-Path $BackupRoot 'src') -Recurse -Force

try {
    Write-Host 'Replacing source with the universal UI rebuild...' -ForegroundColor Cyan
    Remove-Item $TargetSrc -Recurse -Force
    Copy-Item $SourceSrc $TargetSrc -Recurse -Force

    Write-Host 'Checking CSS architecture...' -ForegroundColor Cyan
    $CssFiles = Get-ChildItem $TargetSrc -Recurse -Filter '*.css'
    if ($CssFiles.Count -ne 1 -or $CssFiles[0].FullName -notlike '*\src\styles\universal.css') {
        throw "Expected exactly one CSS file: src\styles\universal.css. Found $($CssFiles.Count)."
    }

    Set-Location $TargetRoot

    Write-Host 'Building project...' -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }

    git restore dist/index.html 2>$null
    git add -A

    $Changes = git status --porcelain
    if (-not $Changes) {
        Write-Host 'No source changes to commit.' -ForegroundColor Yellow
        exit 0
    }

    git commit -m "Universal UI foundation: remove legacy CSS and restore approved navigation"
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed.' }

    git pull --rebase origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull/rebase failed. Resolve the conflict before pushing.' }

    git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }

    Write-Host 'Universal UI rebuild built and pushed successfully.' -ForegroundColor Green
}
catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'Restoring the source backup...' -ForegroundColor Yellow
    if (Test-Path $TargetSrc) { Remove-Item $TargetSrc -Recurse -Force }
    Copy-Item (Join-Path $BackupRoot 'src') $TargetSrc -Recurse -Force
    throw
}
