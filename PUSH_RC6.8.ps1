$ErrorActionPreference = "Stop"
$branch = git branch --show-current
if (-not $branch) { throw "Unable to determine the current Git branch." }
Write-Host "Current branch: $branch"
git add .
$pending = git status --porcelain
if ($pending) {
  git commit -m "RC6.8 restore sticky totals and audit Labor Mix entries"
} else {
  Write-Host "Nothing new to commit."
}
git push origin $branch
