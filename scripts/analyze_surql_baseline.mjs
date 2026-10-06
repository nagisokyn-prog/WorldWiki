import fs from 'node:fs';
import path from 'node:path';

function analyzeSurqlBaseline() {
  const baselinePath = path.resolve('cerberus-baseline.json');
  if (!fs.existsSync(baselinePath)) {
    console.error('❌ cerberus-baseline.json не найден по пути:', baselinePath);
    return;
  }

  const rawData = fs.readFileSync(baselinePath, 'utf-8');
  let items = [];
  try {
    items = JSON.parse(rawData);
  } catch (e) {
    console.error('❌ Ошибка парсинга JSON в cerberus-baseline.json:', e.message);
    return;
  }

  console.log('🛡️ ================================================================');
  console.log('🔍 КОМПЛЕКСНЫЙ АНАЛИЗ АРХИТЕКТУРНОГО БЕЙЗЛАЙНА (cerberus-baseline.json)');
  console.log('🛡️ ================================================================\n');

  console.log(`📊 Всего зафиксированных нарушений (Grandfathered Debt): ${items.length}\n`);

  // 1. Разбивка по семействам правил
  const families = {
    'SurrealDB (SURQL-*)': [],
    'Architecture (ARCH-*)': [],
    'Robustness (ROB-*)': [],
    'Concurrency & Async (CONC-*/ASYNC-*)': [],
    'AI-Defense (AI-*)': [],
    'Error Handling (ERR-*)': [],
    'Other Rules': [],
  };

  const byRule = {};
  const byFile = {};
  const byCrateOrModule = {};
  const surqlMessagePatterns = {};

  for (const item of items) {
    const rule = item.rule || 'UNKNOWN';
    const file = item.file || 'unknown';
    const message = item.message || '';

    // Family classification
    if (rule.startsWith('SURQL-')) {
      families['SurrealDB (SURQL-*)'].push(item);
      // Analyze message pattern for SURQL
      const patternKey = message.replace(/'[^']*'/g, "'<ID>'").replace(/`[^`]*`/g, "`<NAME>`");
      surqlMessagePatterns[patternKey] = (surqlMessagePatterns[patternKey] || 0) + 1;
    } else if (rule.startsWith('ARCH-')) {
      families['Architecture (ARCH-*)'].push(item);
    } else if (rule.startsWith('ROB-')) {
      families['Robustness (ROB-*)'].push(item);
    } else if (rule.startsWith('CONC-') || rule.startsWith('ASYNC-')) {
      families['Concurrency & Async (CONC-*/ASYNC-*)'].push(item);
    } else if (rule.startsWith('AI-')) {
      families['AI-Defense (AI-*)'].push(item);
    } else if (rule.startsWith('ERR-')) {
      families['Error Handling (ERR-*)'].push(item);
    } else {
      families['Other Rules'].push(item);
    }

    byRule[rule] = (byRule[rule] || 0) + 1;
    byFile[file] = (byFile[file] || 0) + 1;

    // Classify module / crate
    let moduleKey = 'Root / Other';
    if (file.includes('logic/schema/no_ai')) moduleKey = 'logic/schema/no_ai (Core Base)';
    else if (file.includes('logic/schema/ai')) moduleKey = 'logic/schema/ai (AI Ultra Space)';
    else if (file.includes('worldwiki-infrastructure')) moduleKey = 'worldwiki-infrastructure (Rust DB/FS Adapters)';
    else if (file.includes('worldwiki-application')) moduleKey = 'worldwiki-application (Rust Use Cases)';
    else if (file.includes('worldwiki-domain')) moduleKey = 'worldwiki-domain (Rust Pure Domain)';
    else if (file.includes('tauri-surreal-kit')) moduleKey = 'tauri-surreal-kit (Kit Backend)';
    else if (file.includes('src-tauri')) moduleKey = 'src-tauri (Tauri Desktop App)';

    byCrateOrModule[moduleKey] = (byCrateOrModule[moduleKey] || 0) + 1;
  }

  // Вывод по семействам
  console.log('📌 1. Распределение по семействам правил:');
  for (const [family, list] of Object.entries(families)) {
    if (list.length > 0) {
      const pct = ((list.length / items.length) * 100).toFixed(1);
      console.log(`   🔸 ${family.padEnd(38)} : ${String(list.length).padStart(4)} шт. (${pct}%)`);
    }
  }

  // Вывод по конкретным правилам
  console.log('\n📌 2. Топ правил по количеству нарушений:');
  const sortedRules = Object.entries(byRule).sort((a, b) => b[1] - a[1]);
  for (const [rule, count] of sortedRules) {
    const pct = ((count / items.length) * 100).toFixed(1);
    console.log(`   🔹 ${rule.padEnd(16)} : ${String(count).padStart(4)} шт. (${pct}%)`);
  }

  // Вывод по модулям / подсистемам
  console.log('\n📌 3. Локализация по модулям и подсистемам:');
  const sortedModules = Object.entries(byCrateOrModule).sort((a, b) => b[1] - a[1]);
  for (const [mod, count] of sortedModules) {
    const pct = ((count / items.length) * 100).toFixed(1);
    console.log(`   📁 ${mod.padEnd(46)} : ${String(count).padStart(4)} шт. (${pct}%)`);
  }

  // Вывод по файлам
  console.log('\n📌 4. Топ файлов с наибольшей концентрацией долга:');
  const sortedFiles = Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [file, count] of sortedFiles) {
    console.log(`   📄 [${String(count).padStart(3)} шт.] ${file}`);
  }

  // Анализ паттернов SurrealDB
  if (families['SurrealDB (SURQL-*)'].length > 0) {
    console.log('\n🧠 5. Типовые паттерны в SurrealDB (SURQL-*):');
    const sortedPatterns = Object.entries(surqlMessagePatterns).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [pattern, count] of sortedPatterns) {
      console.log(`   ⚡ [${String(count).padStart(3)}x] ${pattern}`);
    }
  }

  // Формирование подробного JSON отчета
  const reportDir = path.resolve('.cerberus');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const detailedReport = {
    analyzedAt: new Date().toISOString(),
    totalViolations: items.length,
    byFamily: Object.fromEntries(Object.entries(families).map(([k, v]) => [k, v.length])),
    byRule,
    byModule: byCrateOrModule,
    topFiles: sortedFiles,
    surqlPatterns: surqlMessagePatterns,
    items,
  };

  const reportPath = path.resolve('.cerberus/baseline_analysis_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2), 'utf-8');
  console.log(`\n💾 Детальный структурированный отчет сохранен: .cerberus/baseline_analysis_report.json`);
}

analyzeSurqlBaseline();
