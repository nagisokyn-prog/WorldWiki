cd C:\Users\Administrator\Desktop\world-wiki\src\css

# Создаем папку для шрифтов если её нет
if (!(Test-Path 'fonts')) { 
    New-Item -ItemType Directory -Path 'fonts' -Force
}

# URL'ы для загрузки шрифтов из jsDelivr CDN
$urls = @(
    'https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-300-normal.woff2',
    'https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-400-normal.woff2',
    'https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-500-normal.woff2',
    'https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-600-normal.woff2',
    'https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-700-normal.woff2',
    'https://cdn.jsdelivr.net/npm/@fontsource/fira-code@4.5.6/files/fira-code-latin-400-normal.woff2',
    'https://cdn.jsdelivr.net/npm/@fontsource/fira-code@4.5.6/files/fira-code-latin-500-normal.woff2'
)

foreach ($url in $urls) {
    $filename = Split-Path -Leaf $url
    Write-Host "Загружаем $filename..."
    try {
        Invoke-WebRequest -Uri $url -OutFile "fonts/$filename" -ErrorAction Stop
        Write-Host "✓ $filename загруженъ"
    } catch {
        Write-Host "✗ Ошибка при загрузке $filename : $_"
    }
}

Write-Host "`nШрифты загружены в папку fonts/"
