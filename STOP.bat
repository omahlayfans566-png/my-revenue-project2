@echo off
title DateClone - Stopping...
color 0C
cd /d "%~dp0"
echo.
echo  Stopping DateClone backend...
pm2 stop dateclone-backend
pm2 delete dateclone-backend
echo  Backend stopped.
echo.
pause
