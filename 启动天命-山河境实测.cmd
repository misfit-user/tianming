@echo off
setlocal
cd /d "%~dp0"
title Tianming - Shanhe 2.5D
if not exist "node_modules\electron\dist\electron.exe" goto missing
set "TM_NO_SYNC=1"
set "TIANMING_WEB_OVERRIDE=%CD%\web"
echo Starting the current local game. No sync or install.
echo Refreshing the local startup inventory from current project files.
node scripts\build-native-preparation-manifest.cjs --write
set "TM_LAUNCH_EXIT=%ERRORLEVEL%"
if not "%TM_LAUNCH_EXIT%"=="0" goto failed
call npm start
set "TM_LAUNCH_EXIT=%ERRORLEVEL%"
if not "%TM_LAUNCH_EXIT%"=="0" goto failed
endlocal & exit /b 0
:missing
echo ERROR: Local Electron was not found. Nothing was installed.
pause
endlocal & exit /b 2
:failed
echo.
echo ERROR: Game exited with code %TM_LAUNCH_EXIT%.
echo Keep this window for troubleshooting.
pause
endlocal & exit /b %TM_LAUNCH_EXIT%
