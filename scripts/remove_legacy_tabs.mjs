import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DIRS_TO_REMOVE = [
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab2Astronomy',
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab3Chronology',
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab4SyncLeap',
];

const FILES_TO_REMOVE = [
  'packages/resources/src/styles/features/timeline/Tab2Astronomy.css',
  'packages/resources/src/styles/features/timeline/Tab3Chronology.css',
  'packages/resources/src/styles/features/timeline/Tab4SyncLeap.css',
];

for (const d of DIRS_TO_REMOVE) {
  const full = path.join(ROOT, d);
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`Deleted dir: ${d}`);
  }
}

for (const f of FILES_TO_REMOVE) {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    console.log(`Deleted file: ${f}`);
  }
}
