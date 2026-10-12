@echo off
title Dodentocht Teamtraining Planner (GitHub Pages App)
echo ========================================================
echo   Starten van Dodentocht Teamtraining Planner
echo   (Zelfde structuur als de Hardware Selector)
echo ========================================================
echo.
echo De browser wordt geopend op http://127.0.0.1:8000/
echo Druk op Ctrl+C om af te sluiten.
echo.
start http://127.0.0.1:8000/index.html
python -m http.server 8000
pause
