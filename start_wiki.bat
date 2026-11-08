@echo off
cd /d C:\Users\Kuzma\Desktop\WorldWiki

set "SWEEP_FLAG_FILE=%TEMP%\cargo_sweep_last_run.txt"
set "DAYS_BETWEEN_SWEEPS=14"

:: Проверяем, нужно ли запускать cargo sweep
call :check_sweep_needed
if errorlevel 1 goto :skip_sweep

:: Очистка устаревших артефактов Cargo (только если прошло больше 14 дней)
echo [Cargo] Cleaning old build artifacts across workspace (last sweep was more than %DAYS_BETWEEN_SWEEPS% days ago)...
cargo sweep --help >nul 2>nul
if %errorlevel% equ 0 (
    cargo sweep -r --maxsize 20.0GB
    :: Запоминаем дату успешной чистки
    echo %DATE% %TIME% > "%SWEEP_FLAG_FILE%"
) else (
    echo [WARN] cargo-sweep not installed, skipping...
)

:skip_sweep

rem Install pnpm dependencies silently
call pnpm install

echo Generating TS bindings...
call node scripts/codegen.js

echo Starting dev build...
cmd /k pnpm tauri dev -- --features ai
exit /b

:check_sweep_needed
if not exist "%SWEEP_FLAG_FILE%" (
    :: Файла нет — чистка нужна
    exit /b 0
)

:: Читаем дату из файла
set /p LAST_RUN=<"%SWEEP_FLAG_FILE%"

:: Сравниваем с текущей датой (упрощённо — только для Win)
for /f "tokens=1-3 delims=." %%a in ("%DATE%") do (
    set CUR_DD=%%a
    set CUR_MM=%%b
    set CUR_YYYY=%%c
)
for /f "tokens=1-3 delims=." %%a in ("%LAST_RUN%") do (
    set LAST_DD=%%a
    set LAST_MM=%%b
    set LAST_YYYY=%%c
)

:: Вычисляем разницу в днях (упрощённо, без учёта високосных)
:: Переводим даты в дни от 01.01.1970
set /a CUR_DAYS=%CUR_YYYY%*365 + %CUR_MM%*30 + %CUR_DD%
set /a LAST_DAYS=%LAST_YYYY%*365 + %LAST_MM%*30 + %LAST_DD%
set /a DIFF=%CUR_DAYS% - %LAST_DAYS%

if %DIFF% geq %DAYS_BETWEEN_SWEEPS% (
    :: Прошло больше N дней — чистка нужна
    exit /b 0
) else (
    :: Прошло меньше — чистка не нужна
    echo [Cargo] Skipping sweep, last run was %DIFF% days ago (need %DAYS_BETWEEN_SWEEPS% days)
    exit /b 1
)