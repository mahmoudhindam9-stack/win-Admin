@echo off
title Windows Performance Optimizer - Setup Builder
echo ========================================================
echo      Windows Performance Optimizer - Setup Builder
echo ========================================================
echo.
echo Checking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js from https://nodejs.org/ first.
    pause
    exit /b
)

if not exist "buildResources\icon.ico" (
    echo.
    echo [WARNING] Your program icon was not found!
    echo Please make sure you have a folder named "buildResources" and your "icon.ico" is inside it.
    echo If you continue without it, the build might fail or use a default icon.
    echo.
    pause
)

echo [1/3] Installing required packages...
call npm install

echo.
echo [2/3] Building the official Setup.exe file...
echo This will attach your program icon and enable GitHub Auto-Updates!
echo Please wait, this might take a couple of minutes...
call npm run build:win

echo.
echo [3/3] Done! Opening the release folder...
explorer "%~dp0release"

echo.
echo SUCCESS! 
echo Please run the "Windows-Performance-Optimizer-Suite-Setup" .exe file from the folder that just opened.
pause
