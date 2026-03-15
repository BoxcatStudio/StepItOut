@echo off
cd /d "%~dp0"

REM Free port 5173 in case a previous run didn't exit cleanly
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173"') do taskkill /PID %%a /F 2>nul

if not exist "node_modules" (
    echo node_modules not found. Running DEP.bat first...
    call DEP.bat
)

echo.
echo Launching STEP It Out (DEV mode with debug)...
echo Keep this window open. Close the app window when done.
echo.
call npm run tauri dev
echo.
echo App closed. Exit code: %ERRORLEVEL%
pause
