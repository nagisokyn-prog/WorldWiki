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

const archViolations = entries.filter(e => {
  const r = getRuleId(e);
  return ['ARCH-030', 'ARCH-031', 'SLOP-001', 'ARCH-001', 'ARCH-005'].includes(r);
});

console.log(`================================================================`);
console.log(`🔍 ARCH & SLOP ANALYSIS: Monoliths & Complexity (${archViolations.length} total)`);
console.log(`================================================================\n`);

const ruleMap = {};
for (const v of archViolations) {
  const r = getRuleId(v);
  if (!ruleMap[r]) ruleMap[r] = [];
  ruleMap[r].push(v);
}

for (const [ruleId, list] of Object.entries(ruleMap)) {
  console.log(`📌 Rule [${ruleId}]: ${list.length} occurrences`);
  list.forEach(item => {
    const f = item.file || item.file_path || '';
    const sym = item.symbol || item.identifier || item.context || '';
    console.log(`   ↳ ${f} [${sym}]`);
  });
  console.log(``);
}

console.log(`----------------------------------------------------------------`);
console.log(`🧩 Recommended Monolith Decompositions:`);
console.log(`----------------------------------------------------------------\n`);

console.log(`1. src-tauri/src/logic/entities/mod.rs (>750 lines):`);
console.log(`   Split into:`);
console.log(`   ├── src-tauri/src/logic/entities/mod.rs        (Public module facade & re-exports)`);
console.log(`   ├── src-tauri/src/logic/entities/commands.rs   (Tauri command handlers)`);
console.log(`   ├── src-tauri/src/logic/entities/crud.rs       (Entity CRUD operations & queries)`);
console.log(`   ├── src-tauri/src/logic/entities/relations.rs  (Entity graph & connection helpers)`);
console.log(`   └── src-tauri/src/logic/entities/types.rs      (Domain DTOs & EntityError enum)\n`);

console.log(`2. src-tauri/src/logic/batch/mod.rs:`);
console.log(`   Split into:`);
console.log(`   ├── src-tauri/src/logic/batch/mod.rs           (Public re-exports)`);
console.log(`   ├── src-tauri/src/logic/batch/commands.rs      (Tauri IPC endpoints)`);
console.log(`   ├── src-tauri/src/logic/batch/executor.rs      (Transactional batch runner)`);
console.log(`   └── src-tauri/src/logic/batch/types.rs         (Batch DTOs & BatchError enum)\n`);

console.log(`3. src-tauri/src/bootstrap/services.rs [SLOP-001]:`);
console.log(`   Decompose huge factory functions (build_app_services, build_surreal_app_services)`);
console.log(`   into smaller builder stages:`);
console.log(`   - init_database_layer(...)`);
console.log(`   - init_ai_layer(...)`);
console.log(`   - init_fs_and_export_layer(...)\n`);
