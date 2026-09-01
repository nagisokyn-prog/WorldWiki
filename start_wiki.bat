@echo off
cd /d C:\Users\Kuzma\Desktop\WorldWiki

:: Очистка устаревших артефактов Cargo рекурсивно по всем подпроектам (лимит 5GB и старше 3 дней)
cargo sweep --help >nul 2>nul
if %errorlevel% equ 0 (
    echo [Cargo] Cleaning old build artifacts across workspace...
    cargo sweep -r --maxsize 5GB
    cargo sweep -r --time 3
)

rem Install pnpm dependencies silently
call pnpm install

echo Generating TS bindings...
cd src-tauri
cargo test export_bindings
cd ..

echo Starting dev build...
cmd /k pnpm tauri dev -- --features ai-local
