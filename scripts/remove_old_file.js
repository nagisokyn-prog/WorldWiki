import fs from 'node:fs';
import path from 'node:path';

const files = [
  'src-tauri/crates/worldwiki-application/src/ai/tools/entity_tools/mutator.rs',
];

for (const f of files) {
  const p = path.resolve(f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`Deleted obsolete file: ${f}`);
  }
}
