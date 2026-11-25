import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SCHEMAS_DIRS = [
  path.join(ROOT_DIR, 'apps', 'spa', 'public', 'struct', 'editor'),
  path.join(ROOT_DIR, 'apps', 'spa', 'src', 'ts', 'struct', 'editor'),
];

const SCHEMA_FILES = [
  'character.json',
  'location.json',
  'organization.json',
  'state.json',
  'item.json',
  'event.json',
];

const uiEditor = JSON.parse(
  fs.readFileSync(path.join(SCHEMAS_DIRS[0], 'ui_editor.json'), 'utf8')
);
const UI_TEMPLATES = uiEditor.templates || {};

function buildOverridesFromOldFields(baseFields, oldFields, existingOverrides = {}) {
  const overrides = { ...existingOverrides };
  const oldByClass = new Map();
  for (const f of oldFields || []) {
    if (f.class) oldByClass.set(f.class, f);
  }

  for (const bf of baseFields || []) {
    const cls = bf.class;
    if (!cls) continue;
    const match = oldByClass.get(cls);
    if (match) {
      const ov = { ...(overrides[cls] || {}) };
      if (match.label && match.label !== bf.label) ov.label = match.label;
      if (match.placeholder && match.placeholder !== bf.placeholder) ov.placeholder = match.placeholder;
      if (match.type && match.type !== bf.type) ov.type = match.type;
      if (match.options) ov.options = match.options;
      if (match.entityType) ov.entityType = match.entityType;
      if (match.entityTypes) ov.entityTypes = match.entityTypes;
      if (Object.keys(ov).length > 0) overrides[cls] = ov;
    } else if (!overrides[cls] && !['начальная_глава', 'конечная_глава', 'начальная_дата', 'конечная_дата'].includes(cls)) {
      overrides[cls] = { hidden: true };
    }
  }
  return overrides;
}

function migrateContainer(container, localTemplates) {
  const tplName = container.template;
  if (!tplName || UI_TEMPLATES[tplName]) {
    return container;
  }

  const oldTpl = localTemplates?.[tplName];
  if (!oldTpl) {
    console.warn(`  [WARN] Template "${tplName}" not found in ui_editor.json or local templates`);
    return container;
  }

  const next = { ...container };

  if (oldTpl.isBidirectional) {
    next.template = 'Двунаправленная связь';
    const overrides = { ...(next.fieldOverrides || {}) };
    const oldFields = oldTpl.fields || [];
    const linkClass = oldTpl.bidirectionalLinkClass || oldFields.find((f) => f.entityType)?.class;
    const linkField = oldFields.find((f) => f.class === linkClass) || oldFields.find((f) => f.entityType);
    if (linkField) {
      overrides['целевая_сущность'] = {
        ...(overrides['целевая_сущность'] || {}),
        ...(linkField.label ? { label: linkField.label } : {}),
        ...(linkField.placeholder ? { placeholder: linkField.placeholder } : {}),
        ...(linkField.entityType ? { entityType: linkField.entityType } : {}),
      };
      if (linkField.entityType && !next.foreign_type) {
        next.foreign_type = linkField.entityType;
      }
    }

    const typeField = oldFields.find((f) => f.class !== linkField?.class && f.type === 'select');
    if (typeField) {
      overrides['тип_отношения'] = {
        ...(overrides['тип_отношения'] || {}),
        ...(typeField.label ? { label: typeField.label } : {}),
        ...(typeField.placeholder ? { placeholder: typeField.placeholder } : {}),
        ...(typeField.options ? { options: typeField.options } : {}),
      };
    }

    if (Object.keys(overrides).length > 0) {
      next.fieldOverrides = overrides;
    }
    return next;
  }

  const targetTplName = oldTpl.type === 'timeline' ? 'Базовая хронология' : 'Динамический элемент';
  next.template = targetTplName;
  const baseTpl = UI_TEMPLATES[targetTplName];
  const overrides = buildOverridesFromOldFields(baseTpl?.fields || [], oldTpl.fields || [], next.fieldOverrides || {});
  if (Object.keys(overrides).length > 0) {
    next.fieldOverrides = overrides;
  }
  return next;
}

for (const fileName of SCHEMA_FILES) {
  const srcPath = path.join(SCHEMAS_DIRS[0], fileName);
  if (!fs.existsSync(srcPath)) continue;

  const schema = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const localTemplates = schema.templates || {};
  let migratedCount = 0;

  for (const section of schema.sections || []) {
    if (Array.isArray(section.dynamicContainers)) {
      section.dynamicContainers = section.dynamicContainers.map((c) => {
        const before = c.template;
        const after = migrateContainer(c, localTemplates);
        if (before !== after.template) migratedCount++;
        return after;
      });
    }
  }

  delete schema.templates;

  const serialized = JSON.stringify(schema, null, 2) + '\n';
  for (const dir of SCHEMAS_DIRS) {
    if (fs.existsSync(dir)) {
      fs.writeFileSync(path.join(dir, fileName), serialized, 'utf8');
    }
  }
  console.log(`✅ ${fileName}: migrated ${migratedCount} container(s) to ui_editor.json templates`);
}
