@echo off
cd /d "%~dp0"
title SGS-Online-Launcher

echo ============================================
echo   SGS Online Launcher (SanGuoSha)
echo ============================================
echo.

rem ---- node: bundled runtime first, then system ----
set "NODE_EXE=%~dp0runtime\node.exe"
if not exist "%NODE_EXE%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] node.exe not found (runtime\node.exe missing, no system Node.js)
    goto :end
  )
  set "NODE_EXE=node"
)

rem ---- cpolar: default install path, then PATH ----
set "CPOLAR=C:\Program Files\cpolar\cpolar.exe"
if not exist "%CPOLAR%" (
  where cpolar >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] cpolar is not installed on this computer.
    echo         1. Run cpolar_amd64.msi in this folder to install it.
    echo         2. Then open cmd and run once:
    echo            cpolar authtoken YOUR_TOKEN
    echo            token: login https://www.cpolar.com -^> dashboard
    goto :end
  )
  for /f "delims=" %%c in ('where cpolar') do if not defined CPOLAR_FOUND (set "CPOLAR=%%c" & set "CPOLAR_FOUND=1")
)

findstr /i "authtoken" "%USERPROFILE%\.cpolar\cpolar.yml" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] cpolar authtoken missing on THIS computer.
  echo         Open cmd and run once:  cpolar authtoken YOUR_TOKEN
  echo         same token as your office PC, find it on cpolar website
  goto :end
)

rem ---- cleanup: kill old cpolar, remove stale logs ----
taskkill /f /im cpolar.exe >nul 2>nul
ping -n 3 127.0.0.1 >nul
del "%TEMP%\cpolar*.log" >nul 2>nul
del "%TEMP%\cpolar*.log.*" >nul 2>nul

rem ---- [1/2] game server: skip if port 8080 already listening ----
netstat -ano | findstr /c:":8080 " | findstr /i "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [1/2] Game server already running on port 8080, skip.
) else (
  echo [1/2] Starting game server ...
  start "SGS-Server" cmd /k ""%NODE_EXE%" server.js"
  ping -n 3 127.0.0.1 >nul
)

rem ---- [2/2] cpolar tunnel: fresh log file each run ----
echo [2/2] Starting cpolar tunnel ...
set "CPLOG=%TEMP%\cpolar_run_%RANDOM%%RANDOM%.log"
start "cpolar-tunnel" /min cmd /c ""%CPOLAR%" http 8080 -region=cn -log="%CPLOG%" -log-level=INFO"

echo.
echo   Fetching and VERIFYING your public URL, please wait ...
echo.

rem ---- URL helper: python+geturl.py if available, else PowerShell geturl.ps1 ----
set "PYEXE="
py --version >nul 2>nul && set "PYEXE=py"
if not defined PYEXE (python --version >nul 2>nul && set "PYEXE=python")
if defined PYEXE (
  "%PYEXE%" geturl.py "%CPLOG%"
  if not errorlevel 1 goto :url_done
  echo   python helper failed, trying PowerShell ...
)
powershell -noprofile -executionpolicy bypass -file geturl.ps1 "%CPLOG%"
if errorlevel 1 (
  echo.
  echo   [WARN] URL not found automatically. Look at the minimized
  echo          "cpolar-tunnel" window on the taskbar, find the line
  echo          "Forwarding https://... -^> http://localhost:8080".
  goto :end
)
:url_done
echo.
echo   The URL above is VERIFIED and already COPIED to your clipboard.
echo   Ctrl+V in WeChat and send it to your friend.
echo   Same url is also saved at Desktop\sgs-url.txt
echo.
echo --------------------------------------------
echo   You    : http://localhost:8080  -^>  online game  -^>  create room
echo   Friend : open the URL  -^>  online game  -^>  nickname + room no.
echo   Quit   : close the new windows on the taskbar
echo --------------------------------------------
:end
echo.
pause
