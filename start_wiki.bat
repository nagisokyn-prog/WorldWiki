@echo off
cd /d C:\Users\Kuzma\Desktop\WorldWiki

:: Удаляем артефакты от старых сборок, оставляя текущую
cd src-tauri
if exist target (
    echo Removing old build artifacts...
    cargo sweep --time 14
)
cd ..

rem Install pnpm dependencies silently
call pnpm install

echo Starting dev build...
cmd /k pnpm tauri dev
