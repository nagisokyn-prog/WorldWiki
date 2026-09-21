import fs from 'node:fs';
import path from 'node:path';

const targetRule = process.argv[2] || 'CSS-PERF-003';
const baselinePath = path.resolve(process.cwd(), 'cerberus-baseline-front.json');
const raw = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.violations || []);

const matches = list.filter(v => (v.rule || v.rule_id) === targetRule);
console.log(`Violations for ${targetRule}: ${matches.length} items\n`);

for (const m of matches) {
  console.log(`- [${m.rule || m.rule_id}] ${m.file || m.file_path}:${m.line || '?'}`);
  console.log(`  Message: ${m.message}`);
}
