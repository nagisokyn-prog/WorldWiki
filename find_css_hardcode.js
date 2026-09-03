import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASELINE_FILE = path.join(__dirname, 'css_audit_baseline.json');
const REPORT_TXT = path.join(__dirname, 'css_hardcode_report.txt');
const REPORT_JSON = path.join(__dirname, 'css_hardcode_report.json');

const TARGET_DIRS = [
  'packages/resources/src/styles',
  'apps/spa/src',
  'packages/components/src',
  'packages/word-vibe/src'
];

const IGNORE_PATHS = [
  'node_modules',
  'dist',
  'target',
  '.git',
  'font-awesome',
  'fonts',
  'tokens/theme-dark.css',
  'tokens/theme-glass.css',
  'tokens/typography.css'
];

// Паттерны поиска
const REGEX_PATTERNS = {
  blackColor: /(rgba?\(\s*0\s*,\s*0\s*,\s*0(?:\s*,\s*[\d.]+\s*)?\)|#000000\b|#000\b|(?<![-\w])black(?![-\w]))/gi,
  whiteColor: /(rgba?\(\s*255\s*,\s*255\s*,\s*255(?:\s*,\s*[\d.]+\s*)?\)|#ffffff\b|#fff\b|(?<![-\w])white(?![-\w]))/gi,
  hexColor: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
  namedColors: /:\s*(red|blue|green|yellow|orange|purple|gray|grey)\s*[;!]/gi,
  hardcodedRadius: /border-radius:\s*(\d+px)/gi
};

const currentAudit = {
  timestamp: new Date().toISOString(),
  totalDebt: 0,
  categories: {
    blackColors: 0,
    whiteColors: 0,
    hexColors: 0,
    namedColors: 0,
    radii: 0,
    inlineStyles: 0
  },
  semanticRoles: {
    modalBackdrops: 0,   // затемнение модалок / оверлеев
    sunkenBackgrounds: 0,// утопленные секции/плашки
    borders: 0,          // границы
    text: 0              // цвет текста
  },
  violationsMap: new Map(), // key: "file:line:match"
  fileDebts: new Map()
};

function shouldIgnore(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return IGNORE_PATHS.some(ignore => normalized.includes(ignore));
}

function detectSemanticRole(prop, val, line) {
  const str = (prop + ' ' + val + ' ' + line).toLowerCase();
  if (str.includes('overlay') || str.includes('backdrop') || str.includes('modal')) {
    currentAudit.semanticRoles.modalBackdrops++;
  } else if (str.includes('border')) {
    currentAudit.semanticRoles.borders++;
  } else if (str.includes('color') && !str.includes('background')) {
    currentAudit.semanticRoles.text++;
  } else if (str.includes('background') && (val.includes('0, 0, 0') || val.includes('0,0,0') || val.includes('#000'))) {
    currentAudit.semanticRoles.sunkenBackgrounds++;
  }
}

function recordViolation(category, prop, val, line, filePath, lineNum, matchStr) {
  currentAudit.categories[category]++;
  currentAudit.totalDebt++;
  detectSemanticRole(prop, val, line);

  const fileCount = currentAudit.fileDebts.get(filePath) || 0;
  currentAudit.fileDebts.set(filePath, fileCount + 1);

  const key = `${filePath}:${lineNum}:${matchStr}`;
  currentAudit.violationsMap.set(key, {
    file: filePath,
    line: lineNum,
    match: matchStr,
    snippet: line.trim()
  });
}

function analyzeCssProperty(propName, propValue, fullLine, filePath, lineNumber) {
  // 1. Black
  const blackMatches = [...propValue.matchAll(REGEX_PATTERNS.blackColor)];
  blackMatches.forEach(m => recordViolation('blackColors', propName, propValue, fullLine, filePath, lineNumber, m[0]));

  // 2. White
  const whiteMatches = [...propValue.matchAll(REGEX_PATTERNS.whiteColor)];
  whiteMatches.forEach(m => recordViolation('whiteColors', propName, propValue, fullLine, filePath, lineNumber, m[0]));

  // 3. HEX
  const hexMatches = [...propValue.matchAll(REGEX_PATTERNS.hexColor)];
  hexMatches.forEach(m => {
    const hex = m[0].toLowerCase();
    if (!['#fff', '#ffffff', '#000', '#000000'].includes(hex)) {
      recordViolation('hexColors', propName, propValue, fullLine, filePath, lineNumber, m[0]);
    }
  });

  // 4. Named
  const namedMatches = [...propValue.matchAll(REGEX_PATTERNS.namedColors)];
  namedMatches.forEach(m => recordViolation('namedColors', propName, propValue, fullLine, filePath, lineNumber, m[1]));

  // 5. Radius
  if (propName.toLowerCase().includes('border-radius')) {
    const radiusMatches = [...propValue.matchAll(REGEX_PATTERNS.hardcodedRadius)];
    radiusMatches.forEach(m => {
      if (!propValue.includes('var(')) {
        recordViolation('radii', propName, propValue, fullLine, filePath, lineNumber, m[0]);
      }
    });
  }
}

function analyzeCssContent(content, filePath, lineOffset = 0) {
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNumber = lineOffset + idx + 1;
    const trimmed = line.trim();

    if (trimmed.startsWith('/*') || trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (!trimmed.includes(':') || trimmed.startsWith('--')) return;

    const colonIdx = trimmed.indexOf(':');
    const prop = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).replace(';', '').trim();

    analyzeCssProperty(prop, val, trimmed, filePath, lineNumber);
  });
}

function scanFile(filePath) {
  if (shouldIgnore(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(__dirname, filePath).replace(/\\/g, '/');

  if (filePath.endsWith('.css')) {
    analyzeCssContent(content, relPath, 0);
  } else if (filePath.endsWith('.vue')) {
    // Styles
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/g;
    let match;
    while ((match = styleRegex.exec(content)) !== null) {
      const before = content.substring(0, match.index);
      const startLine = before.split('\n').length - 1;
      analyzeCssContent(match[1], relPath, startLine);
    }

    // Inlines
    const inlineRegex = /style="([^"]*)"/g;
    let inlineMatch;
    while ((inlineMatch = inlineRegex.exec(content)) !== null) {
      currentAudit.categories.inlineStyles++;
      currentAudit.totalDebt++;
      const curCount = currentAudit.fileDebts.get(relPath) || 0;
      currentAudit.fileDebts.set(relPath, curCount + 1);

      const before = content.substring(0, inlineMatch.index);
      const lineNum = before.split('\n').length;
      const key = `${relPath}:${lineNum}:inline-style`;
      currentAudit.violationsMap.set(key, {
        file: relPath,
        line: lineNum,
        match: 'inline-style',
        snippet: inlineMatch[0]
      });

      analyzeCssContent(inlineMatch[1], relPath, lineNum - 1);
    }
  }
}

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const ent of entries) {
    const fullPath = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!shouldIgnore(fullPath)) scanDirectory(fullPath);
    } else if (ent.isFile()) {
      if (ent.name.endsWith('.css') || ent.name.endsWith('.vue')) {
        scanFile(fullPath);
      }
    }
  }
}

// 1. Сканируем проект
TARGET_DIRS.forEach(d => scanDirectory(path.join(__dirname, d)));

// 2. Работа с Baseline
let baseline = null;
let isFirstRun = false;

if (fs.existsSync(BASELINE_FILE)) {
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  } catch (e) {
    console.warn('⚠️ Ошибка чтения baseline, будет создан заново');
  }
}

if (!baseline) {
  isFirstRun = true;
  baseline = {
    timestamp: currentAudit.timestamp,
    totalDebt: currentAudit.totalDebt,
    categories: currentAudit.categories,
    keys: [...currentAudit.violationsMap.keys()]
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2), 'utf8');
}

// 3. Вычисление дельты (Fixed vs Introduced)
const currentKeys = new Set(currentAudit.violationsMap.keys());
const baselineKeys = new Set(baseline.keys || []);

let fixedCount = 0;
let introducedCount = 0;

for (const key of baselineKeys) {
  if (!currentKeys.has(key)) fixedCount++;
}

for (const key of currentKeys) {
  if (!baselineKeys.has(key)) introducedCount++;
}

const baselineDebt = baseline.totalDebt;
const currentDebt = currentAudit.totalDebt;
const debtDiff = currentDebt - baselineDebt;
const trendSign = debtDiff <= 0 ? '↓' : '↑';
const trendPercent = baselineDebt > 0 ? ((Math.abs(debtDiff) / baselineDebt) * 100).toFixed(1) : '0.0';

// Сортировка файлов (только CSS файлы)
const topCssFiles = [...currentAudit.fileDebts.entries()]
  .map(([file, count]) => ({ file, count }))
  .filter(f => f.count > 0 && f.file.endsWith('.css'))
  .sort((a, b) => b.count - a.count);

const allTopFiles = [...currentAudit.fileDebts.entries()]
  .map(([file, count]) => ({ file, count }))
  .filter(f => f.count > 0)
  .sort((a, b) => b.count - a.count);

// Формируем отчет
let out = '';
out += '╔══════════════════════════════════════════════════════════════════════╗\n';
out += '║               WORLDWIKI DESIGN SYSTEM HEALTH SCORE                  ║\n';
out += '╚══════════════════════════════════════════════════════════════════════╝\n\n';

out += `  📈 BASELINE & TREND TRACKING:\n`;
out += `  • Baseline Debt:    ${baselineDebt} мест\n`;
out += `  • Current Debt:     ${currentDebt} мест\n`;
out += `  • Fixed (Устранено): -${fixedCount} мест 🎉\n`;
out += `  • New (Введено):    +${introducedCount} мест\n`;
out += `  • Net Trend:        ${trendSign} ${Math.abs(debtDiff)} (${trendPercent}% ${debtDiff <= 0 ? 'улучшение' : 'ухудшение'})\n\n`;

out += '────────────────────────────────────────────────────────────────────────\n';
out += '  1. СЕМАНТИЧЕСКИЕ РОЛИ ДОЛГА (ЗНАЧЕНИЕ → СМЫСЛ → ТОКЕН)\n';
out += '────────────────────────────────────────────────────────────────────────\n';
out += `  • [Оверлеи / Затемнения]   --modal-backdrop : ${currentAudit.semanticRoles.modalBackdrops} мест\n`;
out += `  • [Утопленные подложки]    --bg-sunken      : ${currentAudit.semanticRoles.sunkenBackgrounds} мест\n`;
out += `  • [Системные рамки]        --border-color   : ${currentAudit.semanticRoles.borders} мест\n`;
out += `  • [Цвета текста]           --text-main/muted: ${currentAudit.semanticRoles.text} мест\n\n`;

out += '────────────────────────────────────────────────────────────────────────\n';
out += '  2. РАЗБИВКА ПО ТИПАМ НАРУШЕНИЙ\n';
out += '────────────────────────────────────────────────────────────────────────\n';
out += `  • Hardcoded Black Colors  (rgba(0,0,0,...), #000):   ${String(currentAudit.categories.blackColors).padStart(4)} [Критично для Light Theme]\n`;
out += `  • Hardcoded White Colors  (rgba(255,255,...), #fff):  ${String(currentAudit.categories.whiteColors).padStart(4)} [Критично для Light Theme]\n`;
out += `  • Arbitrary HEX Colors    (#aabbcc):                ${String(currentAudit.categories.hexColors).padStart(4)}\n`;
out += `  • Inline Styles           (style="..."):            ${String(currentAudit.categories.inlineStyles).padStart(4)}\n`;
out += `  • Hardcoded Radii         (border-radius: Xpx):       ${String(currentAudit.categories.radii).padStart(4)}\n\n`;

out += '────────────────────────────────────────────────────────────────────────\n';
out += '  3. ПРИОРИТЕТНЫЕ CSS ФАЙЛЫ ДЛЯ СЛЕДУЮЩЕГО ШАГА (TOP-15 CSS ONLY)\n';
out += '────────────────────────────────────────────────────────────────────────\n';
if (topCssFiles.length === 0) {
  out += '  🎉 ИДЕАЛЬНО! В CSS файлах 0 нарушений дизайн-системы!\n';
} else {
  topCssFiles.slice(0, 15).forEach((f, i) => {
    out += `  ${String(i + 1).padStart(2)}. [${String(f.count).padStart(3)} мест]  ${f.file}\n`;
  });
}

fs.writeFileSync(REPORT_TXT, out, 'utf8');
fs.writeFileSync(REPORT_JSON, JSON.stringify({
  baselineDebt,
  currentDebt,
  fixedCount,
  introducedCount,
  trendPercent,
  categories: currentAudit.categories,
  semanticRoles: currentAudit.semanticRoles,
  topCssFiles: topCssFiles.slice(0, 15),
  allTopFiles: allTopFiles.slice(0, 15),
  violations: [...currentAudit.violationsMap.values()]
}, null, 2), 'utf8');

console.log(out);
