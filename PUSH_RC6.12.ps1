$ErrorActionPreference = "Stop"
$branch = (git branch --show-current).Trim()
if (-not $branch) { throw "Unable to determine current Git branch." }

git add .
git commit -m "RC6.12 persist payroll deletion and stabilize import workflow"
if ($LASTEXITCODE -ne 0) {
    Write-Host "No new commit was created. Checking whether the branch still needs to be pushed..."
}
git push origin $branch
