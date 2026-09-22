import fs from 'fs';

const data = JSON.parse(fs.readFileSync('cerberus-baseline.json', 'utf8'));

function showRule(ruleId) {
  console.log(`\n================================================================================`);
  console.log(`🔍 VIOLATIONS FOR RULE: ${ruleId}`);
  console.log(`================================================================================`);
  const matches = data.filter(e => e.rule === ruleId);
  console.log(`Total: ${matches.length}`);
  matches.forEach((e, idx) => {
    console.log(`  ${idx + 1}. ${e.file}:${e.line} [${e.symbol || 'block'}]`);
    console.log(`     Message: ${e.message}`);
  });
}

showRule('AI-008');
showRule('AI-013');
