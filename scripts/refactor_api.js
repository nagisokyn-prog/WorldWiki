import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(WORKSPACE_ROOT, 'apps/spa/src/ts');

function getRelPath(filePath, targetFile) {
  let relPath = path.relative(path.dirname(filePath), path.join(SRC_DIR, targetFile)).replace(/\\/g, '/');
  if (!relPath.startsWith('.')) relPath = './' + relPath;
  if (relPath.endsWith('.ts')) relPath = relPath.slice(0, -3);
  return relPath;
}

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      walkDir(dirPath, callback);
    } else {
      if (dirPath.endsWith('.ts') || dirPath.endsWith('.vue')) {
        callback(dirPath);
      }
    }
  });
}

walkDir(SRC_DIR, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  if (content.includes('timeline.service') || content.includes('timelineService')) {
    content = content.replace(/import\s+\{\s*timelineService\s*\}\s+from\s+['"][^'"]*timeline\.service['"];?/g, () => {
      return `import { useTimelineStore } from '${getRelPath(filePath, 'stores/timeline.store.ts')}';`;
    });
    content = content.replace(/timelineService\./g, `useTimelineStore().`);
    changed = true;
  }

  if (content.includes('tags.service') || content.includes('tagsManager')) {
    content = content.replace(/import\s+\{\s*tagsManager\s*\}\s+from\s+['"][^'"]*tags\.service['"];?/g, () => {
      return `import { useTagsStore } from '${getRelPath(filePath, 'stores/tags.store.ts')}';`;
    });
    content = content.replace(/tagsManager\./g, `useTagsStore().`);
    changed = true;
  }

  if (content.includes('calendar.service') || content.includes('calendarService')) {
    content = content.replace(/import\s+\{\s*calendarService\s*\}\s+from\s+['"][^'"]*calendar\.service['"];?/g, () => {
      return `import { useCalendarStore } from '${getRelPath(filePath, 'stores/calendar.store.ts')}';`;
    });
    content = content.replace(/calendarService\./g, `useCalendarStore().`);
    changed = true;
  }

  if (content.includes('export.service') || content.includes('exportService')) {
    content = content.replace(/import\s+\{\s*exportService\s*\}\s+from\s+['"][^'"]*export\.service['"];?/g, () => {
      return `import { useExport } from '${getRelPath(filePath, 'composables/useExport.ts')}';`;
    });
    content = content.replace(/exportService\./g, `useExport().`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated services in ${path.relative(SRC_DIR, filePath)}`);
  }
});
