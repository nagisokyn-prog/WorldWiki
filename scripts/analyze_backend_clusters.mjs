import fs from 'node:fs';
import path from 'node:path';

const baselinePath = path.resolve(process.cwd(), 'cerberus-baseline.json');
if (!fs.existsSync(baselinePath)) {
  console.error('cerberus-baseline.json not found!');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.violations || []);

console.log('═'.repeat(70));
console.log('🦀 CERBERUS BACKEND ARCHITECTURAL AUDIT REPORT');
console.log('═'.repeat(70));
console.log(`\n📊 Всего нарушений в бейзлайне: ${list.length}\n`);

// Group by Rule & Category
const clusters = {
  'ERR-003 (Нетипизированные Result<T, String>)': [],
  'ROB-001 (Небезопасные .unwrap() и .expect())': [],
  'SLOP-001 (Раздутый AI-бойлерплейт)': [],
  'ARCH-030 / ARCH-031 (Архитектурное давление и SLOC)': [],
  'AI-003 / AI-013 (Зондирование окружения и подавления)': [],
  'ARCH-001 / ARCH-005 (Нарушение гексагональных слоев)': [],
  'Прочие изолированные нарушения': []
};

for (const item of list) {
  const rule = item.rule || item.rule_id || '';
  if (rule === 'ERR-003') clusters['ERR-003 (Нетипизированные Result<T, String>)'].push(item);
  else if (rule === 'ROB-001') clusters['ROB-001 (Небезопасные .unwrap() и .expect())'].push(item);
  else if (rule === 'SLOP-001') clusters['SLOP-001 (Раздутый AI-бойлерплейт)'].push(item);
  else if (rule === 'ARCH-030' || rule === 'ARCH-031') clusters['ARCH-030 / ARCH-031 (Архитектурное давление и SLOC)'].push(item);
  else if (rule === 'AI-003' || rule === 'AI-013') clusters['AI-003 / AI-013 (Зондирование окружения и подавления)'].push(item);
  else if (rule === 'ARCH-001' || rule === 'ARCH-005') clusters['ARCH-001 / ARCH-005 (Нарушение гексагональных слоев)'].push(item);
  else clusters['Прочие изолированные нарушения'].push(item);
}

for (const [title, items] of Object.entries(clusters)) {
  if (items.length === 0) continue;
  console.log(`\n🏷️  ${title} [${items.length} шт.]`);
  console.log('─'.repeat(70));
  
  // Group by file
  const fileGroups = {};
  for (const it of items) {
    const f = it.file || it.file_path || 'unknown';
    fileGroups[f] = fileGroups[f] || [];
    fileGroups[f].push(it);
  }

  for (const [file, fItems] of Object.entries(fileGroups)) {
    console.log(`  📁 ${file} (${fItems.length} шт.):`);
    for (const it of fItems.slice(0, 5)) {
      console.log(`     • [${it.symbol || 'code'}] line ${it.line || 1}: ${it.message}`);
    }
    if (fItems.length > 5) {
      console.log(`     ... и ещё ${fItems.length - 5} мест`);
    }
  }
}

// Generate JSON summary for downstream tooling
const summaryPath = path.resolve(process.cwd(), '.cerberus/backend_audit_summary.json');
fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
fs.writeFileSync(summaryPath, JSON.stringify(clusters, null, 2), 'utf8');
console.log(`\n📄 Сводка сохранена в .cerberus/backend_audit_summary.json\n`);
