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

export function cleanPerfTransitions() {
  console.log('🚀 Запуск оптимизации transition для GPU (удаление box-shadow / layout из transitions)...\n');
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

  let totalReplacements = 0;
  let totalFiles = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    let modified = false;

    // Удаляем box-shadow из списков transition
    const newContent = content.replace(/(transition\s*:\s*)([^;}\n]+)/gi, (match, prefix, value) => {
      if (!value.includes('box-shadow')) return match;

      // Разбиваем по запятым
      const parts = value.split(',').map((p) => p.trim());
      const filtered = parts.filter((p) => !p.startsWith('box-shadow'));

      if (filtered.length === parts.length) return match;

      modified = true;
      totalReplacements++;
      if (filtered.length === 0) {
        return `${prefix}opacity var(--duration-fast, 0.2s), transform var(--duration-fast, 0.2s)`;
      }
      return `${prefix}${filtered.join(', ')}`;
    });

    if (modified) {
      fs.writeFileSync(file, newContent, 'utf-8');
      totalFiles++;
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      console.log(`  ⚡ ${rel}`);
    }
  }

  console.log(`\n🎉 Оптимизировано ${totalReplacements} переходов в ${totalFiles} файлах.`);
}

cleanPerfTransitions();
