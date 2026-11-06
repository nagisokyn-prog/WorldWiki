#!/usr/bin/env node
/**
 * @file scripts/reorganize_components.mjs
 * @description Скрипт автоматической реорганизации папок components/ во фронтенде (Vue 3 / FSD).
 *
 * Выполняет:
 * 1. Находит все распакованные .vue файлы прямо в папках `components/` фич.
 * 2. Переносит каждый `ComponentName.vue` в персональную подпапку `ComponentName/ComponentName.vue`.
 * 3. Переносит существующие сопутствующие файлы (`useComponentName.ts`, `ComponentName.model.ts`, `ComponentName.spec.ts`), если они лежали рядом.
 * 4. Генерирует недостающие сопутствующие файлы по 4-компонентной схеме:
 *    - `useComponentName.ts`
 *    - `ComponentName.model.ts`
 *    - `ComponentName.spec.ts`
 * 5. Корректирует относительные импорты в перемещенных файлах:
 *    - Пути `../` увеличиваются на один уровень `../../` (так как файл стал на 1 уровень глубже).
 *    - Импорты соседних компонентов `./OtherComp.vue` становятся `../OtherComp/OtherComp.vue`.
 *    - Собственные сопутствующие файлы `./useComp` и `./Comp.model` остаются `./useComp` и `./Comp.model`.
 * 6. Обновляет импорты во всех внешних файлах проекта, указывавших на старые пути.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SPA_ROOT = path.join(ROOT, 'apps', 'spa', 'src', 'ts');
const FEATURES_ROOT = path.join(SPA_ROOT, 'features');

const isDryRun = process.argv.includes('--dry-run');

function getFilesRecursively(dir, predicate = () => true) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      results.push(...getFilesRecursively(fullPath, predicate));
    } else if (predicate(fullPath, entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

function findComponentsDirs(featureDir) {
  const compDirs = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const full = path.join(dir, entry.name);
        if (entry.name === 'components') {
          compDirs.push(full);
        }
        walk(full);
      }
    }
  }
  walk(featureDir);
  return compDirs;
}

function reorganize() {
  console.log('\n================================================================');
  console.log(`🚀 WORLDWIKI: РЕОРГАНИЗАЦИЯ ПАПОК COMPONENTS ${isDryRun ? '(DRY-RUN)' : ''}`);
  console.log('================================================================\n');

  const featureDirs = fs
    .readdirSync(FEATURES_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'ai')
    .map((e) => path.join(FEATURES_ROOT, e.name));

  const moves = []; // { from, to, type: 'move' | 'create', content? }
  const movedComponents = []; // { name, oldDir, newDir }
  const movedFilesSet = new Set(); // full paths of files being moved into a subfolder

  for (const fDir of featureDirs) {
    const compDirs = findComponentsDirs(fDir);

    for (const compDir of compDirs) {
      const entries = fs.readdirSync(compDir, { withFileTypes: true });
      const directFiles = entries.filter((e) => !e.isDirectory()).map((e) => e.name);
      const vueFiles = directFiles.filter((f) => f.endsWith('.vue'));

      for (const vueFile of vueFiles) {
        const baseName = vueFile.replace(/\.vue$/, '');
        const targetSubDir = path.join(compDir, baseName);
        const oldVuePath = path.join(compDir, vueFile);
        const newVuePath = path.join(targetSubDir, vueFile);

        movedComponents.push({
          name: baseName,
          oldDir: compDir,
          newDir: targetSubDir,
          oldVuePath,
          newVuePath,
        });

        // 1. Перемещение самого Component.vue
        moves.push({
          type: 'move',
          from: oldVuePath,
          to: newVuePath,
          componentName: baseName,
        });
        movedFilesSet.add(oldVuePath);

        // 2. Проверка сопутствующих файлов в compDir
        const possibleCompanions = [
          `use${baseName}.ts`,
          `use${baseName}.js`,
          `${baseName}.model.ts`,
          `${baseName}.types.ts`,
          `${baseName}.spec.ts`,
          `use${baseName}.spec.ts`,
        ];

        let hasHook = false;
        let hasModel = false;
        let hasSpec = false;

        for (const companion of possibleCompanions) {
          const compPath = path.join(compDir, companion);
          if (fs.existsSync(compPath)) {
            const destPath = path.join(targetSubDir, companion);
            moves.push({
              type: 'move',
              from: compPath,
              to: destPath,
              componentName: baseName,
            });
            movedFilesSet.add(compPath);
            if (companion.startsWith('use') && !companion.endsWith('.spec.ts')) hasHook = true;
            if (companion.endsWith('.model.ts') || companion.endsWith('.types.ts')) hasModel = true;
            if (companion.endsWith('.spec.ts')) hasSpec = true;
          }
        }

        // 3. Создание недостающих файлов по 4-компонентной схеме
        if (!hasHook) {
          const hookContent = `export function use${baseName}() {\n  return {};\n}\n`;
          moves.push({
            type: 'create',
            to: path.join(targetSubDir, `use${baseName}.ts`),
            content: hookContent,
            componentName: baseName,
          });
        }

        if (!hasModel) {
          const modelContent = `export interface ${baseName}Props {}\nexport type ${baseName}Emits = {};\n`;
          moves.push({
            type: 'create',
            to: path.join(targetSubDir, `${baseName}.model.ts`),
            content: modelContent,
            componentName: baseName,
          });
        }

        if (!hasSpec) {
          const specContent = `import { describe, it, expect } from 'vitest';
import { use${baseName} } from './use${baseName}';

describe('use${baseName}', () => {
  it('initializes correctly', () => {
    const hook = use${baseName}();
    expect(hook).toBeDefined();
  });
});
`;
          moves.push({
            type: 'create',
            to: path.join(targetSubDir, `${baseName}.spec.ts`),
            content: specContent,
            componentName: baseName,
          });
        }
      }
    }
  }

  console.log(`📦 Найдено ${movedComponents.length} компонентов для упаковки в капсулы.`);
  console.log(`📝 Всего файловых операций: ${moves.length}`);

  if (isDryRun) {
    console.log('\n[DRY RUN] Список планируемых операций:');
    for (const m of moves) {
      const relTo = path.relative(SPA_ROOT, m.to).replace(/\\/g, '/');
      if (m.type === 'move') {
        const relFrom = path.relative(SPA_ROOT, m.from).replace(/\\/g, '/');
        console.log(`  [MOVE] ${relFrom} -> ${relTo}`);
      } else {
        console.log(`  [CREATE] ${relTo}`);
      }
    }
    return;
  }

  // Быстрая карта всех перемещаемых компонентов по имени
  const componentNamesMap = new Map();
  for (const c of movedComponents) {
    componentNamesMap.set(c.name, c);
  }

  // Применяем файловые операции
  for (const m of moves) {
    const targetDir = path.dirname(m.to);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    if (m.type === 'move') {
      let content = fs.readFileSync(m.from, 'utf-8');

      // Если файл перемещается на один уровень глубже (в targetSubDir):
      // 1) Относительные пути наверх '../' должны стать '../../'
      content = content.replace(/(from\s+['"]|import\s+['"]|import\(['"])(\.\.\/[^'"]+)(['"])/g, (match, prefix, p, suffix) => {
        return `${prefix}../${p}${suffix}`;
      });

      // 2) Импорты соседних компонентов, которые тоже перемещаются:
      // Например: './OtherComponent.vue' -> '../OtherComponent/OtherComponent.vue'
      // Но не собственный компонент и не собственные сопутствующие файлы!
      const currentCompName = m.componentName;
      for (const [otherName] of componentNamesMap) {
        if (otherName !== currentCompName) {
          // ./OtherName.vue -> ../OtherName/OtherName.vue
          const otherVueRegex = new RegExp(`(['"])\\./${otherName}\\.vue(['"])`, 'g');
          content = content.replace(otherVueRegex, `$1../${otherName}/${otherName}.vue$2`);

          const otherHookRegex = new RegExp(`(['"])\\./use${otherName}(['"])`, 'g');
          content = content.replace(otherHookRegex, `$1../${otherName}/use${otherName}$2`);

          const otherModelRegex = new RegExp(`(['"])\\./${otherName}\\.model(['"])`, 'g');
          content = content.replace(otherModelRegex, `$1../${otherName}/${otherName}.model$2`);
        }
      }

      fs.writeFileSync(m.to, content, 'utf-8');
      fs.unlinkSync(m.from);
    } else if (m.type === 'create') {
      if (!fs.existsSync(m.to)) {
        fs.writeFileSync(m.to, m.content, 'utf-8');
      }
    }
  }
  console.log('✅ Файловые операции успешно применены.');

  // Обновление импортов во всех остальных файлах
  console.log('\n⏳ Обновляю пути импортов во всех исходных файлах...');
  const allSourceFiles = getFilesRecursively(SPA_ROOT, (p) => /\.(ts|vue|js)$/.test(p));
  let updatedFilesCount = 0;

  for (const srcFile of allSourceFiles) {
    let content = fs.readFileSync(srcFile, 'utf-8');
    const original = content;

    for (const comp of movedComponents) {
      const { name } = comp;

      const fileDir = path.dirname(srcFile);
      const isInsideThisComponentDir = fileDir.endsWith(path.sep + name) || fileDir.endsWith('/' + name);

      if (!isInsideThisComponentDir) {
        // Заменяем импорты вида:
        // /Name.vue' -> /Name/Name.vue'
        // ./Name.vue' -> ./Name/Name.vue'
        // с защитой от повторной замены (?<!/Name)
        const vueImportRegex = new RegExp(`(?<!\/${name})\/${name}\\.vue(?=['"])`, 'g');
        content = content.replace(vueImportRegex, `/${name}/${name}.vue`);

        const relVueRegex = new RegExp(`(?<!\/${name})\\./${name}\\.vue(?=['"])`, 'g');
        content = content.replace(relVueRegex, `./${name}/${name}.vue`);

        // Сопутствующие файлы: useName.ts, Name.model
        const hookRegex = new RegExp(`(?<!\/${name})\/(use${name})(?=['"])`, 'g');
        content = content.replace(hookRegex, `/${name}/$1`);

        const relHookRegex = new RegExp(`(?<!\/${name})\\./(use${name})(?=['"])`, 'g');
        content = content.replace(relHookRegex, `./${name}/$1`);

        const modelRegex = new RegExp(`(?<!\/${name})\/(${name}\\.model)(?=['"])`, 'g');
        content = content.replace(modelRegex, `/${name}/$1`);

        const relModelRegex = new RegExp(`(?<!\/${name})\\./(${name}\\.model)(?=['"])`, 'g');
        content = content.replace(relModelRegex, `./${name}/$1`);
      }
    }

    if (content !== original) {
      fs.writeFileSync(srcFile, content, 'utf-8');
      updatedFilesCount++;
    }
  }

  console.log(`✅ Обновлено файлов с импортами: ${updatedFilesCount}`);
  console.log('\n🎉 Реорганизация завершена!');
}

reorganize();
