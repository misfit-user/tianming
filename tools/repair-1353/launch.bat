@echo off
setlocal
if /I "%~x1"==".asar" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0repair-1353.ps1" -AppAsarPath "%~1" %2 %3 %4 %5
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0repair-1353.ps1" %*
)
endlocal
