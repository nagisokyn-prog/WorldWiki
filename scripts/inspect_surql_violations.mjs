import fs from 'node:fs';
import path from 'node:path';

function inspectSurqlViolations() {
  const targetRule = process.argv[2];
  const targetFile = process.argv[3];

  const baselinePath = path.resolve('cerberus-baseline.json');
  if (!fs.existsSync(baselinePath)) {
    console.error('❌ cerberus-baseline.json не найден');
    return;
  }

  const items = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

  let filtered = items;
  if (targetRule) {
    filtered = filtered.filter(item => item.rule === targetRule || item.rule.toLowerCase() === targetRule.toLowerCase());
  }
  if (targetFile) {
    filtered = filtered.filter(item => item.file.includes(targetFile));
  }

  console.log('🔍 ================================================================');
  console.log(`📋 ДЕТАЛЬНАЯ ИНСПЕКЦИЯ НАРУШЕНИЙ: ${targetRule || 'ВСЕ ПРАВИЛА'}`);
  if (targetFile) console.log(`📁 Фильтр по файлу: ${targetFile}`);
  console.log(`📊 Найдено записей: ${filtered.length} из ${items.length}`);
  console.log('🔍 ================================================================\n');

  if (filtered.length === 0) {
    console.log('ℹ️ Нарушений по заданным фильтрам не найдено.');
    console.log('💡 Примеры вызова:');
    console.log('   node scripts/inspect_surql_violations.mjs SURQL-015');
    console.log('   node scripts/inspect_surql_violations.mjs SURQL-008 chat_branching.rs');
    return;
  }

  filtered.forEach((item, idx) => {
    console.log(`[#${idx + 1}] 🛑 ${item.rule} | ${item.file}:${item.line}`);
    if (item.symbol) console.log(`    🏷️ Символ: ${item.symbol}`);
    console.log(`    💬 Сообщение: ${item.message}`);
    console.log(`    🔐 Fingerprint: ${item.fingerprint}`);
    console.log('    ────────────────────────────────────────────────────────');
  });
}

inspectSurqlViolations();
