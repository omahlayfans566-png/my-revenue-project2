@echo off
title DateClone - Status
cd /d "%~dp0"
echo.
echo  ============================================
echo   DateClone Process Status
echo  ============================================
pm2 list
echo.
echo  Backend logs (last 20 lines):
pm2 logs dateclone-backend --lines 20 --nostream
echo.
pause
