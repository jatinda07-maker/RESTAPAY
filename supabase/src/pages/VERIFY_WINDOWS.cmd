@echo off
setlocal
cd /d "%~dp0"
echo Installing dependencies from the public npm registry...
call npm install --registry=https://registry.npmjs.org/
if errorlevel 1 goto :fail
echo.
echo Running full RESTAPAY audit, tests, and production build...
call npm run check
if errorlevel 1 goto :fail
echo.
echo RESTAPAY verification passed.
pause
exit /b 0
:fail
echo.
echo RESTAPAY verification failed. Review the error above.
pause
exit /b 1
