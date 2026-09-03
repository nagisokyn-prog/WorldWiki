import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const BARREL_FILES = [
  'apps/spa/src/ts/services/api.service.ts',
  'apps/spa/src/ts/services/document/index.ts',
  'apps/spa/src/ts/stores/index.ts',
  'apps/spa/src/ts/types/index.ts',
  'apps/spa/src/ts/composables/queries/index.ts',
  'packages/components/src/css.ts',
];

const COMPANION_FILES = [
  'apps/spa/src/ts/features/shell/EditorView.vue.ts',
  'apps/spa/src/ts/features/shell/Splash.vue.ts',
];

const SUSPICIOUS_COMPONENTS = [
  'apps/spa/src/ts/features/ai/components/AiActionButtons.vue',
  'apps/spa/src/ts/features/ai/components/AiChatHistory.vue',
  'apps/spa/src/ts/features/ai/components/AiMessageList.vue',
  'apps/spa/src/ts/features/ai/WowilonPanel.vue',
  'apps/spa/src/ts/features/chapters/Semantic/SemanticParagraph.vue',
  'apps/spa/src/ts/features/timeline/Calendars/CalendarOrigin/CalendarOrigin.vue',
  'apps/spa/src/ts/features/timeline/CalendarsPanel/DateWheels.vue',
];

function getAllSourceFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'vendor', '.turbo'].includes(entry.name)) continue;
      getAllSourceFiles(fullPath, fileList);
    } else if (/\.(ts|vue|js)$/.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function checkUsages(targetRelPath, allFiles) {
  const baseNameNoExt = path.basename(targetRelPath, path.extname(targetRelPath));
  const dirName = path.dirname(targetRelPath);
  const normalizedTarget = targetRelPath.replace(/\\/g, '/');

  const matches = [];

  for (const file of allFiles) {
    const normFile = file.replace(/\\/g, '/');
    if (normFile.endsWith(normalizedTarget)) continue; // Don't check the file against itself

    const content = fs.readFileSync(file, 'utf-8');

    // Check various import styles
    const importRegexes = [
      new RegExp(`['"\`][^'"\`]*${baseNameNoExt}(\\.[a-z]+)?['"\`]`, 'g'),
      new RegExp(`['"\`][^'"\`]*${dirName}['"\`]`, 'g'),
    ];

    let found = false;
    for (const rx of importRegexes) {
      if (rx.test(content)) {
        found = true;
        break;
      }
    }

    if (found) {
      matches.push(path.relative(ROOT_DIR, file));
    }
  }

  return matches;
}

console.log('='.repeat(70));
console.log('🔍 WorldWiki Codebase Integrity & Barrel/Orphan Audit');
console.log('='.repeat(70));

const allFiles = getAllSourceFiles(path.join(ROOT_DIR, 'apps/spa/src'))
  .concat(getAllSourceFiles(path.join(ROOT_DIR, 'packages')));

console.log(`\n📦 Total Source Files Scanned: ${allFiles.length}`);

console.log('\n--- 1. Barrel Files Audit (Реэкспорты) ---');
for (const relPath of BARREL_FILES) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ Missing: ${relPath}`);
    continue;
  }
  const usages = checkUsages(relPath, allFiles);
  if (usages.length === 0) {
    console.log(`⚠️  UNUSED BARREL: ${relPath} (Ни один файл не импортирует через этот фасад — используются прямые пути)`);
  } else {
    console.log(`✅ USED BARREL:   ${relPath} (Импортируется в ${usages.length} файлах)`);
  }
}

console.log('\n--- 2. Companion Files Audit (.vue.ts файлы-компаньоны) ---');
for (const relPath of COMPANION_FILES) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ Missing: ${relPath}`);
    continue;
  }
  const usages = checkUsages(relPath, allFiles);
  if (usages.length === 0) {
    console.log(`⚠️  ORPHAN COMPANION: ${relPath} (Не импортируется своим Vue-компонентом)`);
  } else {
    console.log(`✅ LINKED COMPANION: ${relPath} (Импортируется в: ${usages.join(', ')})`);
  }
}

console.log('\n--- 3. Suspicious / Standalone Components Audit ---');
for (const relPath of SUSPICIOUS_COMPONENTS) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ Missing: ${relPath}`);
    continue;
  }
  const usages = checkUsages(relPath, allFiles);
  if (usages.length === 0) {
    console.log(`⚠️  DORMANT COMPONENT: ${relPath} (Не найден в шаблонах и импортах)`);
  } else {
    console.log(`✅ ACTIVE COMPONENT:  ${relPath} (Используется в: ${usages.length} местах)`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('💡 Рекомендация по Barrel-файлам:');
console.log('   Если barrel-файл не используется, архитектурно чище либо:');
console.log('   а) Перевести импорты фич на фасад (например, import { useChapterStore } from "@/stores")');
console.log('   б) Либо удалить пустые barrel-файлы, зафиксировав прямые пути импорта как стандарт.');
console.log('='.repeat(70));
