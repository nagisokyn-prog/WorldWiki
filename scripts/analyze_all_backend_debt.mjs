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

console.log(`================================================================`);
console.log(`📊 MASTER BACKEND ARCHITECTURAL DEBT REPORT (${entries.length} Total Violations)`);
console.log(`================================================================\n`);

const clusters = {};
for (const entry of entries) {
  const rule = getRuleId(entry);
  if (!clusters[rule]) clusters[rule] = [];
  clusters[rule].push(entry);
}

const sortedRules = Object.entries(clusters).sort(([, a], [, b]) => b.length - a.length);

console.log(`🏆 Violations by Cerberus Rule:`);
for (const [rule, list] of sortedRules) {
  console.log(`   [${rule.padEnd(10, ' ')}] : ${String(list.length).padStart(3, ' ')} violations`);
}

console.log(`\n================================================================`);
console.log(`🗺️ 5-STEP ELIMINATION ROADMAP:`);
console.log(`================================================================`);
console.log(`1. STEP 1 [ERR-003] (101 items): Define module-level thiserror enums (BatchError, EntityError, etc.)`);
console.log(`2. STEP 2 [ROB-001] (91 items) : Replace unwrap()/expect() with '?' operator and structured errors`);
console.log(`3. STEP 3 [ARCH-030/031] (8)   : Decompose entities/mod.rs and batch/mod.rs into submodules`);
console.log(`4. STEP 4 [SLOP-001] (9 items) : Decompose build_app_services and monolithic bootstrap functions`);
console.log(`5. STEP 5 [AI-003/AI-013] (5+) : Isolate platform environment probes behind adapters`);
console.log(`================================================================\n`);
