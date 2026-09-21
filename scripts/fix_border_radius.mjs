import fs from 'node:fs';
import path from 'node:path';

// Загрузка игноров из cerberus.json
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

// Точная карта радиусов
const RADIUS_MAP = {
  '2px': 'var(--radius-xs)',
  '3px': 'var(--radius-xs)',
  '4px': 'var(--radius-xs)',
  '5px': 'var(--radius-xs)',
  '6px': 'var(--radius-xs)',
  '8px': 'var(--radius-sm)',
  '10px': 'var(--radius-md)',
  '12px': 'var(--radius-md)',
  '14px': 'var(--radius-md)',
  '16px': 'var(--radius-lg)',
  '18px': 'var(--radius-lg)',
  '20px': 'var(--radius-card)',
  '24px': 'var(--radius-card)',
  '28px': 'var(--radius-island)',
  '32px': 'var(--radius-island)',
  '9999px': 'var(--radius-round)',
  '50%': 'var(--radius-round)',
};

export function fixBorderRadiusInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  let count = 0;

  // Замена в свойствах border-radius, border-top-left-radius и т.д.
  const radiusRegex = /(border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*)([^;}\n]+)/gi;

  const newContent = content.replace(radiusRegex, (match, prefix, value) => {
    // Если уже используется var(--radius-*), не трогаем
    if (value.includes('var(--radius-')) return match;

    let updatedValue = value;
    for (const [pixel, token] of Object.entries(RADIUS_MAP)) {
      // Ищем точное совпадение значения с границами слова/пробелов
      const exactRegex = new RegExp(`(?<=^|\\s)${pixel}(?=\\s|;|$)`, 'g');
      if (exactRegex.test(updatedValue)) {
        updatedValue = updatedValue.replace(exactRegex, token);
      }
    }

    if (updatedValue !== value) {
      modified = true;
      count++;
      return `${prefix}${updatedValue}`;
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }

  return { modified, count };
}

export function runBorderRadiusCodemod() {
  console.log('🚀 Запуск Codemod: Fix border-radius -> var(--radius-*)...\n');
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

  let totalFilesModified = 0;
  let totalReplacements = 0;

  for (const file of files) {
    const { modified, count } = fixBorderRadiusInFile(file);
    if (modified) {
      totalFilesModified++;
      totalReplacements += count;
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      console.log(`✅ [${count} шт] ${rel}`);
    }
  }

  console.log(`\n🎉 Готово! Изменено ${totalReplacements} значений border-radius в ${totalFilesModified} файлах.`);
}

if (process.argv[1] && process.argv[1].endsWith('fix_border_radius.mjs')) {
  runBorderRadiusCodemod();
}
