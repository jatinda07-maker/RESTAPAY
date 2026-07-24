@echo off
setlocal
cd /d "%~dp0"
if not exist "src" (
  echo ERROR: Extract this ZIP into the RESTAPAY project root.
  pause
  exit /b 1
)
echo Payroll, Approved Payroll, navigation, and styles are already copied into this folder.
echo.
echo Installing dependencies and testing production build...
call npm install
if errorlevel 1 goto :fail
call npm run build
if errorlevel 1 goto :fail
echo.
echo BUILD PASSED.
echo Run: git add .
echo Run: git commit -m "Fix payroll import clear create and approved payroll page"
echo Run: git push origin rc4-sprint1.3
pause
exit /b 0
:fail
echo.
echo BUILD FAILED. Review the error above before pushing.
pause
exit /b 1
