@echo off
cd /d "%~dp0"
set "NODE_EXE=%~dp0runtime\node.exe"
if not exist "%NODE_EXE%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] node.exe not found (runtime\node.exe missing, no system Node.js)
    goto :end
  )
  set "NODE_EXE=node"
)
echo SEG1-OK NODE=[%NODE_EXE%]
:end
echo done
