@echo off
echo Starting VOID-NAV Command on http://localhost:8000
start "" "http://localhost:8000/index.html"
python -m http.server 8000
