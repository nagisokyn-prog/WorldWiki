import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(WORKSPACE_ROOT, 'apps/spa/src/ts');

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

const fixes = [
  // 1. General Entity Methods
  { regex: /api\.getEntityList\(/g, replace: "api.getEntities(" },
  { regex: /api\.getEntity\([^,]+,\s*[^,]+,\s*([^)]+)\)/g, replace: "api.getEntity($1)" },
  { regex: /api\.saveEntity\([^,]+,\s*[^,]+,\s*([^,]+),\s*[^)]+\)/g, replace: "api.saveEntity($1 as any)" },
  { regex: /api\.saveEntity\([^,]+,\s*[^,]+,\s*([^,]+),\s*[^,]+,\s*[^)]+\)/g, replace: "api.saveEntity($1 as any)" }, // for 5 args
  { regex: /api\.deleteEntity\([^,]+,\s*[^,]+,\s*([^)]+)\)/g, replace: "api.deleteEntity($1)" },
  { regex: /api\.searchEntities\(([^,]+),\s*([^)]+)\)/g, replace: "api.searchEntities($1, $2, null)" },

  // 2. Schema Methods
  { regex: /api\.getSchemas\(/g, replace: "api.getEntitySchemas(" },
  { regex: /api\.saveSchema\(/g, replace: "api.saveEntitySchema(" },

  // 3. Chapter Methods
  { regex: /api\.getChaptersList\(/g, replace: "api.getChapters(" },
  { regex: /api\.getChapter\([^,]+,\s*([^)]+)\)/g, replace: "api.getChapter($1)" },
  { regex: /api\.saveChapter\([^,]+,\s*([^)]+)\)/g, replace: "api.saveChapter($1 as any)" },
  { regex: /api\.deleteChapter\([^,]+,\s*([^)]+)\)/g, replace: "api.deleteChapter($1)" },
  { regex: /api\.getHierarchy\(/g, replace: "api.getChapterHierarchy(" },

  // 4. Arc / Volume Methods
  { regex: /api\.deleteArc\([^,]+,\s*([^)]+)\)/g, replace: "api.deleteArc($1)" },
  { regex: /api\.deleteVolume\([^,]+,\s*([^)]+)\)/g, replace: "api.deleteVolume($1)" },
  { regex: /api\.updateArc\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, replace: "api.updateArc($1, $2, $3, null)" },

  // 5. Tags store methods (we'll manually fix tags.store.ts, but let's do useTagsManagerModal here)
  { regex: /api\.saveTag\([^,]+,\s*([^)]+)\)/g, replace: "api.saveEntity($1 as any)" },
  { regex: /api\.deleteTag\([^,]+,\s*([^)]+)\)/g, replace: "api.deleteEntity($1)" },
  
  // 6. Photo
  { regex: /api\.uploadPhoto\(([^)]+)\)/g, replace: "api.uploadPhoto(Array.from(new Uint8Array(await $1.arrayBuffer())), $1.name)" },

  // 7. Connections Batch
  { regex: /batchApi\.upsertConnectionsBatch\(([^,]+),\s*([^)]+)\)/g, replace: "batchApi.upsertConnectionsBatch($1, 'Unknown', 'Unknown', $2)" },

  // 8. exportOptions
  { regex: /api\.exportChapters\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/g, replace: "api.exportChapters($1, $2, $3)" },
];

walkDir(SRC_DIR, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // Apply basic regex fixes
  for (const fix of fixes) {
    content = content.replace(fix.regex, fix.replace);
  }

  // Shell.ts specific hacks (removed imports)
  if (filePath.endsWith('shell.ts')) {
    content = content.replace(/import\s*\{\s*connectionsManager\s*\}\s*from\s*['"][^'"]+['"];?/g, '');
    content = content.replace(/import\s*\(\s*['"][^'"]+relationship-save.service['"]\s*\)/g, 'Promise.resolve({ prepareEntityForSave: (d: any) => d, processForeignRelationships: (a: any, b: any) => [] })');
  }

  // useEntityHelpers.ts local photo url hack
  if (filePath.endsWith('useEntityHelpers.ts')) {
    content = content.replace(/api\.getLocalPhotoUrl\(path\)\.then\(url\s*=>\s*\{/g, 'Promise.resolve(path).then(url => {'); // just stub it for now
  }
  
  // tags.store.ts
  if (filePath.endsWith('tags.store.ts')) {
     content = content.replace(/await api\.getTags\(project\.value\)/g, "await api.getEntities(project.value, 'tag') as any");
  }
  
  // usePlanningPanel.ts (Plans)
  if (filePath.endsWith('usePlanningPanel.ts')) {
     content = content.replace(/api\.getPlanItems\([^,]+,\s*([^,]+),\s*([^)]+)\)/g, "api.getPlans(props.project).then(plans => plans.filter(p => p.parent_type === $1 && p.parent_ref === $2))");
     content = content.replace(/api\.savePlanItem\([^,]+,\s*([^)]+)\)/g, "api.savePlan({ project_id: props.project, parent_type: props.parentType, parent_ref: props.parentId, title: $1.text, completed: $1.done, sort_order: $1.sort_order } as any).then(res => res.id)");
     content = content.replace(/api\.deletePlanItem\([^,]+,\s*([^)]+)\)/g, "api.deletePlan($1)");
     content = content.replace(/api\.togglePlanItem\([^,]+,\s*([^)]+)\)/g, "api.getPlans(props.project).then(async plans => { const p = plans.find(x => x.id === $1); if (p) { p.completed = !p.completed; await api.savePlan(p); } })");
  }
  
  // EditorCoreTiptap
  if (filePath.endsWith('useTiptapEditor.ts')) {
      content = content.replace(/entity\._type/g, "entity.entity_type");
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Patched: ${path.basename(filePath)}`);
  }
});
