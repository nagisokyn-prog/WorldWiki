param([string]$File)

$ErrorActionPreference = 'Stop'
$path = (Resolve-Path $File).Path
$dir = Split-Path $path
$name = [IO.Path]::GetFileNameWithoutExtension($path)
$isMod = $name -eq 'mod'
$lines = [System.IO.File]::ReadAllLines($path)

# Найти блоки: #[tauri::command] + предшествующие комментарии до первой '}' на уровне 0
$blocks = @()
$remove = New-Object 'System.Collections.Generic.HashSet[int]'
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -ne '#[tauri::command]') { continue }
    $start = $i
    while ($start -gt 0 -and $lines[$start-1].TrimStart().StartsWith('//')) { $start-- }
    $end = $i
    while ($end -lt $lines.Count -and $lines[$end].Trim() -ne '}') { $end++ }
    if ($end -ge $lines.Count) { throw "No block end for command at line $($i+1)" }
    $blocks += ,@($start, $end)
    for ($j = $start; $j -le $end; $j++) { [void]$remove.Add($j) }
    if ($end+1 -lt $lines.Count -and $lines[$end+1].Trim() -eq '') { [void]$remove.Add($end+1) }
}
if ($blocks.Count -eq 0) { Write-Output 'NO_COMMANDS'; exit 1 }

# commands.rs
$out = New-Object 'System.Collections.Generic.List[string]'
$out.Add('//! IPC layer for module `' + $name + '`: #[tauri::command] wrappers only.')
$out.Add('//! All business logic lives in mod.rs (*_inner).')
$out.Add('')
$out.Add('use super::*;')
$out.Add('')
foreach ($b in $blocks) {
    for ($j = $b[0]; $j -le $b[1]; $j++) { [void]$out.Add($lines[$j]) }
    [void]$out.Add('')
}
$cmdPath = Join-Path $dir ($name + '_commands.rs')
[System.IO.File]::WriteAllLines($cmdPath, $out)

# mod.rs: убрать блоки
$rest = New-Object 'System.Collections.Generic.List[string]'
for ($i = 0; $i -lt $lines.Count; $i++) { if (-not $remove.Contains($i)) { [void]$rest.Add($lines[$i]) } }

# вставить объявление после последнего верхнего use
$lastUse = -1
for ($i = 0; $i -lt $rest.Count; $i++) { if ($rest[$i].StartsWith('use ')) { $lastUse = $i } }
$insert = @('', '// IPC layer extracted (architecture split):', 'mod commands;', 'pub use commands::*;')
$rest.InsertRange($lastUse + 1, [string[]]$insert)

$modPath = if ($isMod) { $path } else { Join-Path $dir ($name + '.rs') }
[System.IO.File]::WriteAllLines($modPath, $rest)
Write-Output ('OK: {0} commands -> {1}' -f $blocks.Count, $cmdPath)
