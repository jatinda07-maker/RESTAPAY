@echo off
cd /d "%~dp0"
if "%GEMINI_API_KEY%"=="" (
  echo GEMINI_API_KEY is not set.
  echo.
  echo Type this first, then run this file again:
  echo set GEMINI_API_KEY=your_key_here
  echo.
  pause
  exit /b 1
)
start "Resta Pay Server" cmd /k npm start
timeout /t 2 /nobreak >nul
start "" http://localhost:4173
