@echo off
title Building Residence Management Web App Launcher (Vite + Supabase)
echo ======================================================
echo   BUILDING RESIDENCE MANAGEMENT WEB APP
echo   (Vite + Supabase)
echo ======================================================
echo.

:: Check for Node.js
echo [1/3] Checking Node.js environment...
node -v >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org
    echo then try running this launcher again.
    echo.
    pause
    exit /b 1
)

:: Run npm install if node_modules not present
if not exist "node_modules" (
    echo.
    echo Installing local development packages [Vite]...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to install packages. Please make sure you have internet access.
        pause
        exit /b 1
    )
) else (
    echo Node.js packages verified successfully.
)

:: Wait briefly and open browser
echo.
echo [2/3] Preparing to open web browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173

:: Start dev server with network host
echo.
echo [3/3] Launching Vite dev server (network-enabled)...
echo.
echo ================================================
echo  Local   : http://localhost:5173
echo  Network : http://YOUR-IP:5173
echo ================================================
echo  To access from phone/tablet/other PC:
echo  1. Find your PC's IP (run: ipconfig)
echo  2. Open http://YOUR-IP:5173 on other device
echo  3. Must be on the same WiFi network
echo ================================================
echo  Close this window to stop the app.
echo ================================================
echo.
call npm run dev -- --host

pause
