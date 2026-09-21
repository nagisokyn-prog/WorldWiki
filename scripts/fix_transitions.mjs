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

export function fixTransitionsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  let count = 0;

  // Ищем transition: all <duration> <timing>
  const transitionAllRegex = /transition\s*:\s*all(\s+[^;}\n]+)/gi;

  const newContent = content.replace(transitionAllRegex, (match, timingPart) => {
    // Декомпозируем all на производительные свойства: opacity, transform, background-color, border-color, color
    const cleanTiming = timingPart.trim();
    const decomposed = `transition: opacity ${cleanTiming}, transform ${cleanTiming}, background-color ${cleanTiming}, border-color ${cleanTiming}, color ${cleanTiming}`;
    modified = true;
    count++;
    return decomposed;
  });

  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }

  return { modified, count };
}

export function runTransitionsCodemod() {
  console.log('🚀 Запуск Codemod: Fix transition: all -> explicit properties...\n');
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
    const { modified, count } = fixTransitionsInFile(file);
    if (modified) {
      totalFilesModified++;
      totalReplacements += count;
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      console.log(`✅ [${count} шт] ${rel}`);
    }
  }

  console.log(`\n🎉 Готово! Оптимизировано ${totalReplacements} transition правил в ${totalFilesModified} файлах.`);
}

if (process.argv[1] && process.argv[1].endsWith('fix_transitions.mjs')) {
  runTransitionsCodemod();
}
