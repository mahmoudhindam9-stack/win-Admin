@echo off
title Windows Performance Optimizer Suite (Edge App Mode)
echo ======================================================================
echo    Windows Performance Optimizer Suite - Standalone Lightweight Mode
echo ======================================================================
echo.
echo Launching application using Windows native Microsoft Edge engine...
echo Memory consumption: ~35 MB (Zero Chromium bundle footprint)
echo.

set EDGE_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist %EDGE_PATH% (
    set EDGE_PATH="C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

if not exist %EDGE_PATH% (
    echo [ERROR] Microsoft Edge was not found at standard paths.
    pause
    exit /b 1
)

start "" %EDGE_PATH% --app="http://localhost:3000" --user-data-dir="%TEMP%\WinOptEdgeApp" --window-size=1280,800
