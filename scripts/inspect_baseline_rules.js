import fs from 'node:fs';

const baseline = JSON.parse(fs.readFileSync('cerberus-baseline.json', 'utf8'));

function printRules(rules) {
  const filtered = baseline.filter(x => rules.includes(x.rule));
  console.log(`Found ${filtered.length} violations for [${rules.join(', ')}]:\n`);
  for (const item of filtered) {
    console.log(`[${item.rule}] ${item.file}:${item.line || 0}`);
    console.log(`  Message: ${item.message}`);
    if (item.symbol) console.log(`  Symbol: ${item.symbol}`);
    console.log('---');
  }
}

console.log('================ AI-008 ================');
printRules(['AI-008']);

console.log('============ ARCH-030..032 ============');
printRules(['ARCH-030', 'ARCH-031', 'ARCH-032']);
