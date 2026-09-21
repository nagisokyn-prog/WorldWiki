import fs from 'node:fs';
import path from 'node:path';

const rule = process.argv[2] || 'CSS-005';
const baselinePath = path.resolve('cerberus-baseline-front.json');
const items = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

const filtered = items.filter((i) => i.rule === rule);

console.log(`\n🔍 Нарушения для правила [${rule}] (Всего: ${filtered.length}):\n`);
filtered.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.file}:${item.line}`);
  console.log(`   Message: ${item.message}`);
  console.log(`   Symbol:  ${item.symbol}`);
});
