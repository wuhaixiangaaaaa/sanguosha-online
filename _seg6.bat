@echo off
echo T1
if 1==0 (
  echo [ERROR] cpolar authtoken missing on THIS computer.
  echo         Open cmd and run once:  cpolar authtoken YOUR_TOKEN
  goto :end
)
echo SEG-OK
:end
echo done
