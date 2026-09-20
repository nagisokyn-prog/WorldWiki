import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const inputPath = path.resolve(rootDir, process.argv[2] || 'cerberus-baseline-front.json');
const outputPath = path.resolve(rootDir, process.argv[3] || 'cerberus-baseline-fsd-arch.json');

if (!fs.existsSync(inputPath)) {
  console.error(`❌ Input file not found: ${inputPath}`);
  process.exit(1);
}

try {
  const rawData = fs.readFileSync(inputPath, 'utf-8');
  const entries = JSON.parse(rawData);

  if (!Array.isArray(entries)) {
    console.error(`❌ Expected JSON array in ${inputPath}`);
    process.exit(1);
  }

  const filtered = entries.filter((entry) => {
    const rule = entry.rule || '';
    return rule.startsWith('FSD-') || rule === 'ARCH-031';
  });

  // Group stats by rule
  const ruleCounts = {};
  for (const item of filtered) {
    ruleCounts[item.rule] = (ruleCounts[item.rule] || 0) + 1;
  }

  // Group stats by file
  const fileGroups = {};
  for (const item of filtered) {
    if (!fileGroups[item.file]) {
      fileGroups[item.file] = [];
    }
    fileGroups[item.file].push(item);
  }

  fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2) + '\n', 'utf-8');

  console.log(`\n🎯 Extracted ${filtered.length} violations (out of ${entries.length} total)`);
  console.log(`💾 Saved to: ${path.relative(rootDir, outputPath)}`);
  console.log('\n📊 Breakdown by Rule:');
  for (const [rule, count] of Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  • ${rule.padEnd(12)}: ${count}`);
  }

  console.log(`\n📁 Affected Files (${Object.keys(fileGroups).length}):`);
  for (const [file, items] of Object.entries(fileGroups)) {
    const rulesList = items.map((i) => i.rule).join(', ');
    console.log(`  • ${file} [${rulesList}]`);
  }
  console.log('');
} catch (err) {
  console.error(`❌ Failed to process baseline:`, err);
  process.exit(1);
}
