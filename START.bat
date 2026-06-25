@echo off
title DateClone - Starting...
color 0A
echo.
echo  ============================================
echo    DateClone - Africa's Dating Platform
echo  ============================================
echo.

:: Check if Node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed.
    echo  Download from: https://nodejs.org
    pause
    exit /b 1
)

:: Set working directory to script location
cd /d "%~dp0"

echo  [1/4] Checking backend dependencies...
if not exist "backend\node_modules" (
    echo  Installing backend packages...
    cd backend && npm install && cd ..
)

echo  [2/4] Checking frontend dependencies...
if not exist "dateclone\node_modules" (
    echo  Installing frontend packages...
    cd dateclone && npm install && cd ..
)

echo  [3/4] Starting backend with PM2...
pm2 delete dateclone-backend >nul 2>nul
pm2 start ecosystem.config.cjs
pm2 save

echo  [4/4] Starting frontend...
echo.
echo  ============================================
echo   Backend  : http://localhost:5000
echo   Frontend : http://localhost:5174
echo   Health   : http://localhost:5000/api/health
echo  ============================================
echo.
echo  Backend is running via PM2 (auto-restart enabled)
echo  Starting frontend dev server...
echo  Press Ctrl+C to stop the frontend.
echo.

cd dateclone && npm run dev
