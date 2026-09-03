/**
 * analyze_vue_monoliths.js
 * Скрипт аудита чистоты архитектуры Vue-компонентов:
 * Ищет монолитные .vue файлы, где <script setup> содержит бизнес-логику,
 * локальные ref/reactive, функции и сайд-эффекты вместо выноса в use<Component>.ts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIRS = [
  // 'apps/spa/src',
   'packages/components/src',
  //  'packages/word-vibe/src'
];

const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  '.git',
  'dist-tauri',
  'target'
];

const REPORT_TXT = path.join(__dirname, 'vue_monoliths_report.txt');
const REPORT_JSON = path.join(__dirname, 'vue_monoliths_report.json');

// Сбор всех .vue файлов
function getVueFiles(dir) {
  let res = [];
  if (!fs.existsSync(dir)) return res;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (IGNORE_PATTERNS.includes(ent.name)) continue;
      res = res.concat(getVueFiles(full));
    } else if (ent.isFile() && ent.name.endsWith('.vue')) {
      res.push(full);
    }
  }
  return res;
}

// Анализ отдельного Vue файла
function analyzeVueFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const baseName = path.basename(filePath, '.vue');
  const dirName = path.dirname(filePath);

  const scriptSetupMatch = content.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptSetupMatch) {
    return {
      file: path.relative(__dirname, filePath).replace(/\\/g, '/'),
      baseName,
      hasScriptSetup: false,
      logicLinesCount: 0,
      stateDeclarations: 0,
      functionsCount: 0,
      lifecycleHooks: 0,
      storeApiCalls: 0,
      hasCompanionComposable: false,
      companionComposablePath: null,
      score: 0,
      level: 'CLEAN',
      issues: []
    };
  }

  const scriptCode = scriptSetupMatch[1];
  const scriptLines = scriptCode.split('\n');

  // Проверка наличия companion composable (useX.ts)
  const potentialComposableNames = [
    `use${baseName}.ts`,
    `use${baseName}.composable.ts`,
    `use${baseName[0].toLowerCase() + baseName.slice(1)}.ts`
  ];
  
  let hasCompanionComposable = false;
  let companionComposablePath = null;

  for (const compName of potentialComposableNames) {
    const directPath = path.join(dirName, compName);
    const hooksPath = path.join(dirName, 'hooks', compName);
    const composablesPath = path.join(dirName, 'composables', compName);

    if (fs.existsSync(directPath)) {
      hasCompanionComposable = true;
      companionComposablePath = path.relative(__dirname, directPath).replace(/\\/g, '/');
      break;
    } else if (fs.existsSync(hooksPath)) {
      hasCompanionComposable = true;
      companionComposablePath = path.relative(__dirname, hooksPath).replace(/\\/g, '/');
      break;
    } else if (fs.existsSync(composablesPath)) {
      hasCompanionComposable = true;
      companionComposablePath = path.relative(__dirname, composablesPath).replace(/\\/g, '/');
      break;
    }
  }

  let logicLinesCount = 0;
  let stateDeclarations = 0;
  let functionsCount = 0;
  let lifecycleHooks = 0;
  let storeApiCalls = 0;
  const issues = [];

  let inTypeBlock = false;

  for (let i = 0; i < scriptLines.length; i++) {
    const rawLine = scriptLines[i];
    const line = rawLine.trim();

    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      continue;
    }

    // Игнорируем импорты
    if (line.startsWith('import ') || line.startsWith('import{') || line.startsWith('import type')) {
      continue;
    }

    // Игнорируем объявления интерфейсов/типов
    if (line.startsWith('interface ') || line.startsWith('type ') || line.startsWith('export interface ') || line.startsWith('export type ')) {
      if (line.includes('{') && !line.includes('}')) {
        inTypeBlock = true;
      }
      continue;
    }
    if (inTypeBlock) {
      if (line.includes('}')) inTypeBlock = false;
      continue;
    }

    // Игнорируем стандартный клей шаблона и вызовы composables (включая многострочные)
    if (
      line.startsWith('defineProps') ||
      line.startsWith('defineEmits') ||
      line.startsWith('defineModel') ||
      line.startsWith('defineOptions') ||
      line.startsWith('defineExpose') ||
      line.startsWith('withDefaults') ||
      line.startsWith('const props =') ||
      line.startsWith('const emit =') ||
      line.startsWith('const slots = useSlots') ||
      line.startsWith('const attrs = useAttrs') ||
      line.startsWith('const { t } = useI18n') ||
      line.startsWith('const { locale } = useI18n') ||
      line.startsWith('const { t, locale } = useI18n')
    ) {
      if ((line.includes('(') || line.includes('{')) && !line.endsWith(';') && !line.includes(');')) {
        inTypeBlock = true;
      }
      continue;
    }

    // Игнорируем вызов companion composable или многострочную деструктуризацию
    if (
      line.includes(`use${baseName}(`) || 
      line.includes(`use${baseName[0].toLowerCase() + baseName.slice(1)}(`) ||
      line.startsWith('const {') ||
      line.startsWith('const hook =') ||
      line.startsWith('} = use') ||
      line.startsWith('} = hook')
    ) {
      continue;
    }

    // Линии деструктуризации свойств из composable
    if (/^[a-zA-Z0-9_]+,?\s*$/.test(line)) {
      continue;
    }

    logicLinesCount++;

    // 1. Детекция локального реактивного состояния
    if (/\b(ref|reactive|shallowRef|computed|watch|watchEffect)\s*(<.*>)?\(/.test(line)) {
      stateDeclarations++;
      issues.push(`Строка ${i + 1}: Локальный стейт/эффект: ${line.slice(0, 70)}`);
    }

    // 2. Детекция объявлений функций
    if (
      /^(async\s+)?function\s+/.test(line) ||
      /^(const|let)\s+[a-zA-Z0-9_]+\s*=\s*(async\s*)?\([^)]*\)\s*=>/.test(line) ||
      /^(const|let)\s+[a-zA-Z0-9_]+\s*=\s*(async\s*)?[a-zA-Z0-9_]+\s*=>/.test(line)
    ) {
      functionsCount++;
      issues.push(`Строка ${i + 1}: Функция-обработчик: ${line.slice(0, 70)}`);
    }

    // 3. Детекция хуков жизненного цикла
    if (/\b(onMounted|onUnmounted|onBeforeMount|onBeforeUnmount|onUpdated|onActivated|onDeactivated)\s*\(/.test(line)) {
      lifecycleHooks++;
      issues.push(`Строка ${i + 1}: Хук жизненного цикла: ${line.slice(0, 70)}`);
    }

    // 4. Детекция прямых вызовов API/БД/Store
    if (/\b(api\.[a-zA-Z0-9_]+|fetch\(|surreal\.[a-zA-Z0-9_]+|db\.[a-zA-Z0-9_]+|use[A-Z][a-zA-Z0-9_]*Store\()\b/.test(line)) {
      storeApiCalls++;
      issues.push(`Строка ${i + 1}: Прямой вызов API/Store/DB: ${line.slice(0, 70)}`);
    }
  }

  // Расчёт «штрафного» рейтинга монолитности
  let score = logicLinesCount * 0.8 + stateDeclarations * 3 + functionsCount * 4 + lifecycleHooks * 5 + storeApiCalls * 6;
  if (!hasCompanionComposable && logicLinesCount > 15) {
    score += 15;
  }

  let level = 'CLEAN';
  if (stateDeclarations === 0 && functionsCount === 0 && lifecycleHooks === 0 && storeApiCalls === 0) {
    if (logicLinesCount > 25 && !hasCompanionComposable) {
      level = 'MODERATE';
    } else {
      level = 'CLEAN';
      score = Math.min(score, 10);
    }
  } else if (score >= 45 || (functionsCount >= 4 && !hasCompanionComposable)) {
    level = 'CRITICAL';
  } else if (score >= 18 || stateDeclarations >= 2) {
    level = 'MODERATE';
  }

  return {
    file: path.relative(__dirname, filePath).replace(/\\/g, '/'),
    baseName,
    hasScriptSetup: true,
    logicLinesCount,
    stateDeclarations,
    functionsCount,
    lifecycleHooks,
    storeApiCalls,
    hasCompanionComposable,
    companionComposablePath,
    score: Math.round(score),
    level,
    issues
  };
}

// Запуск анализа
const allVueFiles = [];
TARGET_DIRS.forEach(d => {
  const fullDir = path.join(__dirname, d);
  allVueFiles.push(...getVueFiles(fullDir));
});

const results = allVueFiles.map(analyzeVueFile);

// Сортировка: от самых монолитных к чистым
results.sort((a, b) => b.score - a.score);

const criticalList = results.filter(r => r.level === 'CRITICAL');
const moderateList = results.filter(r => r.level === 'MODERATE');
const cleanList = results.filter(r => r.level === 'CLEAN');

// Вывод в консоль
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║               VUE SCRIPT ARCHITECTURE AUDIT (COMPOSABLES)            ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

console.log(`📊 ОБЩАЯ СТАТИСТИКА:`);
console.log(`  • Всего .vue файлов проверено: ${results.length}`);
console.log(`  • 🔴 КРИТИЧЕСКИЕ МОНОЛИТЫ (требуют выноса в use*.ts): ${criticalList.length}`);
console.log(`  • 🟡 УМЕРЕННЫЕ МОНОЛИТЫ (содержат локальную логику):   ${moderateList.length}`);
console.log(`  • 🟢 ЧИСТЫЕ ПРЕЗЕНТАЦИОННЫЕ КОМПОНЕНТЫ:                ${cleanList.length}\n`);

console.log('────────────────────────────────────────────────────────────────────────');
console.log('  ТОП-15 САМЫХ МОНОЛИТНЫХ .VUE ФАЙЛОВ:');
console.log('────────────────────────────────────────────────────────────────────────');

criticalList.slice(0, 15).forEach((r, idx) => {
  console.log(`\n ${idx + 1}. 🔴 [Score: ${r.score} | Строк логики: ${r.logicLinesCount}] ${r.file}`);
  console.log(`    ↳ Состояние: ${r.stateDeclarations} | Функции: ${r.functionsCount} | Хуки: ${r.lifecycleHooks} | API/Store: ${r.storeApiCalls}`);
  console.log(`    ↳ Companion composable: ${r.hasCompanionComposable ? '✅ Есть (' + r.companionComposablePath + ')' : '❌ НЕТ (создать use' + r.baseName + '.ts)'}`);
  if (r.issues.length > 0) {
    console.log(`    ↳ Примеры нарушений:`);
    r.issues.slice(0, 3).forEach(iss => console.log(`       • ${iss}`));
    if (r.issues.length > 3) console.log(`       • ...и ещё ${r.issues.length - 3} мест`);
  }
});

// Сохранение отчетов
fs.writeFileSync(REPORT_JSON, JSON.stringify({
  total: results.length,
  criticalCount: criticalList.length,
  moderateCount: moderateList.length,
  cleanCount: cleanList.length,
  results
}, null, 2), 'utf8');

const txtLines = [
  '=== VUE SCRIPT ARCHITECTURE AUDIT REPORT ===\n',
  `Всего компонентов: ${results.length}`,
  `Критические монолиты (🔴): ${criticalList.length}`,
  `Умеренные монолиты (🟡): ${moderateList.length}`,
  `Чистые компоненты (🟢): ${cleanList.length}\n`,
  '=========================================',
  '1. КРИТИЧЕСКИЕ МОНОЛИТЫ (ТРЕБУЮТ ВЫНОСА В use*.ts)',
  '=========================================\n'
];

criticalList.forEach((r, idx) => {
  txtLines.push(`${idx + 1}. [Score: ${r.score} | Строк логики: ${r.logicLinesCount}] ${r.file}`);
  txtLines.push(`   Композабл: ${r.hasCompanionComposable ? r.companionComposablePath : 'ОТСУТСТВУЕТ -> use' + r.baseName + '.ts'}`);
  txtLines.push(`   Статистика: Стейт=${r.stateDeclarations}, Функции=${r.functionsCount}, Хуки=${r.lifecycleHooks}, API=${r.storeApiCalls}`);
  if (r.issues.length > 0) {
    txtLines.push(`   Нарушения:`);
    r.issues.forEach(iss => txtLines.push(`     - ${iss}`));
  }
  txtLines.push('');
});

txtLines.push('\n=========================================');
txtLines.push('2. УМЕРЕННЫЕ МОНОЛИТЫ');
txtLines.push('=========================================\n');

moderateList.forEach((r, idx) => {
  txtLines.push(`${idx + 1}. [Score: ${r.score} | Строк логики: ${r.logicLinesCount}] ${r.file}`);
  txtLines.push(`   Композабл: ${r.hasCompanionComposable ? r.companionComposablePath : 'ОТСУТСТВУЕТ -> use' + r.baseName + '.ts'}`);
  txtLines.push(`   Статистика: Стейт=${r.stateDeclarations}, Функции=${r.functionsCount}, Хуки=${r.lifecycleHooks}, API=${r.storeApiCalls}`);
  txtLines.push('');
});

fs.writeFileSync(REPORT_TXT, txtLines.join('\n'), 'utf8');

console.log(`\n────────────────────────────────────────────────────────────────────────`);
console.log(`✅ Детальный отчет сохранен в:`);
console.log(`   • ${REPORT_TXT}`);
console.log(`   • ${REPORT_JSON}`);
console.log(`────────────────────────────────────────────────────────────────────────\n`);
