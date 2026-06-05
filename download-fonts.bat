@echo off
setlocal enabledelayedexpansion

cd /d C:\Users\Administrator\Desktop\world-wiki\src\css

if not exist fonts mkdir fonts

echo Загружаем шрифты Inter и Fira Code...

REM Inter шрифты
curl -o fonts\inter-latin-300-normal.woff2 "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-300-normal.woff2"
curl -o fonts\inter-latin-400-normal.woff2 "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-400-normal.woff2"
curl -o fonts\inter-latin-500-normal.woff2 "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-500-normal.woff2"
curl -o fonts\inter-latin-600-normal.woff2 "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-600-normal.woff2"
curl -o fonts\inter-latin-700-normal.woff2 "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-700-normal.woff2"

REM Fira Code шрифты
curl -o fonts\fira-code-latin-400-normal.woff2 "https://cdn.jsdelivr.net/npm/@fontsource/fira-code@4.5.6/files/fira-code-latin-400-normal.woff2"
curl -o fonts\fira-code-latin-500-normal.woff2 "https://cdn.jsdelivr.net/npm/@fontsource/fira-code@4.5.6/files/fira-code-latin-500-normal.woff2"

echo.
echo Готово!
pause
