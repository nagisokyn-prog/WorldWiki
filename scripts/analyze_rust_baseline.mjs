import fs from 'node:fs';
import path from 'node:path';

const baselinePath = path.resolve(process.cwd(), 'cerberus-baseline.json');
if (!fs.existsSync(baselinePath)) {
  console.log('cerberus-baseline.json not found!');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.violations || []);

console.log(`🛡️ АНАЛИЗ БЕЙЗЛАЙНА БЭКЕНДА / ОБЩЕГО (cerberus-baseline.json)\n`);
console.log(`📊 Всего нарушений в бейзлайне: ${list.length}\n`);

const byRule = {};
const byFile = {};

for (const item of list) {
  const rule = item.rule || item.rule_id || 'UNKNOWN';
  const file = item.file || item.file_path || 'UNKNOWN';
  
  byRule[rule] = (byRule[rule] || 0) + 1;
  byFile[file] = (byFile[file] || 0) + 1;
}

console.log(`📌 Распределение по правилам:`);
const sortedRules = Object.entries(byRule).sort((a, b) => b[1] - a[1]);
for (const [r, count] of sortedRules) {
  console.log(`   🔹 ${r.padEnd(16)}: ${count} шт.`);
}

console.log(`\n📁 Топ файлов с нарушениями:`);
const sortedFiles = Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 20);
for (const [f, count] of sortedFiles) {
  console.log(`   🔸 [${count} шт.] ${f}`);
}
