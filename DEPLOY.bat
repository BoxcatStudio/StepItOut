@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ===================================
echo   STEP It Out - One Click Deploy
echo ===================================
echo.

:: Read current version from package.json
for /f "tokens=2 delims=:, " %%a in ('findstr /c:"\"version\"" package.json') do (
    set CURRENT=%%~a
    goto :got_version
)
:got_version
echo Current version: %CURRENT%

:: Parse major.minor.patch
for /f "tokens=1,2,3 delims=." %%a in ("%CURRENT%") do (
    set MAJOR=%%a
    set MINOR=%%b
    set PATCH=%%c
)

:: Bump patch
set /a PATCH=%PATCH%+1
set VERSION=%MAJOR%.%MINOR%.%PATCH%
echo New version:     %VERSION%
echo.

:: Update package.json
echo [1/6] Updating package.json...
powershell -Command "(Get-Content package.json -Raw) -replace '\"version\": \".*?\"', '\"version\": \"%VERSION%\"' | Set-Content package.json -NoNewline"

:: Update Cargo.toml
echo [2/6] Updating Cargo.toml...
powershell -Command "(Get-Content src-tauri\Cargo.toml -Raw) -replace '(?m)^version = \".*?\"', 'version = \"%VERSION%\"' | Set-Content src-tauri\Cargo.toml -NoNewline"

:: Update tauri.conf.json
echo [3/6] Updating tauri.conf.json...
powershell -Command "(Get-Content src-tauri\tauri.conf.json -Raw) -replace '\"version\": \".*?\"', '\"version\": \"%VERSION%\"' | Set-Content src-tauri\tauri.conf.json -NoNewline"

:: Build
echo [4/6] Building release...
echo.
call npm run tauri build
if errorlevel 1 (
    echo.
    echo ===================================
    echo   BUILD FAILED
    echo ===================================
    echo.
    pause
    exit /b 1
)

:: Git commit and tag
echo.
echo [5/6] Committing v%VERSION%...
git add -A
git commit -m "v%VERSION%"
git tag v%VERSION%

:: Push to trigger GitHub Actions
echo [6/6] Pushing to GitHub...
git push origin main --tags

echo.
echo ===================================
echo   Deploy Complete - v%VERSION%
echo ===================================
echo.
echo   Local installer:
echo     src-tauri\target\release\bundle\nsis\
echo.
echo   GitHub Actions will build the signed
echo   release for auto-updates.
echo.
pause
