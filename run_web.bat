@echo off
title Deepsikha Ledger Manager Web App Launcher
echo ======================================================
echo   DEEPSIKHA RESIDENCY - LEDGER MANAGER WEB APP
echo ======================================================
echo.

:: Check requirements
echo [1/3] Checking python libraries...
python -c "import flask, pandas, openpyxl, reportlab" 2>nul
if %errorlevel% neq 0 (
    echo.
    echo Missing packages detected. Installing requirements...
    pip install Flask pandas openpyxl reportlab
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install packages. Please make sure pip is working and you have internet access.
        pause
        exit /b 1
    )
) else (
    echo Packages verified successfully.
)

:: Wait 1 sec and open browser
echo.
echo [2/3] Preparing to open web browser...
timeout /t 2 /nobreak >nul
start http://127.0.0.1:5000

:: Start server
echo.
echo [3/3] Launching Flask backend server...
echo Server running on http://127.0.0.1:5000
echo Close this window to stop the application.
echo ------------------------------------------------------
python server.py

pause
