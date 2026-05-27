@echo off
title Deepsikha Ledger Manager Web App Launcher (Vite + Supabase)
echo ======================================================
echo   DEEPSIKHA RESIDENCY - LEDGER MANAGER WEB APP
echo   (Serverless: Vercel + Supabase Edition)
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

:: Wait 2 secs and open browser
echo.
echo [2/3] Preparing to open web browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173

:: Start dev server
echo.
echo [3/3] Launching Vite development server...
echo Server running on http://localhost:5173
echo Close this window to stop the application.
echo ------------------------------------------------------
call npm run dev

pause
