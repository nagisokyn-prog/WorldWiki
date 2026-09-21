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

const robViolations = entries.filter(e => getRuleId(e) === 'ROB-001');

console.log(`================================================================`);
console.log(`🔍 ROB-001 ANALYSIS: Unsafe Panics, unwraps & expects (${robViolations.length} total)`);
console.log(`================================================================\n`);

const categories = {
  build_scripts: [],
  runtime_logic: [],
  tauri_shell_bootstrap: [],
  other: []
};

for (const v of robViolations) {
  const filePath = v.file || v.file_path || '';
  const item = {
    file: filePath,
    line: v.line || v.line_number || 1,
    symbol: v.symbol || v.identifier || v.context || '',
    message: v.message || ''
  };

  if (filePath.includes('build.rs') || filePath.includes('llama-sys')) {
    categories.build_scripts.push(item);
  } else if (filePath.includes('logic')) {
    categories.runtime_logic.push(item);
  } else if (filePath.includes('bootstrap') || filePath.includes('main.rs') || filePath.includes('lib.rs')) {
    categories.tauri_shell_bootstrap.push(item);
  } else {
    categories.other.push(item);
  }
}

console.log(`📦 1. Build Scripts (build.rs / llama-sys): ${categories.build_scripts.length} occurrences`);
console.log(`   💡 Remediation Strategy: Replace raw .unwrap() with custom BuildError or map_err/expect with structured context.\n`);

console.log(`🚨 2. Runtime Business Logic (src/logic/**): ${categories.runtime_logic.length} occurrences`);
console.log(`   ⚠️ CRITICAL: These can crash production Tauri runtime on malformed inputs or DB dropouts!`);
console.log(`   💡 Remediation Strategy: Propagate errors via '?' operator and map into typed Domain/Application Errors.\n`);

console.log(`⚙️ 3. Tauri Shell & Bootstrap (src/bootstrap/**, main.rs, lib.rs): ${categories.tauri_shell_bootstrap.length} occurrences`);
console.log(`   💡 Remediation Strategy: Bubble up errors to App initialization result rather than panic.\n`);

if (categories.other.length > 0) {
  console.log(`📁 4. Other Modules: ${categories.other.length} occurrences\n`);
}

// Group by file
const byFile = {};
for (const v of robViolations) {
  const f = v.file || v.file_path || 'unknown';
  byFile[f] = (byFile[f] || 0) + 1;
}

console.log(`📊 Breakdown by file:`);
Object.entries(byFile)
  .sort(([, a], [, b]) => b - a)
  .forEach(([file, count]) => {
    console.log(`   ${String(count).padStart(3, ' ')} │ ${file}`);
  });
