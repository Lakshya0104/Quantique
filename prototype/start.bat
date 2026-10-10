@echo off
cd /d "%~dp0"
echo Starting VOID-NAV command server...
start "" "http://localhost:8800/command"
python server.py %*
if errorlevel 1 py server.py %*
pause
