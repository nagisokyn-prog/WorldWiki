import fs from 'node:fs';
import path from 'node:path';

function analyzeBaseline() {
  const baselinePath = path.resolve('cerberus-baseline-front.json');
  if (!fs.existsSync(baselinePath)) {
    console.error('❌ cerberus-baseline-front.json не найден');
    return;
  }

  const items = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  const byRule = {};
  const byFile = {};
  const detailedRules = {};

  for (const item of items) {
    byRule[item.rule] = (byRule[item.rule] || 0) + 1;
    byFile[item.file] = (byFile[item.file] || 0) + 1;

    if (!detailedRules[item.rule]) {
      detailedRules[item.rule] = [];
    }
    detailedRules[item.rule].push(item);
  }

  console.log('🛡️ АНАЛИЗ БЕЙЗЛАЙНА ФРОНТЕНДА (cerberus-baseline-front.json)\n');
  console.log(`📊 Всего нарушений в бейзлайне: ${items.length}\n`);

  console.log('📌 Распределение по правилам:');
  const sortedRules = Object.entries(byRule).sort((a, b) => b[1] - a[1]);
  for (const [rule, count] of sortedRules) {
    console.log(`   🔹 ${rule.padEnd(12)} : ${count} шт.`);
  }

  console.log('\n📁 Топ файлов с нарушениями:');
  const sortedFiles = Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [file, count] of sortedFiles) {
    console.log(`   🔸 [${count} шт.] ${file}`);
  }

  // Запись детального отчета
  const report = {
    total: items.length,
    byRule,
    topFiles: sortedFiles,
    rules: detailedRules,
  };

  fs.writeFileSync(
    path.resolve('.cerberus/baseline_breakdown.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );
  console.log('\n📄 Отчет сохранен в .cerberus/baseline_breakdown.json');
}

analyzeBaseline();
