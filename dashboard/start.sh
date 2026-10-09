#!/bin/sh
echo "VOID-NAV Command → http://localhost:8000"
(sleep 1; xdg-open http://localhost:8000/index.html 2>/dev/null || open http://localhost:8000/index.html) &
python3 -m http.server 8000
