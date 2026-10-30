import fs from 'node:fs';
import path from 'node:path';

function walkDir(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      callback(fullPath);
    }
  }
}

let fixedCount = 0;

walkDir(path.resolve('apps/spa/src/ts'), (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  let updated = content;

  // Исправляем defineProps<FooProps>>() -> defineProps<FooProps>()
  updated = updated.replace(/defineProps<([A-Za-z0-9_]+)>>\(\)/g, 'defineProps<$1>()');
  // Исправляем defineEmits<FooEmits>>() -> defineEmits<FooEmits>()
  updated = updated.replace(/defineEmits<([A-Za-z0-9_]+)>>\(\)/g, 'defineEmits<$1>()');

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    fixedCount++;
    console.log(`[Fixed] ${path.relative(process.cwd(), filePath)}`);
  }
});

console.log(`\nГотово! Исправлено файлов: ${fixedCount}`);

