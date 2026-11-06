#!/usr/bin/env node
/**
 * @file scripts/audit_components_structure.mjs
 * @description Скрипт комплексного аудита архитектуры и чистоты папок `components/`
 * во фронтенде WorldWiki (Vue 3 / FSD).
 *
 * Проверяет:
 * 1. Соблюдение канонической 4-компонентной структуры (Component.vue, useComponent.ts, Component.model.ts, spec.ts).
 * 2. SLOC компонентов (лимит 165 строк).
 * 3. Наличие "каши" (плоских папок с кучей разнородных .vue без поддиректорий).
 * 4. Мертвые/сиротские компоненты (не импортируемые нигде в apps/spa).
 * 5. Отдельный фокус на подсистемах Timeline / Calendars.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SPA_ROOT = path.join(ROOT, 'apps', 'spa', 'src', 'ts');
const FEATURES_ROOT = path.join(SPA_ROOT, 'features');

// Рекурсивный поиск всех файлов
function getFilesRecursively(dir, predicate = () => true) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      results.push(...getFilesRecursively(fullPath, predicate));
    } else if (predicate(fullPath, entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

// Подсчет непустых некомментированных строк (SLOC)
function countSloc(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let sloc = 0;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
      sloc++;
    }
    return sloc;
  } catch {
    return 0;
  }
}

// Поиск всех импортов во всем проекте SPA для детекта мертвых компонентов
function buildProjectImportIndex() {
  const allSourceFiles = getFilesRecursively(SPA_ROOT, (p) => /\.(ts|vue|js)$/.test(p));
  const combinedContent = allSourceFiles
    .map((p) => {
      try {
        return fs.readFileSync(p, 'utf-8');
      } catch {
        return '';
      }
    })
    .join('\n');
  return combinedContent;
}

// Анализ структуры компонентов фичи
function auditFeatureComponents(featureDir, allImportsBlob) {
  const featureName = path.basename(featureDir);
  const issues = [];
  const componentReports = [];

  // Находим все папки `components` внутри этой фичи
  const allDirs = [];
  function collectDirs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const full = path.join(dir, entry.name);
        if (entry.name === 'components') {
          allDirs.push(full);
        }
        collectDirs(full);
      }
    }
  }
  collectDirs(featureDir);

  for (const compDir of allDirs) {
    const relCompDir = path.relative(SPA_ROOT, compDir).replace(/\\/g, '/');
    const entries = fs.readdirSync(compDir, { withFileTypes: true });
    const directFiles = entries.filter((e) => !e.isDirectory()).map((e) => e.name);
    const directDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    const vueFiles = directFiles.filter((f) => f.endsWith('.vue'));

    // Антипаттерн "Плоская каша" (Flat Soup): более 2 .vue файлов прямо в корне `components/`
    if (vueFiles.length > 2) {
      issues.push({
        type: 'FLAT_SOUP',
        path: relCompDir,
        message: `В папке '${relCompDir}' найдено ${vueFiles.length} плоских .vue файлов (${vueFiles.join(', ')}). Каждый компонент обязан жить в собственной подпапке по 4-компонентной схеме!`,
      });
    }

    // Проверяем компоненты, лежащие в подпапках
    for (const subDir of directDirs) {
      if (subDir.startsWith('__tests__') || subDir === 'stubs' || subDir === 'tabs') continue;
      const subDirPath = path.join(compDir, subDir);
      const subEntries = fs.readdirSync(subDirPath, { withFileTypes: true });
      const subFiles = subEntries.filter((e) => !e.isDirectory()).map((e) => e.name);
      const subVue = subFiles.filter((f) => f.endsWith('.vue'));

      for (const vueName of subVue) {
        const baseName = vueName.replace(/\.vue$/, '');
        const vueFullPath = path.join(subDirPath, vueName);
        const sloc = countSloc(vueFullPath);
        const hasHook = subFiles.some((f) => f === `use${baseName}.ts` || f === `use${baseName}.js`);
        const hasModel = subFiles.some((f) => f === `${baseName}.model.ts` || f === `${baseName}.types.ts`);
        const hasSpec =
          subFiles.some((f) => f.includes(`${baseName}.spec.ts`) || f.includes(`use${baseName}.spec.ts`)) ||
          fs.existsSync(path.join(subDirPath, '__tests__'));

        // Проверяем, используется ли компонент
        const isImported =
          allImportsBlob.includes(vueName) ||
          allImportsBlob.includes(baseName) ||
          allImportsBlob.includes(`'${baseName}'`) ||
          allImportsBlob.includes(`"${baseName}"`);

        const compRelPath = path.relative(SPA_ROOT, vueFullPath).replace(/\\/g, '/');

        componentReports.push({
          name: baseName,
          path: compRelPath,
          sloc,
          hasHook,
          hasModel,
          hasSpec,
          isImported,
        });

        if (sloc > 165) {
          issues.push({
            type: 'SLOC_LIMIT',
            path: compRelPath,
            message: `Компонент '${baseName}.vue' имеет ${sloc} SLOC (> 165 рекомендуемых строк). Необходима дальнейшая декомпозиция.`,
          });
        }

        if (!hasModel) {
          issues.push({
            type: 'MISSING_MODEL',
            path: compRelPath,
            message: `Отсутствует '${baseName}.model.ts' для типизации Props/Emits.`,
          });
        }

        if (!hasSpec) {
          issues.push({
            type: 'MISSING_SPEC',
            path: compRelPath,
            message: `Отсутствуют unit-тесты (нет '${baseName}.spec.ts' или '__tests__/').`,
          });
        }

        if (!isImported) {
          issues.push({
            type: 'ORPHAN_COMPONENT',
            path: compRelPath,
            message: `Компонент '${baseName}.vue' нигде не импортируется (мертвый код или кандидат на удаление).`,
          });
        }
      }
    }

    // Проверяем плоские .vue файлы в текущей папке components
    for (const vueName of vueFiles) {
      const baseName = vueName.replace(/\.vue$/, '');
      const vueFullPath = path.join(compDir, vueName);
      const sloc = countSloc(vueFullPath);
      const isImported =
        allImportsBlob.includes(vueName) ||
        allImportsBlob.includes(baseName) ||
        allImportsBlob.includes(`'${baseName}'`) ||
        allImportsBlob.includes(`"${baseName}"`);

      const compRelPath = path.relative(SPA_ROOT, vueFullPath).replace(/\\/g, '/');

      componentReports.push({
        name: baseName,
        path: compRelPath,
        sloc,
        hasHook: false,
        hasModel: false,
        hasSpec: false,
        isImported,
      });

      issues.push({
        type: 'UNPACKED_COMPONENT',
        path: compRelPath,
        message: `Компонент лежит неизолированно в общей папке '${relCompDir}'. Создайте подпапку '${baseName}/' со схемой: ${baseName}.vue, use${baseName}.ts, ${baseName}.model.ts, ${baseName}.spec.ts.`,
      });
    }
  }

  return {
    featureName,
    issues,
    components: componentReports,
  };
}

function run() {
  console.log('\n================================================================');
  console.log('🔍 WORLDWIKI: АУДИТ ЧИСТОТЫ ПАПОК COMPONENTS (АРХИТЕКТУРНЫЙ АНАЛИЗ)');
  console.log('================================================================\n');

  console.log('⏳ Индексирую импорты проекта...');
  const allImportsBlob = buildProjectImportIndex();
  console.log('✅ Индекс построен. Анализирую фичи...\n');

  const featureDirs = fs
    .readdirSync(FEATURES_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'ai') // Исключаем ai-слой по требованию
    .map((e) => path.join(FEATURES_ROOT, e.name));

  const allReports = [];
  for (const fDir of featureDirs) {
    allReports.push(auditFeatureComponents(fDir, allImportsBlob));
  }

  // 1. Приоритетный вывод: ТАЙМЛАЙН И КАЛЕНДАРИ
  console.log('📅 1. ПОДСИСТЕМА ТАЙМЛАЙНА И КАЛЕНДАРЕЙ (TIMELINE / CALENDARS):');
  console.log('----------------------------------------------------------------');
  const calendarReports = allReports.filter((r) => r.featureName === 'timeline' || r.featureName === 'calendars');
  let calIssueCount = 0;
  for (const rep of calendarReports) {
    console.log(`\n📁 Фича: [${rep.featureName.toUpperCase()}] (${rep.components.length} компонентов)`);
    if (rep.issues.length === 0) {
      console.log('   🎉 Все папки компонентов в идеальном порядке!');
    } else {
      for (const iss of rep.issues) {
        calIssueCount++;
        const icon =
          iss.type === 'FLAT_SOUP' ? '🥣 [FLAT_SOUP]' :
          iss.type === 'SLOC_LIMIT' ? '📏 [SLOC_LIMIT]' :
          iss.type === 'ORPHAN_COMPONENT' ? '👻 [DEAD_ORPHAN]' :
          iss.type === 'MISSING_MODEL' ? '🏷️ [MISSING_MODEL]' :
          iss.type === 'MISSING_SPEC' ? '🧪 [MISSING_SPEC]' : '📦 [UNPACKED]';
        console.log(`   ${icon} ${iss.path}`);
        console.log(`      └─ ${iss.message}`);
      }
    }
  }

  // 2. Вывод остальных фич
  console.log('\n\n🧱 2. ДРУГИЕ ФИЧИ (CHAPTERS, ENTITIES, SCHEMAS, SHELL, SYNC):');
  console.log('----------------------------------------------------------------');
  const otherReports = allReports.filter((r) => r.featureName !== 'timeline' && r.featureName !== 'calendars');
  let otherIssueCount = 0;
  for (const rep of otherReports) {
    if (rep.issues.length === 0) continue;
    console.log(`\n📁 Фича: [${rep.featureName.toUpperCase()}] (${rep.components.length} компонентов)`);
    for (const iss of rep.issues) {
      otherIssueCount++;
      const icon =
        iss.type === 'FLAT_SOUP' ? '🥣 [FLAT_SOUP]' :
        iss.type === 'SLOC_LIMIT' ? '📏 [SLOC_LIMIT]' :
        iss.type === 'ORPHAN_COMPONENT' ? '👻 [DEAD_ORPHAN]' :
        iss.type === 'MISSING_MODEL' ? '🏷️ [MISSING_MODEL]' :
        iss.type === 'MISSING_SPEC' ? '🧪 [MISSING_SPEC]' : '📦 [UNPACKED]';
      console.log(`   ${icon} ${iss.path}`);
      console.log(`      └─ ${iss.message}`);
    }
  }

  // 3. Сводка
  console.log('\n================================================================');
  console.log('📊 ИТОГОВАЯ СВОДКА АУДИТА:');
  console.log(`- Проверено фич: ${featureDirs.length} (без AI-слоя)`);
  console.log(`- Всего обнаружено компонентов: ${allReports.reduce((acc, r) => acc + r.components.length, 0)}`);
  console.log(`- Нарушений в Timeline/Calendars: ${calIssueCount}`);
  console.log(`- Нарушений в других фичах: ${otherIssueCount}`);
  console.log(`- Всего архитектурных замечаний: ${calIssueCount + otherIssueCount}`);
  console.log('================================================================\n');

  // Сохраняем детальный JSON-отчет в .system_generated
  const jsonReportPath = path.join(ROOT, 'components-audit-report.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(allReports, null, 2), 'utf-8');
  console.log(`💾 Полный структурированный JSON сохранен в: ${jsonReportPath}\n`);
}

run();

