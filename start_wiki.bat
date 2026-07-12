@echo off
cd /d C:\Users\Kuzma\Desktop\WorldWiki

:: Удаляем артефакты от старых сборок, оставляя текущую
cd src-tauri
if exist target (
    echo Removing old build artifacts...
    cargo sweep --time 14
)
cd ..

rem Install npm dependencies silently
call npm install --legacy-peer-deps 2>nul || call npm install --legacy-peer-deps --no-fund --no-audit

echo Starting dev build...
cmd /k npx tauri dev
