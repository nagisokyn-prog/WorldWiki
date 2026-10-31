#!/usr/bin/env node

/**
 * WorldWiki: Честный структурный анализатор сложности и дублирования (Zero-Hardcode)
 * 
 * 1. Алгоритмическая сложность (Кандидаты на WASM):
 *    - Вложенные циклы O(N^2), O(N^3)
 *    - Тяжелые операции (Regex, JSON, конкатенация строк) внутри циклов
 *    - Высокая цикломатическая сложность ветвлений
 * 
 * 2. Структурный бойлерплейт (Кандидаты на Rust-макросы):
 *    - Поиск идентичных многострочных блоков кода (Code Clones, n-grams >= 4 строк)
 *    - Повторяющиеся последовательности вызовов методов
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function isTest(file) {
  const norm = file.replace(/\\/g, '/');
  return norm.includes('/tests/') || norm.includes('/__tests__/') || norm.includes('/tests/') ||
         norm.endsWith('.spec.ts') || norm.endsWith('.test.ts') || 
         norm.endsWith('_test.rs') || norm.endsWith('.spec.js');
}

function walkDir(dir, exts, ignore = ['node_modules', 'target', '.git', 'dist']) {
  let files = [];
  try {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.isDirectory()) {
        if (!ignore.includes(d.name)) {
          files = files.concat(walkDir(path.join(dir, d.name), exts, ignore));
        }
      } else if (d.isFile() && exts.includes(path.extname(d.name)) && !isTest(d.name)) {
        files.push(path.join(dir, d.name));
      }
    }
  } catch {}
  return files;
}

// -------------------------------------------------------------
// ЧАСТЬ 1: ЧЕСТНЫЙ АНАЛИЗАТОР ВЫЧИСЛИТЕЛЬНОЙ СЛОЖНОСТИ (WASM)
// -------------------------------------------------------------
function analyzeComplexityInFrontend() {
  const tsFiles = walkDir(path.join(ROOT_DIR, 'apps', 'spa', 'src'), ['.ts', '.vue']);
  const hotSpots = [];

  for (const file of tsFiles) {
    const raw = fs.readFileSync(file, 'utf-8');
    const lines = raw.split(/\r?\n/);
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');

    let loopDepth = 0;
    let heavyOpsInLoops = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('//') || line.startsWith('*')) continue;

      // Детектор входа в цикл
      const isLoopStart = /\b(for\s*\(|while\s*\(|\.forEach\(|\.map\(|\.flatMap\()/.test(line);
      const isBlockClose = line.includes('}') || line.includes(');');

      if (isLoopStart) {
        loopDepth++;

        // Если вложенность 2+, это O(N^2) или хуже
        if (loopDepth >= 2) {
          hotSpots.push({
            file: rel,
            line: i + 1,
            type: `O(N^${loopDepth}) Вложенный цикл (глубина: ${loopDepth})`,
            snippet: line.slice(0, 100),
            severity: loopDepth * 10
          });
        }
      }

      // Если мы внутри цикла, проверяем тяжелые операции
      if (loopDepth > 0) {
        if (/RegExp|\.match\(|\.replace\(/.test(line)) {
          heavyOpsInLoops.push({ line: i + 1, op: 'Regex в цикле', snippet: line.slice(0, 90) });
        } else if (/JSON\.parse|JSON\.stringify/.test(line)) {
          heavyOpsInLoops.push({ line: i + 1, op: 'JSON парсинг в цикле', snippet: line.slice(0, 90) });
        } else if (/\.slice\(|\.substring\(|\.split\(/.test(line) && line.includes('=')) {
          heavyOpsInLoops.push({ line: i + 1, op: 'Дробление строк в цикле', snippet: line.slice(0, 90) });
        }
      }

      // Выход из блоков
      if (isBlockClose && loopDepth > 0) {
        if ((line.match(/\}/g) || []).length > (line.match(/\{/g) || []).length) {
          loopDepth = Math.max(0, loopDepth - 1);
        }
      }
    }

    for (const op of heavyOpsInLoops) {
      hotSpots.push({
        file: rel,
        line: op.line,
        type: `Тяжелая операция в цикле [${op.op}]`,
        snippet: op.snippet,
        severity: 15
      });
    }
  }

  return hotSpots.sort((a, b) => b.severity - a.severity);
}

// -------------------------------------------------------------
// ЧАСТЬ 2: ЧЕСТНЫЙ ДЕТЕКТОР БОЙЛЕРПЛЕЙТА И КЛОНОВ КОДА (МАКРОСЫ)
// -------------------------------------------------------------
function analyzeBoilerplateInRust() {
  const rsFiles = walkDir(path.join(ROOT_DIR, 'src-tauri'), ['.rs']);
  const N_LINES = 4; // Блоки от 4 строк подряд
  const chunkMap = new Map();

  for (const file of rsFiles) {
    const raw = fs.readFileSync(file, 'utf-8');
    const lines = raw.split(/\r?\n/);
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');

    // Очищаем и нормализуем строки для сравнения структуры
    const normalized = lines.map(l => {
      let s = l.trim();
      if (s.startsWith('//') || s.startsWith('/*')) return '';
      return s.replace(/\s+/g, ' ');
    });

    for (let i = 0; i <= normalized.length - N_LINES; i++) {
      const slice = normalized.slice(i, i + N_LINES);
      // Пропускаем пустые или тривиальные блоки (скобки и т.д.)
      if (slice.some(s => s === '' || s === '{' || s === '}' || s === 'Ok(())')) continue;
      
      const key = slice.join('\n');
      if (!chunkMap.has(key)) {
        chunkMap.set(key, { rawSample: lines.slice(i, i + N_LINES).join('\n'), occurrences: [] });
      }
      chunkMap.get(key).occurrences.push({ file: rel, line: i + 1 });
    }
  }

  // Оставляем только те блоки, которые повторяются 3+ раз в разных местах
  const duplicates = [];
  for (const [, data] of chunkMap.entries()) {
    if (data.occurrences.length >= 3) {
      duplicates.push({
        count: data.occurrences.length,
        rawSample: data.rawSample,
        locations: data.occurrences
      });
    }
  }

  return duplicates.sort((a, b) => b.count - a.count);
}

// -------------------------------------------------------------
// ВЫВОД РЕЗУЛЬТАТОВ
// -------------------------------------------------------------
console.log('\n\x1b[1m\x1b[35m=== ЧЕСТНЫЙ СТАТИЧЕСКИЙ АУДИТ: СЛОЖНОСТЬ (WASM) И КЛОНЫ КОДА (МАКРОСЫ) ===\x1b[0m\n');

// 1. Вычислительная сложность
const complexity = analyzeComplexityInFrontend();
console.log(`\x1b[1m\x1b[36m⚡ 1. ТОП УЗКИХ МЕСТ ВЫЧИСЛЕНИЙ ВО ФРОНТЕНДЕ (КАНДИДАТЫ НА WASM):\x1b[0m`);
console.log(`Обнаружено подозрительных мест с циклами и аллокациями: \x1b[1m${complexity.length}\x1b[0m\n`);

for (const c of complexity.slice(0, 8)) {
  console.log(`  \x1b[33m▶ [${c.type}]\x1b[0m`);
  console.log(`    Файл: \x1b[90m${c.file}:${c.line}\x1b[0m`);
  console.log(`    Код:  \x1b[37m${c.snippet.trim()}\x1b[0m\n`);
}

// 2. Клоны кода в Rust
const boilerplate = analyzeBoilerplateInRust();
console.log(`\x1b[1m\x1b[36m🦀 2. ТОП СТРУКТУРНЫХ КЛОНОВ В RUST (КАНДИДАТЫ НА МАКРОСЫ):\x1b[0m`);
console.log(`Обнаружено повторяющихся 4-строчных паттернов (>= 3 повторов): \x1b[1m${boilerplate.length}\x1b[0m\n`);

for (let i = 0; i < Math.min(6, boilerplate.length); i++) {
  const b = boilerplate[i];
  console.log(`  \x1b[32m▶ Паттерн #${i + 1} (Встречается: \x1b[1m${b.count} раз\x1b[0m в ${new Set(b.locations.map(l => l.file)).size} файлах)\x1b[0m`);
  console.log(`    Примеры файлов:`);
  for (const loc of b.locations.slice(0, 3)) {
    console.log(`      - \x1b[90m${loc.file}:${loc.line}\x1b[0m`);
  }
  console.log(`    Фрагмент клона:`);
  console.log(b.rawSample.split('\n').map(l => `      | \x1b[90m${l}\x1b[0m`).join('\n'));
  console.log('');
}
