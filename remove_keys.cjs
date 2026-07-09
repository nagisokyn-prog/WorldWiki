const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Administrator/Desktop/world-wiki/src/struct/editor';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let totalReplacements = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  let originalContent = content;
  
  // Replace "something_ключ.something_else" with "something_else"
  content = content.replace(/"dataPath"\s*:\s*"[^"]*_ключ\.([^"]+)"/g, '"dataPath": "$1"');
  
  // Replace "something_ключ" with "something"
  content = content.replace(/"dataPath"\s*:\s*"([^"]+)_ключ"/g, '"dataPath": "$1"');
  
  // Also fix "path" just in case
  content = content.replace(/"path"\s*:\s*"[^"]*_ключ\.([^"]+)"/g, '"path": "$1"');
  content = content.replace(/"path"\s*:\s*"([^"]+)_ключ"/g, '"path": "$1"');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Processed ${file}`);
    totalReplacements++;
  }
}

console.log(`Done. Modified ${totalReplacements} files.`);
