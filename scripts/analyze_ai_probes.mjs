import fs from 'node:fs';
import path from 'node:path';

const BASELINE_FILE = path.resolve('cerberus-baseline.json');

if (!fs.existsSync(BASELINE_FILE)) {
  console.error(`❌ Baseline file not found: ${BASELINE_FILE}`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8'));
const entries = Array.isArray(baseline) ? baseline : (baseline.entries || baseline.violations || []);

const getRuleId = (e) => typeof e.rule === 'string' ? e.rule : (e.rule_id || e.rule?.id || 'UNKNOWN');

const aiViolations = entries.filter(e => {
  const r = getRuleId(e);
  return ['AI-003', 'AI-013', 'AI-001', 'AI-002'].includes(r);
});

console.log(`================================================================`);
console.log(`🔍 AI PROBES & SUPPRESSIONS ANALYSIS (${aiViolations.length} total)`);
console.log(`================================================================\n`);

aiViolations.forEach(v => {
  const r = getRuleId(v);
  const f = v.file || v.file_path || '';
  const sym = v.symbol || v.identifier || v.context || '';
  console.log(`📌 [${r}] ${f} -> ${sym}`);
});

console.log(`\n----------------------------------------------------------------`);
console.log(`💡 Remediation for AI-003 (Platform Environment Probes):`);
console.log(`----------------------------------------------------------------\n`);
console.log(`Direct calls to std::env::current_dir() or env::current_exe() in logic/lib.rs:`);
console.log(`Isolate platform FS environment paths inside an infrastructure adapter or passed via AppConfig at startup.\n`);
