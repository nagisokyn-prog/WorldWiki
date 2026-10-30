/**
 * scripts/remediate_models.mjs
 *
 * Автоматизированный скрипт для устранения архитектурных нарушений Cerberus:
 * 1. VUE-004: создание недостающих companion-контрактов [Component].model.ts
 * 2. VUE-003: вынос inline defineProps<{ ... }>() и defineEmits<{ ... }>() в [Component].model.ts
 *
 * Запуск:
 *   node scripts/remediate_models.mjs [--dry-run] [--apply]
 */

import fs from 'node:fs';
import path from 'node:path';

const isApply = process.argv.includes('--apply');
const isDryRun = !isApply;

console.log(`[RemediateModels] Режим: ${isApply ? 'APPLY (запись изменений)' : 'DRY-RUN (только симуляция)'}`);

const baselinePath = path.resolve('cerberus-baseline.json');
if (!fs.existsSync(baselinePath)) {
  console.error(`[Error] Файл ${baselinePath} не найден!`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

// 1. Собираем уникальные компоненты из baseline
const vue004Violations = baseline.filter(item => item.rule === 'VUE-004');
const vue003Violations = baseline.filter(item => item.rule === 'VUE-003');

console.log(`[RemediateModels] Найдено нарушений VUE-004: ${vue004Violations.length}`);
console.log(`[RemediateModels] Найдено нарушений VUE-003: ${vue003Violations.length}`);

/**
 * Парсер сбалансированных скобок с учетом строковых литералов и комментариев
 */
function findMatchingDelimiter(str, startIndex, openChar = '{', closeChar = '}') {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];
    const prev = i > 0 ? str[i - 1] : '';
    const next = i + 1 < str.length ? str[i + 1] : '';

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (prev === '*' && char === '/') inBlockComment = false;
      continue;
    }
    if (inString) {
      if (char === stringChar && prev !== '\\') inString = false;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === openChar) {
      depth++;
    } else if (char === closeChar) {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Извлекает все внешние импорты из блока script
 */
function parseScriptImports(scriptContent) {
  const imports = [];
  const importRegex = /import\s+(?:type\s+)?(?:(\{[^}]+\})|([a-zA-Z0-9_$]+))\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(scriptContent)) !== null) {
    const fullStatement = match[0];
    const namedGroup = match[1];
    const defaultGroup = match[2];
    const fromPath = match[3];

    const symbols = [];
    if (namedGroup) {
      const cleaned = namedGroup.replace(/[{}]/g, '');
      for (const rawSym of cleaned.split(',')) {
        const item = rawSym.trim();
        if (!item) continue;
        const parts = item.split(/\s+as\s+/);
        symbols.push(parts[parts.length - 1].trim());
      }
    } else if (defaultGroup) {
      symbols.push(defaultGroup.trim());
    }

    imports.push({
      statement: fullStatement,
      symbols,
      fromPath
    });
  }
  return imports;
}

/**
 * Находит импорты, которые используются в заданном TS коде
 */
function getRequiredImports(code, allImports) {
  const neededStatements = [];
  for (const imp of allImports) {
    for (const sym of imp.symbols) {
      // Проверяем, встречается ли символ как отдельное слово в коде
      const symRegex = new RegExp(`\\b${sym}\\b`);
      if (symRegex.test(code)) {
        if (!neededStatements.includes(imp.statement)) {
          neededStatements.push(imp.statement);
        }
        break;
      }
    }
  }
  return neededStatements;
}

// ==========================================
// ШАГ 1: Обработка VUE-004
// ==========================================
console.log('\n--- Обработка VUE-004 (Создание [Component].model.ts) ---');

const processedModelFiles = new Set();

for (const violation of vue004Violations) {
  const filePath = path.resolve(violation.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`[VUE-004] Файл не найден: ${filePath}`);
    continue;
  }

  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, '.vue');
  const modelPath = path.join(dir, `${baseName}.model.ts`);

  if (fs.existsSync(modelPath)) {
    continue; // Уже существует
  }

  if (processedModelFiles.has(modelPath)) {
    continue;
  }
  processedModelFiles.add(modelPath);

  const vueContent = fs.readFileSync(filePath, 'utf8');
  const compName = baseName;

  // Проверяем, есть ли уже ссылки на [Component]Props в хуке или импортах
  const hookPath = path.join(dir, `use${baseName}.ts`);
  let modelContent = '';

  if (fs.existsSync(hookPath)) {
    const hookContent = fs.readFileSync(hookPath, 'utf8');
    const hasPropsInHook = hookContent.includes(`${compName}Props`);
    const hasEmitsInHook = hookContent.includes(`${compName}Emits`);

    if (hasPropsInHook || hasEmitsInHook) {
      const exports = [];
      if (hasPropsInHook) exports.push(`${compName}Props`);
      if (hasEmitsInHook) exports.push(`${compName}Emits`);
      modelContent = `export type { ${exports.join(', ')} } from './use${compName}';\n`;
    }
  }

  if (!modelContent) {
    modelContent = `export interface ${compName}Props {}\nexport type ${compName}Emits = {};\n`;
  }

  console.log(`[VUE-004] Создание контракта: ${path.relative(process.cwd(), modelPath)}`);
  if (isApply) {
    fs.writeFileSync(modelPath, modelContent, 'utf8');
  }
}

// ==========================================
// ШАГ 2: Обработка VUE-003
// ==========================================
console.log('\n--- Обработка VUE-003 (Вынос inline типов defineProps/defineEmits) ---');

// Группируем нарушения VUE-003 по файлам
const vue003ByFile = new Map();
for (const violation of vue003Violations) {
  const filePath = path.resolve(violation.file);
  if (!vue003ByFile.has(filePath)) {
    vue003ByFile.set(filePath, []);
  }
  vue003ByFile.get(filePath).push(violation);
}

let updatedSfcCount = 0;
let createdModelsCount = 0;

for (const [filePath, violations] of vue003ByFile.entries()) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[VUE-003] Файл не найден: ${filePath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, '.vue');
  const compName = baseName;
  const modelPath = path.join(dir, `${baseName}.model.ts`);

  const scriptSetupMatch = content.match(/<script\s+setup(?: lang="ts")?>([\s\S]*?)<\/script>/);
  if (!scriptSetupMatch) {
    continue;
  }

  const scriptContent = scriptSetupMatch[1];
  const allImports = parseScriptImports(scriptContent);

  let propsTypeBody = null;
  let emitsTypeBody = null;
  let newScript = scriptContent;

  // 1. Поиск defineProps<{ ... }>()
  const definePropsIdx = newScript.indexOf('defineProps<{');
  if (definePropsIdx !== -1) {
    const openBraceIdx = newScript.indexOf('{', definePropsIdx + 'defineProps<'.length);
    const closeBraceIdx = findMatchingDelimiter(newScript, openBraceIdx, '{', '}');
    if (closeBraceIdx !== -1) {
      propsTypeBody = newScript.slice(openBraceIdx + 1, closeBraceIdx).trim();
      const endCallIdx = newScript.indexOf('>', closeBraceIdx);
      const fullCall = newScript.slice(definePropsIdx, endCallIdx !== -1 ? endCallIdx + 1 : closeBraceIdx + 1);
      newScript = newScript.replace(fullCall, `defineProps<${compName}Props>`);
    }
  }

  // 2. Поиск defineEmits<{ ... }>()
  const defineEmitsIdx = newScript.indexOf('defineEmits<{');
  if (defineEmitsIdx !== -1) {
    const openBraceIdx = newScript.indexOf('{', defineEmitsIdx + 'defineEmits<'.length);
    const closeBraceIdx = findMatchingDelimiter(newScript, openBraceIdx, '{', '}');
    if (closeBraceIdx !== -1) {
      emitsTypeBody = newScript.slice(openBraceIdx + 1, closeBraceIdx).trim();
      const endCallIdx = newScript.indexOf('>', closeBraceIdx);
      const fullCall = newScript.slice(defineEmitsIdx, endCallIdx !== -1 ? endCallIdx + 1 : closeBraceIdx + 1);
      newScript = newScript.replace(fullCall, `defineEmits<${compName}Emits>`);
    }
  }

  // Если ничего не найдено через inline литералы, проверим локальный interface Props/Emits
  if (!propsTypeBody) {
    const ifacePropsMatch = newScript.match(/interface\s+Props\s*\{/);
    if (ifacePropsMatch) {
      const openIdx = newScript.indexOf('{', ifacePropsMatch.index);
      const closeIdx = findMatchingDelimiter(newScript, openIdx, '{', '}');
      if (closeIdx !== -1) {
        propsTypeBody = newScript.slice(openIdx + 1, closeIdx).trim();
        // Удаляем interface Props { ... } из script
        newScript = newScript.slice(0, ifacePropsMatch.index) + newScript.slice(closeIdx + 1);
        newScript = newScript.replace(/defineProps<Props>\s*\(\)/, `defineProps<${compName}Props>()`);
      }
    }
  }

  if (!emitsTypeBody) {
    const ifaceEmitsMatch = newScript.match(/(?:interface|type)\s+Emits\s*(?:=\s*)?\{/);
    if (ifaceEmitsMatch) {
      const openIdx = newScript.indexOf('{', ifaceEmitsMatch.index);
      const closeIdx = findMatchingDelimiter(newScript, openIdx, '{', '}');
      if (closeIdx !== -1) {
        emitsTypeBody = newScript.slice(openIdx + 1, closeIdx).trim();
        newScript = newScript.slice(0, ifaceEmitsMatch.index) + newScript.slice(closeIdx + 1);
        newScript = newScript.replace(/defineEmits<Emits>\s*\(\)/, `defineEmits<${compName}Emits>()`);
      }
    }
  }

  if (!propsTypeBody && !emitsTypeBody) {
    continue; // Нет явных inline пропсов/эмитов в простом формате
  }

  // Формируем контент для [Component].model.ts
  const allNeededImports = [
    ...getRequiredImports(propsTypeBody || '', allImports),
    ...getRequiredImports(emitsTypeBody || '', allImports)
  ];
  const uniqueImports = [...new Set(allNeededImports)];

  let modelCode = '';
  if (uniqueImports.length > 0) {
    modelCode += uniqueImports.join('\n') + '\n\n';
  }

  if (propsTypeBody) {
    modelCode += `export interface ${compName}Props {\n  ${propsTypeBody.split('\n').join('\n  ')}\n}\n\n`;
  } else {
    modelCode += `export interface ${compName}Props {}\n\n`;
  }

  if (emitsTypeBody) {
    modelCode += `export type ${compName}Emits = {\n  ${emitsTypeBody.split('\n').join('\n  ')}\n};\n`;
  } else {
    modelCode += `export type ${compName}Emits = {};\n`;
  }

  // Добавляем импорт в .vue
  const modelImport = `import type { ${compName}Props, ${compName}Emits } from './${compName}.model';`;
  if (!newScript.includes(modelImport)) {
    newScript = `\n${modelImport}\n` + newScript.trimStart();
  }

  // Обновляем .vue файл
  const updatedVueContent = content.replace(scriptContent, newScript);

  console.log(`[VUE-003] Вынос контрактов: ${path.relative(process.cwd(), filePath)} -> ${compName}.model.ts`);

  if (isApply) {
    fs.writeFileSync(modelPath, modelCode, 'utf8');
    fs.writeFileSync(filePath, updatedVueContent, 'utf8');
  }

  updatedSfcCount++;
  createdModelsCount++;
}

console.log('\n=========================================');
console.log(`[RemediateModels] ИТОГИ:`);
console.log(`  Создано/запланировано моделей: ${createdModelsCount + processedModelFiles.size}`);
console.log(`  Обновлено/запланировано Vue SFC: ${updatedSfcCount}`);
console.log('=========================================\n');
if (isDryRun) {
  console.log('Для применения изменений запустите: node scripts/remediate_models.mjs --apply');
}

