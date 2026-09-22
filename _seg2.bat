@echo off
cd /d "%~dp0"
set "CPOLAR=C:\Program Files\cpolar\cpolar.exe"
if not exist "%CPOLAR%" (
  where cpolar >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] cpolar is not installed on this computer.
    echo         1. Run cpolar_amd64.msi in this folder to install it.
    echo         2. Then open cmd and run once:
    echo            cpolar authtoken YOUR_TOKEN
    echo            (token: login https://www.cpolar.com -^> dashboard)
    goto :end
  )
  for /f "delims=" %%c in ('where cpolar') do if not defined CPOLAR_FOUND (set "CPOLAR=%%c" & set "CPOLAR_FOUND=1")
)
echo SEG2A-OK CPOLAR=[%CPOLAR%]

findstr /i "authtoken" "%USERPROFILE%\.cpolar\cpolar.yml" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] cpolar authtoken missing on THIS computer.
  echo         Open cmd and run once:  cpolar authtoken YOUR_TOKEN
  echo         (same token as your office PC, find it on cpolar website)
  goto :end
)
echo SEG2B-OK authtoken present
:end
echo done
