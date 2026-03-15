@echo off
echo Installing STEP It Out dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo Failed to install npm dependencies.
    echo Ensure Node.js is installed: https://nodejs.org/
    pause
    exit /b 1
)
echo.
echo Dependencies installed successfully.
echo.
echo Note: First run will compile the Rust backend (may take 1-2 minutes).
pause
