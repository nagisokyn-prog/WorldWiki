const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Administrator/Desktop/world-wiki/src/struct/editor';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let totalReplacements = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  content = content.replace(/"dataPath"\s*:\s*"([^"]+)_ключ_states"/g, '"dataPath": "$1"');
  content = content.replace(/"path"\s*:\s*"([^"]+)_ключ_states"/g, '"path": "$1"');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Processed ${file}`);
    totalReplacements++;
  }
}
console.log(`Done. Modified ${totalReplacements} files.`);
