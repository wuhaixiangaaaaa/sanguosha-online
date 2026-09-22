@echo off
echo T1-start
set "CPOLAR=C:\Program Files\cpolar\cpolar.exe"
echo T2-before-ifexist
if not exist "%CPOLAR%" (
  echo T3-inside-ifexist
  where cpolar >nul 2>nul
  if errorlevel 1 (
    echo T4-inside-errorlevel
    goto :end
  )
  for /f "delims=" %%c in ('where cpolar') do if not defined CPOLAR_FOUND (set "CPOLAR=%%c" & set "CPOLAR_FOUND=1")
)
echo T5-after-ifexist
findstr /i "authtoken" "%USERPROFILE%\.cpolar\cpolar.yml" >nul 2>nul
echo T6-after-findstr el=[%errorlevel%]
if errorlevel 1 (
  echo T7-authtoken-missing
  goto :end
)
echo T8-authtoken-ok
:end
echo T9-done
