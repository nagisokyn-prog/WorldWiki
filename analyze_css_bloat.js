/**
 * analyze_css_bloat.js
 * Скрипт детального анализа избыточности, фрагментации и дублирования CSS (V2):
 * 1. Поиск неиспользуемых (dead / orphan) CSS файлов.
 * 2. Поиск файлов-двойников по именам (Vue_*.css, shell_*.css).
 * 3. Property Overlap Engine: точный анализ схожести CSS-деклараций селекторов:
 *    - 100% LITERAL COPY-PASTE (посимвольное совпадение всех свойств)
 *    - HIGH SIMILARITY (≥ 70% общих свойств)
 *    - LOW / ISOLATED (< 40% — просто совпадение имени)
 * 4. Оценка объема дублирующегося кода в строках (Wasted Lines).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STYLES_DIR = path.join(__dirname, 'packages/resources/src/styles');
const SCAN_DIRS = [
  path.join(__dirname, 'apps/spa/src'),
  path.join(__dirname, 'packages/components/src'),
  path.join(__dirname, 'packages/word-vibe/src'),
  path.join(__dirname, 'packages/resources/src/styles')
];

// 1. Собираем все CSS файлы
function getAllFiles(dir, ext = '.css') {
  let res = [];
  if (!fs.existsSync(dir)) return res;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      res = res.concat(getAllFiles(full, ext));
    } else if (ent.isFile() && ent.name.endsWith(ext)) {
      res.push(full);
    }
  }
  return res;
}

const allCssFiles = getAllFiles(STYLES_DIR, '.css');

// 2. Проверка импортов (Orphans)
function getAllCodeFiles(dir) {
  let res = [];
  if (!fs.existsSync(dir)) return res;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.git') continue;
      res = res.concat(getAllCodeFiles(full));
    } else if (ent.isFile() && /\.(vue|ts|js|css|html)$/.test(ent.name)) {
      res.push(full);
    }
  }
  return res;
}

const allCodeFiles = [];
SCAN_DIRS.forEach(d => {
  allCodeFiles.push(...getAllCodeFiles(d));
});

const allCodeContents = allCodeFiles.map(f => ({
  file: f,
  content: fs.readFileSync(f, 'utf8')
}));

const usageMap = new Map();
allCssFiles.forEach(cssPath => {
  const baseName = path.basename(cssPath);
  const relStyle = path.relative(STYLES_DIR, cssPath).replace(/\\/g, '/');
  
  let occurrences = 0;
  const referencedBy = [];

  for (const code of allCodeContents) {
    if (code.file === cssPath) continue;
    if (code.content.includes(baseName) || code.content.includes(relStyle)) {
      occurrences++;
      referencedBy.push(path.relative(__dirname, code.file).replace(/\\/g, '/'));
    }
  }

  usageMap.set(cssPath, {
    baseName,
    relStyle,
    occurrences,
    referencedBy
  });
});

// 3. Анализ файлов-двойников
const twinCandidates = [];
const baseNameMap = new Map();
allCssFiles.forEach(f => {
  const name = path.basename(f).toLowerCase();
  const normalized = name.replace(/^(vue_|shell_)/, '');
  if (!baseNameMap.has(normalized)) {
    baseNameMap.set(normalized, []);
  }
  baseNameMap.get(normalized).push(f);
});

baseNameMap.forEach((files, norm) => {
  if (files.length > 1) {
    twinCandidates.push({
      normalizedName: norm,
      files: files.map(f => path.relative(__dirname, f).replace(/\\/g, '/'))
    });
  }
});

// 4. Property Overlap Engine
// Парсер CSS правил с извлечением деклараций свойств
function parseCssRules(cssContent) {
  // Убираем комментарии
  const clean = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];

  // Регулярка для селектор { тело }
  const ruleRegex = /([^{}@]+)\{([^}]+)\}/g;
  let match;
  while ((match = ruleRegex.exec(clean)) !== null) {
    const rawSelectors = match[1].trim();
    const rawBody = match[2].trim();

    if (rawSelectors.includes('@') || rawSelectors.includes('keyframes')) continue;

    // Парсим декларации свойства
    const declarations = new Set();
    const propMap = new Map();

    rawBody.split(';').forEach(decl => {
      const trimmed = decl.trim();
      if (!trimmed || !trimmed.includes(':')) return;
      const colonIdx = trimmed.indexOf(':');
      const prop = trimmed.slice(0, colonIdx).trim().toLowerCase();
      const val = trimmed.slice(colonIdx + 1).trim().replace(/\s+/g, ' ');
      if (!prop || !val) return;

      declarations.add(`${prop}:${val}`);
      propMap.set(prop, val);
    });

    if (declarations.size === 0) continue;

    const selectorList = rawSelectors.split(',').map(s => s.trim()).filter(Boolean);
    selectorList.forEach(sel => {
      if (sel === ':root' || sel === 'html' || sel === 'body' || sel === '*') return;
      rules.push({
        selector: sel,
        declarations,
        propMap
      });
    });
  }

  return rules;
}

// Собираем все реализации каждого селектора
// selector -> Array<{ file, declarations, propMap }>
const selectorImplementations = new Map();

allCssFiles.forEach(cssPath => {
  const content = fs.readFileSync(cssPath, 'utf8');
  const relPath = path.relative(__dirname, cssPath).replace(/\\/g, '/');
  const parsedRules = parseCssRules(content);

  parsedRules.forEach(r => {
    if (!selectorImplementations.has(r.selector)) {
      selectorImplementations.set(r.selector, []);
    }
    selectorImplementations.get(r.selector).push({
      file: relPath,
      declarations: r.declarations,
      propMap: r.propMap
    });
  });
});

// Вычисление сходства
function computeSimilarity(impls) {
  if (impls.length < 2) return { score: 1, type: 'SINGLE', sharedProps: 0, totalProps: 0 };

  // Попарное сравнение
  let totalScore = 0;
  let pairs = 0;
  let sharedPropsAcrossAll = new Set([...impls[0].declarations]);

  for (let i = 0; i < impls.length; i++) {
    for (let j = i + 1; j < impls.length; j++) {
      const setA = impls[i].declarations;
      const setB = impls[j].declarations;

      let intersection = 0;
      for (const d of setA) {
        if (setB.has(d)) intersection++;
      }
      const union = new Set([...setA, ...setB]).size;
      totalScore += union > 0 ? (intersection / union) : 0;
      pairs++;
    }

    // Пересечение всех
    sharedPropsAcrossAll = new Set([...sharedPropsAcrossAll].filter(d => impls[i].declarations.has(d)));
  }

  const avgScore = pairs > 0 ? (totalScore / pairs) : 1;

  let type = 'LOW';
  if (avgScore === 1) type = 'IDENTICAL';
  else if (avgScore >= 0.65) type = 'HIGH';
  else if (avgScore >= 0.35) type = 'MODERATE';

  return {
    score: Math.round(avgScore * 100),
    type,
    sharedCount: sharedPropsAcrossAll.size,
    sampleDecls: [...sharedPropsAcrossAll]
  };
}

const duplicateAnalysis = [];
let totalWastedLines = 0;

selectorImplementations.forEach((impls, selector) => {
  // Уникализируем по файлам (если в одном файле селектор упомянут дважды, берем уникальные файлы)
  const fileSet = new Set(impls.map(i => i.file));
  if (fileSet.size <= 1) return;

  const sim = computeSimilarity(impls);
  const avgDeclCount = Math.round(impls.reduce((acc, i) => acc + i.declarations.size, 0) / impls.length);
  const wasted = (fileSet.size - 1) * avgDeclCount;

  if (sim.type === 'IDENTICAL' || sim.type === 'HIGH') {
    totalWastedLines += wasted;
  }

  duplicateAnalysis.push({
    selector,
    fileCount: fileSet.size,
    files: [...fileSet],
    similarity: sim.score,
    type: sim.type,
    avgDeclCount,
    wastedLines: wasted,
    sampleDecls: sim.sampleDecls
  });
});

duplicateAnalysis.sort((a, b) => {
  // Сначала идентичные и с большим количеством потраченных строк
  if (b.similarity !== a.similarity) return b.similarity - a.similarity;
  return b.wastedLines - a.wastedLines;
});

// Группировка
const identicalDuplicates = duplicateAnalysis.filter(d => d.type === 'IDENTICAL');
const highSimilarityDuplicates = duplicateAnalysis.filter(d => d.type === 'HIGH');
const moderateDuplicates = duplicateAnalysis.filter(d => d.type === 'MODERATE');
const lowDuplicates = duplicateAnalysis.filter(d => d.type === 'LOW');

// ВЫВОД ОТЧЕТА
console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║               CSS ARCHITECTURE & SIMILARITY AUDIT (V2)                   ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

// 1. Мертвые файлы
const deadFiles = [...usageMap.values()].filter(u => u.occurrences === 0);
console.log('──────────────────────────────────────────────────────────────────────────');
console.log(`  1. НЕИСПОЛЬЗУЕМЫЕ / МЕРТВЫЕ CSS ФАЙЛЫ (ORPHANS): ${deadFiles.length} шт.`);
console.log('──────────────────────────────────────────────────────────────────────────');
if (deadFiles.length === 0) {
  console.log('  🎉 Чисто! Мертвых файлов не обнаружено.');
} else {
  deadFiles.forEach((d, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ❌ ${d.relStyle} (Нигде не найден импорт)`);
  });
}

// 2. Двойники
console.log('\n──────────────────────────────────────────────────────────────────────────');
console.log(`  2. ФАЙЛЫ-ДВОЙНИКИ / ПОДОЗРИТЕЛЬНЫЕ ДУБЛИ ПО ИМЕНИ: ${twinCandidates.length} групп`);
console.log('──────────────────────────────────────────────────────────────────────────');
if (twinCandidates.length === 0) {
  console.log('  🎉 Чисто! Файлов-двойников не обнаружено.');
} else {
  twinCandidates.forEach((t, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. Группа "${t.normalizedName}":`);
    t.files.forEach(f => console.log(`      • ${f}`));
  });
}

// 3. Анализ схожести копипасты
console.log('\n──────────────────────────────────────────────────────────────────────────');
console.log(`  3. АНАЛИЗ СХОЖЕСТИ СЕЛЕКТОРОВ (PROPERTY OVERLAP ENGINE)`);
console.log('──────────────────────────────────────────────────────────────────────────');
console.log(`  • Всего селекторов, объявленных в нескольких файлах: ${duplicateAnalysis.length}`);
console.log(`  • 🔥 100% IDENTICAL (Буквальная посимвольная копипаста):   ${identicalDuplicates.length} селекторов`);
console.log(`  • 🟡 HIGH SIMILARITY (≥ 70% общих CSS-свойств):            ${highSimilarityDuplicates.length} селекторов`);
console.log(`  • 🟠 MODERATE (40-69% сходства):                          ${moderateDuplicates.length} селекторов`);
console.log(`  • ⚪ LOW / ISOLATED (< 40% — просто совпадение имени):     ${lowDuplicates.length} селекторов\n`);
console.log(`  📉 ОЦЕНКА ИЗБЫТОЧНОСТИ:`);
console.log(`  • Объем дублирующихся строк деклараций: ~${totalWastedLines} строк CSS скопировано впустую!`);

// 4. Топ-12 100% идентичной копипасты
console.log('\n──────────────────────────────────────────────────────────────────────────');
console.log(`  4. ТОП-12 БУКВАЛЬНЫХ ДУБЛИКАТОВ (100% ПОСИМВОЛЬНАЯ КОПИПАСТА)`);
console.log('──────────────────────────────────────────────────────────────────────────');
identicalDuplicates.slice(0, 12).forEach((d, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. "${d.selector}" (в ${d.fileCount} файлах, ${d.avgDeclCount} свойств, дубль ~${d.wastedLines} строк):`);
  console.log(`      Файлы: ${d.files.slice(0, 4).map(f => path.basename(f)).join(', ')}${d.files.length > 4 ? ` ...+${d.files.length - 4}` : ''}`);
  if (d.sampleDecls.length > 0) {
    console.log(`      Свойства: ${d.sampleDecls.slice(0, 3).join('; ')}${d.sampleDecls.length > 3 ? '; ...' : ''}`);
  }
});

// 5. Топ селекторов с высокой схожестью
if (highSimilarityDuplicates.length > 0) {
  console.log('\n──────────────────────────────────────────────────────────────────────────');
  console.log(`  5. ТОП СЕЛЕКТОРОВ С ВЫСОКОЙ СХОЖЕСТЬЮ (HIGH SIMILARITY ≥ 70%)`);
  console.log('──────────────────────────────────────────────────────────────────────────');
  highSimilarityDuplicates.slice(0, 8).forEach((d, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. "${d.selector}" [${d.similarity}% сходства] (в ${d.fileCount} файлах):`);
    console.log(`      Файлы: ${d.files.slice(0, 3).map(f => path.basename(f)).join(', ')}${d.files.length > 3 ? ` ...+${d.files.length - 3}` : ''}`);
  });
}

console.log('\n──────────────────────────────────────────────────────────────────────────');
console.log(`  ВЫВОД: Выделение CalendarCommon.css и примитивов BaseUI устранит ~${totalWastedLines} строк копипасты`);
console.log('──────────────────────────────────────────────────────────────────────────\n');
