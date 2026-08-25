#!/usr/bin/env node
/**
 * split-commands.cjs — архитектурная резня: выносит #[tauri::command] из файла
 * в папочный модуль:
 *   foo.rs -> foo/mod.rs (логика) + foo/commands.rs (IPC-обёртки)
 *
 * Использование:
 *   node split-commands.cjs --dry <file.rs> [<file2.rs> ...]   // только отчёт
 *   node split-commands.cjs <file.rs> [...]                    // выполнить
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const files = args.filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  console.error('usage: node split-commands.cjs [--dry] <file.rs> ...');
  process.exit(2);
}

/** Подсчёт дельты глубины скобок в строке с учётом строк/комментов. */
function analyze(line, st) {
  let delta = 0;
  let i = 0;
  const n = line.length;
  while (i < n) {
    if (st.blockComment) {
      const end = line.indexOf('*/', i);
      if (end === -1) return { delta };
      i = end + 2;
      st.blockComment = false;
      continue;
    }
    const ch = line[i];
    if (st.inString) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === '"') st.inString = false;
      i += 1;
      continue;
    }
    if (st.rawHashes > 0) {
      const closer = '"' + '#'.repeat(st.rawHashes);
      const end = line.indexOf(closer, i);
      if (end === -1) return { delta };
      i = end + closer.length;
      st.rawHashes = 0;
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') break;
    if (ch === '/' && line[i + 1] === '*') { st.blockComment = true; i += 2; continue; }
    if (ch === '"') {
      let j = i - 1;
      let hashes = 0;
      while (j >= 0 && line[j] === '#') { hashes++; j--; }
      if (j >= 0 && line[j] === 'r' && hashes > 0) { st.rawHashes = hashes; i = n; continue; }
      st.inString = true;
      i += 1;
      continue;
    }
    if (ch === "'") { i += (line[i + 1] === '\\') ? 4 : 3; continue; }
    if (ch === '{') { delta++; i++; continue; }
    if (ch === '}') { delta--; i++; continue; }
    i++;
  }
  return { delta };
}
module.exports = { analyze };

function splitFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n').map((l) => l.replace(/\r$/, ''));
  const commands = []; // {start,end}
  const fat = [];
  const st = { inString: false, rawHashes: 0, blockComment: false };

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '#[tauri::command]') continue;
    let start = i;
    while (start > 0 && /^\s*\/\//.test(lines[start - 1])) start--;
    let depth = 0, opened = false, j = i + 1;
    for (; j < lines.length; j++) {
      depth += analyze(lines[j], st).delta;
      if (!opened && depth > 0) opened = true;
      if (opened && depth <= 0) break;
    }
    if (j >= lines.length) throw new Error(`${file}: no end for command at line ${i + 1}`);
    commands.push({ start, end: j });
    // классификация тела
    const extra = [];
    for (let k = i + 1; k <= j; k++) {
      const t = lines[k].trim();
      if (!t || t.startsWith('//')) continue;
      if (/^pub (async )?fn/.test(t)) continue;
      if (/^\)/.test(t)) continue;
      if (/_inner\(|_impl\(|_core\(/.test(t)) continue;
      if (/^[)\]};,]+$/.test(t)) continue;
      if (/^\w+[:,]$/.test(t) && lines[k].includes(': ') === false) continue;
      extra.push(lines[k]);
    }
    if (extra.length > 0) {
      // Клей (нормализация аргументов) допустим в IPC-слое.
      // Блокируем только если команда сама ходит в БД или дергает модели.
      const hasDb = extra.some((l) =>
        /(\bdb|\w+\.db)\s*\.\s*(query|select|create|upsert|merge|delete)|::find_all\(|Surreal</.test(l)
      );
      if (hasDb) fat.push({ name: (lines[i + 1].match(/fn (\w+)/) || [])[1], n: extra.length });
    }
  }
  return { file, lines, commands, fat };
}

function convert(parsed, dry) {
  const { file, lines, commands, fat } = parsed;
  if (commands.length === 0) { console.log(`SKIP (no commands): ${file}`); return; }

  const dir = path.dirname(file);
  const base = path.basename(file, '.rs');
  const outDir = path.join(dir, base);

  console.log(`${base}.rs: команд=${commands.length}, fat=${fat.length}`);
  for (const f of fat) console.log(`   FAT: ${f.name} (+${f.n} строк логики)`);
  if (fat.length > 0) {
    if (!dry) throw new Error(`${base}: есть FAT-команды — извлеките ядра вручную`);
    return;
  }
  if (dry) {
    for (const c of commands) console.log(`   L${c.start + 1}-${c.end + 1}: ${(lines[c.start + 1].match(/fn (\w+)/) || [])[1]}`);
    return;
  }

  const remove = new Set();
  for (const c of commands) for (let k = c.start; k <= c.end; k++) remove.add(k);
  const rest = lines.filter((_, idx) => !remove.has(idx));
  let lastUse = -1;
  for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('use ')) lastUse = i;
  rest.splice(lastUse + 1, 0, '', '// IPC layer extracted (architecture split):', 'mod commands;', 'pub use commands::*;');

  const cmds = [
    `//! IPC layer for module \`${base}\`: #[tauri::command] wrappers only.`,
    `//! All business logic lives in mod.rs (*_inner).`,
    ``,
    `use super::*;`,
    ``,
  ];
  for (const c of commands) {
    for (let k = c.start; k <= c.end; k++) cmds.push(lines[k]);
    cmds.push('');
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'mod.rs'), rest.join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'commands.rs'), cmds.join('\n') + '\n');
  fs.unlinkSync(file);
  console.log(`OK -> ${base}/mod.rs (${rest.length}) + commands.rs (${cmds.length})`);
}

for (const f of files) {
  try { convert(splitFile(f), dry); }
  catch (e) { console.error(`FAIL ${f}: ${e.message}`); process.exitCode = 1; }
}
