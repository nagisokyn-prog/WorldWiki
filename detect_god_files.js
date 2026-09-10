/**
 * detect_god_files.js
 * Универсальный инквизитор и детектор божественных монолитов (God Files & Spaghetti Code)
 * для фронтенда (TypeScript / Vue) и бэкенда (Rust).
 *
 * Сканирует кодовую базу, выявляя перегруженные файлы, превышение лимитов строк,
 * скопление методов/структур и смешивание несвязанных зон ответственности.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Директории для сканирования
const SCAN_ROOTS = [
  'apps',
  'packages',
  'src-tauri/src',
  'src-tauri/crates',
  'tauri-surreal-kit'
];

// Папки и паттерны, которые игнорируются
const IGNORE_DIRS = [
  'node_modules',
  'target',
  'dist',
  'build',
  'vendor',
  '.git',
  '.logic_legacy',
  'coverage',
  '.turbo',
  '.vite-hooks',
  'dist-tauri',
  'artifacts',
  'libs'
];

// Пороговые значения (Thresholds)
const THRESHOLDS = {
  // Лимиты по чистым строкам кода (SLOC)
  MAX_LINES_WARNING: 350,
  MAX_LINES_ERROR: 500,
  MAX_LINES_CRITICAL: 800,

  // Максимум функций/методов в одном файле
  MAX_FUNCTIONS_WARNING: 15,
  MAX_FUNCTIONS_ERROR: 25,

  // Максимум публичных структур/интерфейсов/типов в одном файле
  MAX_DECLARATIONS_WARNING: 10,
  MAX_DECLARATIONS_ERROR: 18,
};

const REPORT_JSON = path.join(__dirname, 'god_files_report.json');
const REPORT_TXT = path.join(__dirname, 'god_files_report.txt');

// Рекурсивный поиск файлов
function collectFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (IGNORE_DIRS.includes(ent.name) || ent.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      results = results.concat(collectFiles(fullPath));
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (['.rs', '.ts', '.vue', '.js', '.tsx'].includes(ext)) {
        // Исключаем тайпинги и интеграционные/юнит тесты (для тестов большой размер — норма)
        if (!ent.name.endsWith('.d.ts') && !ent.name.includes('.spec.') && !ent.name.includes('.test.') && !fullPath.includes('/tests/') && !fullPath.includes('\\tests\\')) {
          results.push(fullPath);
        }
      }
    }
  }
  return results;
}

// Анализ Rust-файла
function analyzeRustFile(content) {
  const lines = content.split('\n');
  const totalLines = lines.length;
  
  // Чистые строки (без пустых и однострочных комментов)
  const codeLines = lines.filter(l => {
    const trimmed = l.trim();
    return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
  }).length;

  const fnMatches = content.match(/\b(pub\s+)?(async\s+)?fn\s+[a-zA-Z0-9_]+/g) || [];
  const structMatches = content.match(/\b(pub\s+)?struct\s+[a-zA-Z0-9_]+/g) || [];
  const enumMatches = content.match(/\b(pub\s+)?enum\s+[a-zA-Z0-9_]+/g) || [];
  const traitMatches = content.match(/\b(pub\s+)?trait\s+[a-zA-Z0-9_]+/g) || [];
  const implMatches = content.match(/\bimpl(\s+<[^>]+>)?\s+([a-zA-Z0-9_:]+)/g) || [];

  // Детекция смешивания разнородных обязанностей
  const hasSqlQueries = /SELECT|INSERT|UPDATE|DELETE|UPSERT|RELATE/i.test(content) && content.includes('query(');
  const hasHttpCalls = /reqwest|reqwest::Client|HeaderMap/i.test(content);
  const hasTauriCommands = /#\[tauri::command\]|tauri::State|tauri::AppHandle/i.test(content);
  const hasDomainLogic = content.includes('DomainError') || content.includes('Entity');

  const mixCount = [hasSqlQueries, hasHttpCalls, hasTauriCommands].filter(Boolean).length;
  const isMultiLayerSpaghetti = mixCount >= 2;

  return {
    lang: 'Rust',
    totalLines,
    codeLines,
    functionsCount: fnMatches.length,
    declarationsCount: structMatches.length + enumMatches.length + traitMatches.length,
    implBlocksCount: implMatches.length,
    isMultiLayerSpaghetti,
    details: {
      hasSqlQueries,
      hasHttpCalls,
      hasTauriCommands,
      hasDomainLogic,
      structs: structMatches.length,
      enums: enumMatches.length,
      traits: traitMatches.length
    }
  };
}

// Анализ TypeScript / Vue файла
function analyzeTsVueFile(content, isVue) {
  const lines = content.split('\n');
  const totalLines = lines.length;

  const codeLines = lines.filter(l => {
    const trimmed = l.trim();
    return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
  }).length;

  const fnMatches = content.match(/\b(function\s+[a-zA-Z0-9_]+|const\s+[a-zA-Z0-9_]+\s*=\s*(\([^)]*\)|async\s*\([^)]*\)|[a-zA-Z0-9_]+)\s*=>)/g) || [];
  const interfaceMatches = content.match(/\b(export\s+)?(interface|type)\s+[a-zA-Z0-9_]+/g) || [];
  const classMatches = content.match(/\b(export\s+)?class\s+[a-zA-Z0-9_]+/g) || [];

  // Vue-специфичные замеры
  let vueScriptLines = 0;
  let hasRawStateInVue = false;
  if (isVue) {
    const scriptMatch = content.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      const scriptBody = scriptMatch[1];
      vueScriptLines = scriptBody.split('\n').filter(l => l.trim().length > 0).length;
      hasRawStateInVue = /\b(ref|reactive|shallowRef)\s*\(/.test(scriptBody);
    }
  }

  // Детекция смешивания слоев
  const hasDirectIpc = /invoke\s*\(|tauri::invoke/i.test(content);
  const hasDirectHttp = /fetch\s*\(|axios|reqwest/i.test(content);
  const hasStoreAndApi = content.includes('usePinia') || content.includes('defineStore');

  return {
    lang: isVue ? 'Vue' : 'TypeScript',
    totalLines,
    codeLines,
    functionsCount: fnMatches.length,
    declarationsCount: interfaceMatches.length + classMatches.length,
    vueScriptLines,
    hasRawStateInVue,
    isMultiLayerSpaghetti: (hasDirectIpc || hasDirectHttp) && isVue,
    details: {
      hasDirectIpc,
      hasDirectHttp,
      hasStoreAndApi,
      interfaces: interfaceMatches.length,
      classes: classMatches.length
    }
  };
}

// Оценка степени монолитности
function calculateSeverity(analysis) {
  const issues = [];
  let severityScore = 0;

  // 1. По строкам
  if (analysis.totalLines >= THRESHOLDS.MAX_LINES_CRITICAL) {
    issues.push(`Критический размер: ${analysis.totalLines} строк (порог ${THRESHOLDS.MAX_LINES_CRITICAL})`);
    severityScore += 50;
  } else if (analysis.totalLines >= THRESHOLDS.MAX_LINES_ERROR) {
    issues.push(`Чрезмерный размер: ${analysis.totalLines} строк (порог ${THRESHOLDS.MAX_LINES_ERROR})`);
    severityScore += 30;
  } else if (analysis.totalLines >= THRESHOLDS.MAX_LINES_WARNING) {
    issues.push(`Повышенный размер: ${analysis.totalLines} строк (порог ${THRESHOLDS.MAX_LINES_WARNING})`);
    severityScore += 10;
  }

  // 2. По функциям
  if (analysis.functionsCount >= THRESHOLDS.MAX_FUNCTIONS_ERROR) {
    issues.push(`Слишком много функций/методов: ${analysis.functionsCount} (порог ${THRESHOLDS.MAX_FUNCTIONS_ERROR})`);
    severityScore += 25;
  } else if (analysis.functionsCount >= THRESHOLDS.MAX_FUNCTIONS_WARNING) {
    issues.push(`Много функций в одном файле: ${analysis.functionsCount} (порог ${THRESHOLDS.MAX_FUNCTIONS_WARNING})`);
    severityScore += 10;
  }

  // 3. По спагетти слоёв
  if (analysis.isMultiLayerSpaghetti) {
    issues.push(`Смешивание слоёв архитектуры (DB + HTTP / UI + IPC) в одном файле`);
    severityScore += 35;
  }

  // 4. Для Vue
  if (analysis.lang === 'Vue') {
    if (analysis.vueScriptLines > 50) {
      issues.push(`Перегруженный <script setup>: ${analysis.vueScriptLines} строк (норма <= 30)`);
      severityScore += 25;
    }
    if (analysis.hasRawStateInVue) {
      issues.push(`Локальное объявление состояния ref/reactive внутри .vue вместо Composable use*.ts`);
      severityScore += 15;
    }
  }

  let status = 'CLEAN';
  if (severityScore >= 50) {
    status = 'CRITICAL_GOD_FILE';
  } else if (severityScore >= 25) {
    status = 'MONOLITH_WARNING';
  } else if (severityScore > 0) {
    status = 'ATTENTION';
  }

  return { status, severityScore, issues };
}

// Главная функция аудита
function main() {
  console.log('\n=============================================================');
  console.log('  🔍 АУДИТОР БОЖЕСТВЕННЫХ МОНОЛИТОВ И СПАГЕТТИ (GOD FILES)');
  console.log('=============================================================\n');

  let allFiles = [];
  for (const rootDir of SCAN_ROOTS) {
    const fullRoot = path.join(__dirname, rootDir);
    allFiles = allFiles.concat(collectFiles(fullRoot));
  }

  const reports = [];
  let totalGodFiles = 0;
  let totalWarnings = 0;

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relPath = path.relative(__dirname, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();

    let analysis;
    if (ext === '.rs') {
      analysis = analyzeRustFile(content);
    } else {
      analysis = analyzeTsVueFile(content, ext === '.vue');
    }

    const { status, severityScore, issues } = calculateSeverity(analysis);

    if (status !== 'CLEAN') {
      if (status === 'CRITICAL_GOD_FILE') totalGodFiles++;
      if (status === 'MONOLITH_WARNING') totalWarnings++;

      reports.push({
        file: relPath,
        status,
        severityScore,
        lang: analysis.lang,
        totalLines: analysis.totalLines,
        codeLines: analysis.codeLines,
        functionsCount: analysis.functionsCount,
        issues,
        details: analysis.details
      });
    }
  }

  // Сортировка по тяжести проблемы
  reports.sort((a, b) => b.severityScore - a.severityScore || b.totalLines - a.totalLines);

  // Вывод в консоль
  if (reports.length === 0) {
    console.log('✅ ИДЕАЛЬНО! В проекте нет ни одного божественного файла-монолита.\n');
  } else {
    console.log(`⚠️ Найдено файлов с признаками монолита/спагетти: ${reports.length}`);
    console.log(`🚨 Критических God Files: ${totalGodFiles}`);
    console.log(`🟡 Предупреждений: ${totalWarnings}\n`);

    console.log('--- Топ обнаруженных файлов: ---');
    reports.slice(0, 20).forEach((rep, idx) => {
      const icon = rep.status === 'CRITICAL_GOD_FILE' ? '🔴' : rep.status === 'MONOLITH_WARNING' ? '🟠' : '🟡';
      console.log(`\n${idx + 1}. ${icon} [${rep.status}] (${rep.severityScore} pts) ${rep.file}`);
      console.log(`   Строк: ${rep.totalLines} (код: ${rep.codeLines}), Функций/методов: ${rep.functionsCount}, Язык: ${rep.lang}`);
      rep.issues.forEach(iss => console.log(`   - ❌ ${iss}`));
    });
  }

  // Сохранение отчетов
  fs.writeFileSync(REPORT_JSON, JSON.stringify(reports, null, 2), 'utf8');
  
  let txtOutput = `ОТЧЕТ АУДИТА БОЖЕСТВЕННЫХ ФАЙЛОВ\n`;
  txtOutput += `Дата: ${new Date().toISOString()}\n`;
  txtOutput += `Всего проверено файлов: ${allFiles.length}\n`;
  txtOutput += `Критических God Files: ${totalGodFiles}\n`;
  txtOutput += `Предупреждений: ${totalWarnings}\n\n`;
  reports.forEach(r => {
    txtOutput += `[${r.status}] (${r.totalLines} lines, ${r.functionsCount} fns) ${r.file}\n`;
    r.issues.forEach(i => {
      txtOutput += `  - ${i}\n`;
    });
    txtOutput += '\n';
  });
  fs.writeFileSync(REPORT_TXT, txtOutput, 'utf8');

  console.log(`\n📄 Детальный отчет сохранен в:`);
  console.log(`   - ${path.relative(__dirname, REPORT_TXT)}`);
  console.log(`   - ${path.relative(__dirname, REPORT_JSON)}\n`);

  if (process.argv.includes('--ci') && totalGodFiles > 0) {
    console.error(`❌ CI Check Failed: Обнаружены критические божественные файлы (${totalGodFiles}).`);
    process.exit(1);
  }
}

main();
