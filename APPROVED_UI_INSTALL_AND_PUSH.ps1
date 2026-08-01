$ErrorActionPreference = 'Stop'
$project = 'C:\Users\jatin\RESTAPAY-RC4-GIT'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path

Copy-Item "$source\src\main.jsx" "$project\src\main.jsx" -Force
Copy-Item "$source\src\styles.css" "$project\src\styles.css" -Force
Copy-Item "$source\src\components\Layout.jsx" "$project\src\components\Layout.jsx" -Force
Copy-Item "$source\src\data\mockData.js" "$project\src\data\mockData.js" -Force
if (Test-Path "$project\src\pages\ApprovedPayroll.jsx") { Remove-Item "$project\src\pages\ApprovedPayroll.jsx" -Force }

Set-Location $project
npm run build

git add src/main.jsx src/styles.css src/components/Layout.jsx src/data/mockData.js
git add -u src/pages/ApprovedPayroll.jsx
git commit -m "Rebuild approved right-panel UI and remove redundant approved payroll page"
git pull --rebase origin main
git push origin main
