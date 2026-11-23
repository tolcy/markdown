@echo off
cd /d "%~dp0"
set "PORTABLE=%~dp0release\Tolcy.exe"
set "BUILT=%~dp0src-tauri\target\release\tolcy.exe"
if exist "%PORTABLE%" (
  start "" "%PORTABLE%"
  exit /b 0
)
if exist "%BUILT%" (
  start "" "%BUILT%"
  exit /b 0
)
echo Tolcy.exe not found. Put a build in release\ or run: npm run desktop:build
pause
exit /b 1
