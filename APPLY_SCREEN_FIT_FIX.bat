@echo off
setlocal EnableExtensions
set "PROJECT=C:\Users\jatin\RESTAPAY-RC4-GIT"
set "PATCH=%~dp0payload\styles.css"

echo Installing all-pages screen fit fix...
if not exist "%PROJECT%\package.json" (
  echo ERROR: RESTAPAY project not found at %PROJECT%
  pause
  exit /b 1
)
if not exist "%PATCH%" (
  echo ERROR: Patch file not found: %PATCH%
  echo Make sure you used Extract All before running this installer.
  pause
  exit /b 1
)

copy /Y "%PROJECT%\src\styles.css" "%PROJECT%\src\styles.css.screen-fit-backup" >nul
copy /Y "%PATCH%" "%PROJECT%\src\styles.css" >nul
if errorlevel 1 (
  echo ERROR: Could not replace src\styles.css
  pause
  exit /b 1
)

cd /d "%PROJECT%"
call npm run build
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Restoring previous styles.css...
  copy /Y "%PROJECT%\src\styles.css.screen-fit-backup" "%PROJECT%\src\styles.css" >nul
  pause
  exit /b 1
)

echo.
echo BUILD PASSED
pause
