@echo off
cd /d "%~dp0"
wsl.exe -d Ubuntu -- bash -lc "./scripts/start-dev.sh"
if errorlevel 1 (
  echo.
  echo The app did not start. Copy the error above into the chat.
  pause
)
