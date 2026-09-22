@echo off
echo T1
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
