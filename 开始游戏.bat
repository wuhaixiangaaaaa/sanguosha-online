@echo off
cd /d "%~dp0"
title SGS - Start Game

echo ============================================
echo   SanGuoSha - Start Game (Solo / LAN)
echo ============================================
echo.

rem ---- node: prefer bundled runtime\node.exe, fallback to system node ----
set "NODE_EXE=%~dp0runtime\node.exe"
if not exist "%NODE_EXE%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] node.exe not found (runtime\node.exe missing, no system Node.js)
    goto :end
  )
  set "NODE_EXE=node"
)

rem ---- game server: skip if port 8080 already listening ----
netstat -ano | findstr /c:":8080 " | findstr /i "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [OK] Game server already running on port 8080.
) else (
  echo [1/1] Starting game server ...
  start "SGS-Server" cmd /k ""%NODE_EXE%" server.js"
  ping -n 3 127.0.0.1 >nul
)

echo.
echo --------------------------------------------
echo   Solo play : just double-click index.html
echo   You (host): http://localhost:8080  -^>  online game  -^>  create room
echo.
echo   Friends on the SAME WiFi join via:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=1 delims= " %%b in ("%%a") do echo     http://%%b:8080
echo.
echo   Friends NOT on your WiFi: run the ONLINE launcher bat instead
echo   (the one whose name contains "Online", needs cpolar installed).
echo --------------------------------------------
:end
echo.
pause
