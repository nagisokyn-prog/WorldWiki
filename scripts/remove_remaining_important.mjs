import fs from 'node:fs';
import path from 'node:path';

const filesToClean = [
  'packages/resources/src/styles/features/chapters/EditorCoreTiptap.css',
  'packages/resources/src/styles/base/layout.css',
  'packages/resources/src/styles/base/reset.css'
];

for (const relPath of filesToClean) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`File not found: ${relPath}`);
    continue;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;
  // Replace ` !important` and `!important` in property values
  content = content.replace(/\s*!important/g, '');
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Cleaned !important from: ${relPath}`);
  }
}
