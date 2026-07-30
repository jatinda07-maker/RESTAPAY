$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Run-Step([string]$Name, [scriptblock]$Command) {
  Write-Host "`n==> $Name" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE" }
}

Write-Host "RESTAPAY RC6.24 consolidation" -ForegroundColor Green

$conflicts = git diff --name-only --diff-filter=U
if ($LASTEXITCODE -ne 0) { throw "Unable to inspect Git conflicts." }
if ($conflicts) {
  Write-Host "The package will resolve these currently unmerged paths:" -ForegroundColor Yellow
  $conflicts | ForEach-Object { Write-Host " - $_" }
}

$markers = Get-ChildItem -Path .\src -Recurse -File -Include *.js,*.jsx,*.css,*.json | Select-String -Pattern '^(<<<<<<<|=======|>>>>>>>)' -ErrorAction SilentlyContinue
if ($markers) {
  $markers | ForEach-Object { Write-Host $_.Path ':' $_.LineNumber $_.Line }
  throw "Merge conflict markers remain in source files. Nothing was committed or pushed."
}

if (Test-Path .\dist) { Remove-Item .\dist -Recurse -Force }
Run-Step "Install dependencies" { npm install --registry=https://registry.npmjs.org }
Run-Step "Production build" { npm run build }
Run-Step "Stage resolved project" { git add -A }

$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host "No staged changes. The RC6.24 changes may already be committed." -ForegroundColor Yellow
} else {
  Run-Step "Commit RC6.24" { git commit -m "RC6.24 consolidate payroll updates, enterprise UI, and dashboard homepage" }
}

Run-Step "Fetch remote branch" { git fetch origin rc5-redesign }
$behind = git rev-list --count HEAD..origin/rc5-redesign
if ([int]$behind -gt 0) {
  throw "Remote rc5-redesign changed again and is $behind commit(s) ahead. Push stopped to prevent overwriting work."
}
Run-Step "Push rc5-redesign" { git push origin rc5-redesign }
Write-Host "`nRC6.24 built and pushed successfully." -ForegroundColor Green
