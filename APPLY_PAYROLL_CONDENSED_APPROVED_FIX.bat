@echo off
setlocal
cd /d "%~dp0"
if not exist "src\pages\Payroll.jsx" (
  echo ERROR: Extract this ZIP into the RESTAPAY project root.
  pause
  exit /b 1
)
findstr /C:"RC4 Sprint 1.3 - compact payroll" ".\src\styles.css" >nul 2>&1
if errorlevel 1 type "PAYROLL_FORMATTING.css" >> ".\src\styles.css"
call npm run build
if errorlevel 1 (
  echo BUILD FAILED. Nothing was committed.
  pause
  exit /b 1
)
git add src\pages\Payroll.jsx src\pages\ApprovedPayroll.jsx src\styles.css
git commit -m "Add condensed payroll creation and approved payroll bulk editing"
echo.
echo Build and commit completed. Push with:
echo git push origin rc4-sprint1.3
pause
