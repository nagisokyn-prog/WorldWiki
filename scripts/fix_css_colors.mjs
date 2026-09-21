import fs from 'node:fs';
import path from 'node:path';

function loadIgnorePatterns() {
  const configPath = path.resolve('cerberus.json');
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return cfg.ignore || [];
    } catch (e) {
      console.warn('⚠️ Ошибка чтения cerberus.json:', e.message);
    }
  }
  return [];
}

function globToRegex(glob) {
  let normalized = glob.replace(/\\/g, '/');
  let regexStr = normalized
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`(^|/)${regexStr}($|/)`);
}

function createIgnoreMatcher(patterns) {
  const regexes = patterns.map(globToRegex);
  return function isIgnored(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    return regexes.some((re) => re.test(normalized));
  };
}

function collectFiles(rootDir, extensions, isIgnored, fileList = []) {
  if (!fs.existsSync(rootDir)) return fileList;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

    if (isIgnored(relPath)) continue;

    if (entry.isDirectory()) {
      collectFiles(fullPath, extensions, isIgnored, fileList);
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const COLOR_MAP = [
  // Статусные цвета
  { pattern: /rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*(?:0\.15|0\.2|0\.1)\s*\)/g, token: 'var(--error-bg)' },
  { pattern: /rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*0\.3\s*\)/g, token: 'var(--error-border)' },
  { pattern: /rgba\(\s*250\s*,\s*82\s*,\s*82\s*,\s*0\.1\s*\)/g, token: 'var(--error-bg)' },

  { pattern: /rgba\(\s*16\s*,\s*185\s*,\s*129\s*,\s*(?:0\.15|0\.2|0\.1)\s*\)/g, token: 'var(--success-bg)' },
  { pattern: /rgba\(\s*16\s*,\s*185\s*,\s*129\s*,\s*0\.3\s*\)/g, token: 'var(--success-border)' },

  { pattern: /rgba\(\s*245\s*,\s*158\s*,\s*11\s*,\s*(?:0\.15|0\.2|0\.1)\s*\)/g, token: 'var(--warning-bg)' },
  { pattern: /rgba\(\s*245\s*,\s*158\s*,\s*11\s*,\s*0\.3\s*\)/g, token: 'var(--warning-border)' },

  { pattern: /rgba\(\s*59\s*,\s*130\s*,\s*246\s*,\s*(?:0\.15|0\.2|0\.1)\s*\)/g, token: 'var(--info-bg)' },
  { pattern: /rgba\(\s*59\s*,\s*130\s*,\s*246\s*,\s*0\.3\s*\)/g, token: 'var(--info-border)' },

  // Акценты
  { pattern: /rgba\(\s*139\s*,\s*92\s*,\s*246\s*,\s*0\.15\s*\)/g, token: 'var(--bg-selected)' },
  { pattern: /rgba\(\s*139\s*,\s*92\s*,\s*246\s*,\s*0\.1\s*\)/g, token: 'var(--bg-selected)' },
  { pattern: /rgba\(\s*139\s*,\s*92\s*,\s*246\s*,\s*(?:0\.2|0\.3)\s*\)/g, token: 'var(--accent-glow)' },
  { pattern: /rgba\(\s*139\s*,\s*92\s*,\s*246\s*,\s*0\.5\s*\)/g, token: 'var(--border-active)' },
  { pattern: /rgba\(\s*196\s*,\s*181\s*,\s*253\s*,\s*0\.15\s*\)/g, token: 'var(--bg-selected)' },

  // Базовые фоны и границы
  { pattern: /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.05\s*\)/g, token: 'var(--bg-hover)' },
  { pattern: /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.1\s*\)/g, token: 'var(--border-color)' },
  { pattern: /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.2\s*\)/g, token: 'var(--border-hover)' },
  { pattern: /rgba\(\s*22\s*,\s*22\s*,\s*26\s*,\s*0\.6\s*\)/g, token: 'var(--bg-card)' },
  { pattern: /rgba\(\s*15\s*,\s*15\s*,\s*18\s*,\s*0\.7\s*\)/g, token: 'var(--bg-panel)' },
  { pattern: /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.25\s*\)/g, token: 'var(--bg-sunken)' },
  { pattern: /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.5\s*\)/g, token: 'var(--shadow-color)' },
  { pattern: /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.65\s*\)/g, token: 'var(--modal-backdrop)' },
];

export function runFixColors() {
  console.log('🚀 Запуск автоматической миграции hardcoded цветов/rgba на токены...\n');
  const ignorePatterns = loadIgnorePatterns();
  const isIgnored = createIgnoreMatcher(ignorePatterns);

  const searchDirs = [
    path.resolve('packages/resources/src/styles'),
    path.resolve('packages/components/src'),
    path.resolve('apps/spa/src'),
  ];

  const files = [];
  for (const dir of searchDirs) {
    collectFiles(dir, ['.css', '.vue'], isIgnored, files);
  }

  let totalFixedFiles = 0;
  let totalReplacements = 0;

  for (const filePath of files) {
    const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    if (relPath.includes('styles/tokens/')) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    let newContent = content;
    let fileReplacements = 0;

    for (const rule of COLOR_MAP) {
      newContent = newContent.replace(rule.pattern, () => {
        fileReplacements++;
        totalReplacements++;
        return rule.token;
      });
    }

    if (fileReplacements > 0) {
      fs.writeFileSync(filePath, newContent, 'utf-8');
      totalFixedFiles++;
      console.log(`  ✨ [${fileReplacements} замен] ${relPath}`);
    }
  }

  console.log('\n=============================================');
  console.log(`🎯 Исправлено файлов с цветами: ${totalFixedFiles}`);
  console.log(`🪄 Всего заменено цветов на токены: ${totalReplacements}`);
  console.log('=============================================\n');
}

if (process.argv[1] && process.argv[1].endsWith('fix_css_colors.mjs')) {
  runFixColors();
}
