import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Зафиксированное базовое состояние (Baseline)
const BASELINE_OCCURRENCES = 336;
const BASELINE_FILES = 67;

const TARGET_DIRS = [
  path.join(rootDir, 'src-tauri'),
  path.join(rootDir, 'apps/spa'),
  path.join(rootDir, 'packages')
];

const EXTENSIONS = new Set(['.rs', '.ts', '.vue', '.surql']);

const IGNORE_DIRS = new Set([
  'node_modules',
  'target',
  'dist',
  '.git',
  'coverage',
  '.agents',
  '.logic_legacy'
]);

const IGNORE_FILES = new Set([
  'backup_latest.surql',
  'backup_full.surql'
]);

function getFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.logic_legacy')) continue;
    if (IGNORE_FILES.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// Regex to find domain arc/arcs references
const ARC_REGEX = /\b(arc|arcs|arc_id|arcId|start_arc|end_arc|currentArc|contains_arc|VolumeContainsArc|ArcContainsChapter)\b/i;

function isFalsePositiveRustArc(line) {
  const trimmed = line.trim();
  // Standard Rust smart pointer usages
  if (trimmed.startsWith('use ') && (trimmed.includes('sync::Arc') || trimmed.includes('std::sync::Arc') || trimmed.includes('{Arc') || trimmed.includes(', Arc'))) return true;
  // If it's a type annotation like `: Arc<...>`, `Option<Arc<...>>`, `Arc<dyn ...>` and doesn't contain arc domain terms
  if (/: \s*(Option<)?(std::sync::)?Arc<|-> \s*(Option<)?(std::sync::)?Arc<|pub \w+:\s*(Option<)?(std::sync::)?Arc<|\bArc<dyn\b|\bArc<std::|\bArc<tokio|\bArc<RwLock|\bArc<Mutex|\bArc<Atomic|\bArc<Surreal/i.test(trimmed)) {
    if (!/arc_id|arcs\b|start_arc|end_arc|contains_arc/i.test(trimmed)) {
      return true;
    }
  }
  if (/\bArc::(new|clone)\(/.test(trimmed) && !/arc_id|arcs\b|start_arc|end_arc/i.test(trimmed)) {
    return true;
  }
  return false;
}

let totalMatches = 0;
let fileCount = 0;
let reportDetails = '';

for (const searchDir of TARGET_DIRS) {
  const files = getFiles(searchDir);
  for (const file of files) {
    const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (e) {
      continue;
    }

    const lines = content.split('\n');
    const matchedLines = [];

    lines.forEach((line, idx) => {
      if (file.endsWith('.rs') && isFalsePositiveRustArc(line)) {
        return;
      }
      if (ARC_REGEX.test(line)) {
        matchedLines.push({ lineNum: idx + 1, text: line.trimEnd() });
      }
    });

    if (matchedLines.length > 0) {
      fileCount++;
      totalMatches += matchedLines.length;
      const fileHeader = `\n### 📄 \`${relPath}\` (${matchedLines.length} совпадений)\n\`\`\`\n`;
      console.log(`\n📄 [${relPath}] (${matchedLines.length} occurrences):`);
      reportDetails += fileHeader;

      matchedLines.forEach(({ lineNum, text }) => {
        const lineStr = `  ${String(lineNum).padStart(4, ' ')} | ${text}`;
        console.log(lineStr);
        reportDetails += `${lineStr}\n`;
      });
      reportDetails += `\`\`\`\n`;
    }
  }
}

const deltaOccurrences = BASELINE_OCCURRENCES - totalMatches;
const deltaFiles = BASELINE_FILES - fileCount;
const occSign = deltaOccurrences >= 0 ? `🔻 -${deltaOccurrences}` : `🔺 +${Math.abs(deltaOccurrences)}`;
const fileSign = deltaFiles >= 0 ? `🔻 -${deltaFiles}` : `🔺 +${Math.abs(deltaFiles)}`;

console.log(`\n========================================`);
console.log(`📊 ДИНАМИКА ОЧИСТКИ ОТ ARC / ARCS:`);
console.log(`Базовое состояние: ${BASELINE_OCCURRENCES} вхождений в ${BASELINE_FILES} файлах`);
console.log(`Текущее состояние: ${totalMatches} вхождений в ${fileCount} файлах`);
console.log(`Прогресс очистки:  ${occSign} вхождений (${deltaOccurrences > 0 ? ((deltaOccurrences/BASELINE_OCCURRENCES)*100).toFixed(1) : 0}% очищено), ${fileSign} файлов`);
console.log(`========================================\n`);

const reportHeader = `# Отчет аудита и прогресса зачистки arc / arcs

| Метрика | Базовое состояние | Текущее состояние | Изменение (Прогресс) |
|---|---|---|---|
| **Всего вхождений (Occurrences)** | \`${BASELINE_OCCURRENCES}\` | \`${totalMatches}\` | **${occSign}** |
| **Файлов с упоминаниями (Files)** | \`${BASELINE_FILES}\` | \`${fileCount}\` | **${fileSign}** |

---
## Детальный список оставшихся файлов и строк:
`;

fs.writeFileSync(path.join(rootDir, 'arc_references_report.md'), reportHeader + reportDetails, 'utf8');
console.log(`✅ Полный отчет с динамикой сохранен в: arc_references_report.md`);
