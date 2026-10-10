#!/bin/sh
cd "$(dirname "$0")"
(sleep 1; xdg-open http://localhost:8000/index.html 2>/dev/null || open http://localhost:8000/index.html) &
python3 server.py
