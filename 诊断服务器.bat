@echo off
cd /d "%~dp0"
set LOG=sg-diag-log.txt
echo === SGS server diagnostic %date% %time% === > %LOG%
echo CWD: %CD% >> %LOG%

echo. >> %LOG%
echo [1] node runtime check >> %LOG%
if exist "runtime\node.exe" (echo   runtime\node.exe: FOUND >> %LOG%) else (echo   runtime\node.exe: MISSING >> %LOG%)
"runtime\node.exe" -v >> %LOG% 2>&1

echo. >> %LOG%
echo [2] port 8080 BEFORE start >> %LOG%
netstat -ano | findstr ":8080" >> %LOG% 2>&1

echo. >> %LOG%
echo [3] launching server.js ... >> %LOG%
start "SGS-Diag-Server" cmd /c "runtime\node.exe server.js > sgs-server-output.txt 2>&1"
ping -n 6 127.0.0.1 >nul

echo. >> %LOG%
echo [4] port 8080 AFTER start >> %LOG%
netstat -ano | findstr ":8080" >> %LOG% 2>&1

echo. >> %LOG%
echo [5] server output >> %LOG%
if exist sgs-server-output.txt (type sgs-server-output.txt >> %LOG% 2>&1) else (echo   (no output file) >> %LOG%)

echo. >> %LOG%
echo [6] node processes now >> %LOG%
tasklist /fi "imagename eq node.exe" >> %LOG% 2>&1

echo. >> %LOG%
echo === DONE === >> %LOG%
echo.
echo   Diagnostic finished. Send the file "sg-diag-log.txt" (in this folder) to the AI.
echo.
pause
