#!/usr/bin/env node

/**
 * find_unused_styles.mjs
 * 
 * Утилита для поиска и безопасной очистки неиспользуемых (legacy/orphan) CSS файлов.
 * 
 * Использование:
 *   node scripts/find_unused_styles.mjs [path_to_styles_dir] [--delete]
 * 
 * Пример:
 *   node scripts/find_unused_styles.mjs packages/resources/src/styles/features/timeline
 *   node scripts/find_unused_styles.mjs packages/resources/src/styles/features/timeline --delete
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Аргументы командной строки
const args = process.argv.slice(2);
const shouldDelete = args.includes('--delete');
const targetArg = args.find(a => !a.startsWith('--')) || 'packages/resources/src/styles/features/timeline';
const TARGET_DIR = path.resolve(ROOT_DIR, targetArg);

if (!fs.existsSync(TARGET_DIR)) {
  console.error(`❌ Целевая директория не найдена: ${TARGET_DIR}`);
  process.exit(1);
}

// Директории для сканирования использования
const SCAN_ROOTS = [
  path.join(ROOT_DIR, 'apps'),
  path.join(ROOT_DIR, 'packages'),
  path.join(ROOT_DIR, 'src-tauri'),
  path.join(ROOT_DIR, 'crates')
];

// Игнорируемые пути
const IGNORE_PATTERNS = [
  /[/\\]node_modules[/\\]/,
  /[/\\]dist[/\\]/,
  /[/\\]target[/\\]/,
  /[/\\]\.git[/\\]/,
  /[/\\]dist-check[/\\]/,
  /cerberus-baseline.*\.json$/,
  /find_unused_styles\.mjs$/
];

/**
 * Рекурсивно собирает все файлы из директорий
 */
function collectFiles(dir, extensions = null) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (IGNORE_PATTERNS.some(p => p.test(fullPath))) {
      continue;
    }

    if (entry.isDirectory()) {
      results = results.concat(collectFiles(fullPath, extensions));
    } else if (entry.isFile()) {
      if (!extensions || extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// 1. Собираем целевые CSS-файлы
const targetCssFiles = fs.readdirSync(TARGET_DIR)
  .filter(file => file.endsWith('.css'))
  .map(file => ({
    name: file,
    fullPath: path.join(TARGET_DIR, file),
    size: fs.statSync(path.join(TARGET_DIR, file)).size
  }));

console.log(`\n🔍 Сканирование CSS файлов в: ${path.relative(ROOT_DIR, TARGET_DIR)}`);
console.log(`📦 Найдено CSS файлов для аудита: ${targetCssFiles.length}\n`);

// 2. Собираем файлы кодовой базы для поиска импортов
const codebaseFiles = [];
for (const scanDir of SCAN_ROOTS) {
  codebaseFiles.push(...collectFiles(scanDir, ['.vue', '.ts', '.js', '.tsx', '.jsx', '.css', '.html']));
}

// 3. Анализируем использование каждого CSS файла
const usageMap = new Map();

for (const target of targetCssFiles) {
  usageMap.set(target.name, {
    ...target,
    directImports: [],
    crossCssImports: [],
    textReferences: []
  });
}

// Читаем все файлы и ищем упоминания
for (const filePath of codebaseFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');

  for (const [cssName, usage] of usageMap.entries()) {
    // Не учитываем совпадения самого файла с самим собой
    if (path.resolve(filePath) === path.resolve(usage.fullPath)) {
      continue;
    }

    const isDirectImport = 
      content.includes(`src="${cssName}"`) ||
      content.includes(`src='${cssName}'`) ||
      content.includes(`/${cssName}"`) ||
      content.includes(`/${cssName}'`);

    const isCssImport = 
      content.includes(`@import "./${cssName}"`) ||
      content.includes(`@import '../${cssName}'`) ||
      content.includes(`@import "${cssName}"`) ||
      content.includes(`@import './${cssName}'`) ||
      (filePath.endsWith('.css') && content.includes(cssName));

    const isMentioned = content.includes(cssName);

    if (isDirectImport) {
      usage.directImports.push(relPath);
    } else if (isCssImport) {
      usage.crossCssImports.push(relPath);
    } else if (isMentioned) {
      usage.textReferences.push(relPath);
    }
  }
}

// Разрешаем транзитивные зависимости (если файл импортируется только другим css-файлом, проверяем, активен ли тот)
const activeFiles = [];
const orphanFiles = [];

for (const [cssName, usage] of usageMap.entries()) {
  const hasDirectUse = usage.directImports.length > 0;
  
  // Проверяем кросс-импорты из CSS, которые не лежат в той же целевой папке
  const externalCssImports = usage.crossCssImports.filter(impPath => {
    const full = path.resolve(ROOT_DIR, impPath);
    return path.dirname(full) !== path.resolve(TARGET_DIR);
  });

  // Кросс-импорты внутри той же папки
  const internalCssImports = usage.crossCssImports.filter(impPath => {
    const full = path.resolve(ROOT_DIR, impPath);
    return path.dirname(full) === path.resolve(TARGET_DIR);
  });

  const isUsedExternally = hasDirectUse || externalCssImports.length > 0;

  if (isUsedExternally) {
    activeFiles.push({ ...usage, reason: 'Used in component or external CSS' });
  } else if (internalCssImports.length > 0) {
    // Импортируется только соседом по папке
    usage.internalOnly = internalCssImports;
    orphanFiles.push(usage);
  } else {
    orphanFiles.push(usage);
  }
}

// Вторая итерация: если orphan импортируется файлом, который сам активен (например, CalendarCommon.css используется в TimelinePanel.css)
for (let i = orphanFiles.length - 1; i >= 0; i--) {
  const orphan = orphanFiles[i];
  if (orphan.internalOnly) {
    const usedByActive = orphan.internalOnly.some(parentRel => {
      const parentName = path.basename(parentRel);
      return activeFiles.some(a => a.name === parentName);
    });
    if (usedByActive) {
      activeFiles.push(orphan);
      orphanFiles.splice(i, 1);
    }
  }
}

// 4. Вывод отчета
console.log('='.repeat(70));
console.log(`✅ АКТИВНЫЕ ФАЙЛЫ (${activeFiles.length}):`);
console.log('='.repeat(70));
for (const file of activeFiles) {
  const callers = [...file.directImports, ...file.crossCssImports].slice(0, 3).join(', ');
  console.log(`  🟢 ${file.name.padEnd(28)} -> ${callers || 'Referenced in active style'}`);
}

console.log('\n' + '='.repeat(70));
console.log(`🗑️  ЛЕГАСИ / НЕИСПОЛЬЗУЕМЫЕ ФАЙЛЫ (ORPHANED: ${orphanFiles.length}):`);
console.log('='.repeat(70));
let totalWastedBytes = 0;
for (const file of orphanFiles) {
  totalWastedBytes += file.size;
  const note = file.internalOnly ? `(импортировался только другими orphan-файлами: ${file.internalOnly.map(p => path.basename(p)).join(', ')})` : '';
  console.log(`  🔴 ${file.name.padEnd(28)} (${(file.size / 1024).toFixed(1)} KB) ${note}`);
}

console.log(`\nОбщий размер неиспользуемых стилей: ${(totalWastedBytes / 1024).toFixed(2)} KB`);

// 5. Удаление (если передан флаг --delete)
if (shouldDelete) {
  console.log('\n⚠️  УДАЛЕНИЕ ФАЙЛОВ...');
  let deletedCount = 0;
  for (const file of orphanFiles) {
    try {
      fs.unlinkSync(file.fullPath);
      console.log(`  ❌ Удален: ${file.name}`);
      deletedCount++;
    } catch (err) {
      console.error(`  ⚠️ Ошибка удаления ${file.name}:`, err.message);
    }
  }
  console.log(`\n✨ Успешно удалено файлов: ${deletedCount}`);
} else {
  console.log('\n💡 Чтобы удалить эти файлы, запустите:');
  console.log(`   node scripts/find_unused_styles.mjs ${path.relative(ROOT_DIR, TARGET_DIR)} --delete\n`);
}
