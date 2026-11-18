import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src-tauri');
const args = new Set(process.argv.slice(2));
const SHOW_ALL = args.has('--all');
const AS_JSON = args.has('--json');

function isExcludedPath(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  if (norm.includes('/target/')) return true;
  if (norm.includes('/crates/worldwiki-ai/')) return true;
  if (norm.includes('/ai/') || norm.endsWith('/ai.rs')) return true;
  if (norm.includes('/tests/')) return true;
  return false;
}

function collectRsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (isExcludedPath(full)) continue;
    if (entry.isDirectory()) {
      collectRsFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.rs')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Removes #[cfg(test)] mod ... { ... } blocks while preserving line numbers
 * by replacing removed characters with spaces/newlines.
 */
function maskCfgTestBlocks(src) {
  const lines = src.split('\n');
  const masked = [...lines];
  let inCfgTestAttr = false;
  let skippingMod = false;
  let braceDepth = 0;
  let seenOpenBrace = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!skippingMod) {
      if (/^#\s*\[\s*cfg\s*\(\s*test\s*\)\s*\]/.test(trimmed)) {
        inCfgTestAttr = true;
        masked[i] = '';
        continue;
      }
      if (inCfgTestAttr) {
        if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('#[')) {
          masked[i] = '';
          continue;
        }
        inCfgTestAttr = false;
        skippingMod = true;
        braceDepth = 0;
        seenOpenBrace = false;
      }
    }

    if (skippingMod) {
      masked[i] = '';
      for (const ch of line) {
        if (ch === '{') {
          braceDepth++;
          seenOpenBrace = true;
        } else if (ch === '}') {
          braceDepth--;
        }
      }
      if (seenOpenBrace && braceDepth <= 0) {
        skippingMod = false;
      } else if (!seenOpenBrace && trimmed.endsWith(';')) {
        skippingMod = false;
      }
    }
  }

  return masked.join('\n');
}

function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];

    // Line comment
    if (ch === '/' && next === '/') {
      while (i < n && src[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    // Block comment
    if (ch === '/' && next === '*') {
      out += '  ';
      i += 2;
      let depth = 1;
      while (i < n && depth > 0) {
        if (src[i] === '/' && src[i + 1] === '*') {
          depth++;
          out += '  ';
          i += 2;
        } else if (src[i] === '*' && src[i + 1] === '/') {
          depth--;
          out += '  ';
          i += 2;
        } else {
          out += src[i] === '\n' ? '\n' : ' ';
          i++;
        }
      }
      continue;
    }
    // String literal
    if (ch === '"') {
      out += '"';
      i++;
      while (i < n) {
        if (src[i] === '\\' && i + 1 < n) {
          out += '  ';
          i += 2;
          continue;
        }
        if (src[i] === '"') {
          out += '"';
          i++;
          break;
        }
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function countBraceSpan(cleanSrc, openBraceIdx) {
  let depth = 0;
  let lines = 1;
  for (let i = openBraceIdx; i < cleanSrc.length; i++) {
    const ch = cleanSrc[i];
    if (ch === '\n') lines++;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return lines;
    }
  }
  return lines;
}

function classifyContext(beforeText, bodySpan, hasBraceBody) {
  const tail = beforeText.slice(-80);
  if (/(?:tokio::spawn|thread::spawn|spawn_blocking)\s*\(\s*(?:async\s+)?$/.test(tail)) {
    return 'spawn';
  }
  if (/\.(?:unwrap_or_else|or_else|map_err|ok_or_else)\s*\(\s*$/.test(tail)) {
    return 'error_fallback';
  }
  if (hasBraceBody && bodySpan >= 4) {
    return 'block_closure';
  }
  return 'inline_closure';
}

function findClosuresInFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const withoutTests = maskCfgTestBlocks(raw);
  const clean = stripCommentsAndStrings(withoutTests);
  const rawLines = raw.split('\n');

  const results = [];
  // Matches: (start of expr context) optional `move` + `|args|` (not `||` logical OR unless preceded by `(`, `=`, `,`, `return`, `=>`, `:`)
  const closureRegex = /(^|[\(=,:\{\[\n;]|=>|\breturn\b|\bmove\b)\s*(?:(async)\s+)?(?:(move)\s+)?\|([^|\n;{}]*)\|\s*(\{)?/gm;

  let match;
  while ((match = closureRegex.exec(clean)) !== null) {
    const prefix = match[1];
    const params = match[4];
    const openBrace = match[5];

    // Skip bitwise OR / logical OR false positives:
    // If prefix is empty/newline and no `move`, check previous non-ws char
    const matchStart = match.index + prefix.length;
    const before = clean.slice(Math.max(0, matchStart - 120), matchStart);
    const trimmedBefore = before.trimEnd();
    const lastChar = trimmedBefore[trimmedBefore.length - 1] ?? '';

    if (!['(', '=', ',', '{', '[', ':', ';', '>'].includes(lastChar) && !/\b(return|move|async)\s*$/.test(trimmedBefore)) {
      continue;
    }

    // Ignore trait bounds or macro patterns like `||` inside `assert!`? Actually `||` in `fn(|| ...)` is a valid 0-arg closure,
    // whereas `a || b` has identifier before `||` so `lastChar` check above already filters `a || b`.
    const lineNum = clean.slice(0, matchStart).split('\n').length;

    let bodySpan = 1;
    let hasBraceBody = Boolean(openBrace);
    if (openBrace) {
      const braceIdx = match.index + match[0].length - 1;
      bodySpan = countBraceSpan(clean, braceIdx);
    }

    const kind = classifyContext(before, bodySpan, hasBraceBody);
    const snippet = (rawLines[lineNum - 1] ?? '').trim().slice(0, 120);

    results.push({
      file: path.relative(process.cwd(), filePath).replace(/\\/g, '/'),
      line: lineNum,
      kind,
      spanLines: bodySpan,
      params: params.trim(),
      snippet,
    });
  }

  return results;
}

const files = collectRsFiles(ROOT);
const allClosures = files.flatMap(findClosuresInFile);

const actionable = allClosures.filter((c) => c.kind !== 'inline_closure');
const toShow = SHOW_ALL ? allClosures : actionable;

if (AS_JSON) {
  console.log(JSON.stringify({ total: allClosures.length, actionable: actionable.length, items: toShow }, null, 2));
  process.exit(0);
}

const byKind = allClosures.reduce((acc, c) => {
  acc[c.kind] = (acc[c.kind] || 0) + 1;
  return acc;
}, {});

console.log(`\nScanned ${files.length} Rust files in src-tauri (excluding ai/, target/, #[cfg(test)]).`);
console.log(`Total closures: ${allClosures.length}`);
console.log(`  - block_closure (>=4 lines): ${byKind.block_closure || 0}`);
console.log(`  - error_fallback (.map_err/.unwrap_or_else/.or_else/.ok_or_else): ${byKind.error_fallback || 0}`);
console.log(`  - spawn (tokio::spawn/thread::spawn): ${byKind.spawn || 0}`);
console.log(`  - inline_closure (short map/filter): ${byKind.inline_closure || 0}\n`);

const byFile = new Map();
for (const item of toShow) {
  if (!byFile.has(item.file)) byFile.set(item.file, []);
  byFile.get(item.file).push(item);
}

const sortedFiles = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`=== Top files with closures to decouple/test (${toShow.length} items in ${sortedFiles.length} files) ===\n`);
for (const [file, items] of sortedFiles) {
  console.log(`${file} (${items.length})`);
  for (const item of items) {
    const spanInfo = item.spanLines > 1 ? ` [${item.spanLines}L]` : '';
    console.log(`  :${item.line} [${item.kind}${spanInfo}] ${item.snippet}`);
  }
  console.log('');
}
