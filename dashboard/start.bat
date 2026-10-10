@echo off
echo Starting VOID-NAV Command (dashboard + phone SOS)
start "" "http://localhost:8000/index.html"
python server.py
if errorlevel 1 py server.py
pause
