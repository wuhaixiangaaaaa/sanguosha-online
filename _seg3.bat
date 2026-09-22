@echo off
echo MARK-A
findstr /i "authtoken" "%USERPROFILE%\.cpolar\cpolar.yml" >nul 2>nul
echo MARK-B errorlevel=[%errorlevel%]
if errorlevel 1 (
  echo INSIDE-IF-BLOCK
  goto :end
)
echo MARK-C after if
:end
echo done
