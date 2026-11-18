import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src-tauri');
const APPLY = process.argv.includes('--apply');

function isExcludedPath(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  if (norm.includes('/target/')) return true;
  if (norm.includes('/crates/worldwiki-ai/')) return true;
  if (norm.includes('/llama-sys/')) return true;
  if (norm.includes('/ai/') || norm.endsWith('/ai.rs')) return true;
  if (norm.includes('/tests/')) return true;
  if (norm.endsWith('/worldwiki-domain/src/errors.rs')) return true;
  if (/\/build[^/]*\.rs$/.test(norm)) return true;
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

function insertUseAfterHeader(src, useStmt) {
  if (src.includes(useStmt)) return src;
  const lines = src.split('\n');
  let insertIdx = 0;
  while (
    insertIdx < lines.length &&
    (lines[insertIdx].trim() === '' ||
      lines[insertIdx].trim().startsWith('//!') ||
      lines[insertIdx].trim().startsWith('#!['))
  ) {
    insertIdx++;
  }
  lines.splice(insertIdx, 0, useStmt);
  return lines.join('\n');
}

const files = collectRsFiles(ROOT);
let totalFilesChanged = 0;
let totalReplacements = 0;

// 1. .map_err(|e| DomainError::Validation(format!("msg: {e}"))) or format!("msg: {}", e)
const valFmtBrace = /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*(?:[a-zA-Z0-9_:]+::)?DomainError::Validation\(\s*format!\(\s*"([^"\n{}]+):\s*\{\1\}"\s*\)\s*\)\s*\)/g;
const valFmtArg = /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*(?:[a-zA-Z0-9_:]+::)?DomainError::Validation\(\s*format!\(\s*"([^"\n{}]+):\s*\{\}",\s*\1\s*\)\s*\)\s*\)/g;

// 2. .map_err(|e| DomainError::ConstraintViolation(format!("msg: {e}"))) or format!("msg: {}", e)
const conFmtBrace = /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*(?:[a-zA-Z0-9_:]+::)?DomainError::ConstraintViolation\(\s*format!\(\s*"([^"\n{}]+):\s*\{\1\}"\s*\)\s*\)\s*\)/g;
const conFmtArg = /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*(?:[a-zA-Z0-9_:]+::)?DomainError::ConstraintViolation\(\s*format!\(\s*"([^"\n{}]+):\s*\{\}",\s*\1\s*\)\s*\)\s*\)/g;

// 3. .unwrap_or_else(|| "literal".to_string())
const unwrapStr = /\.unwrap_or_else\(\s*\|\|\s*"([^"\n]*)"\.to_string\(\)\s*\)/g;

// 4. .or_else(|| ident.get("key"))
const orElseGet = /\.or_else\(\s*\|\|\s*([a-zA-Z_][a-zA-Z0-9_.]*\.get\([^()\n]+\))\s*\)/g;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let updated = original;
  let fileCount = 0;
  let needsResultExt = false;
  let needsOptionStrExt = false;

  const isWorldwikiDomain = file.replace(/\\/g, '/').includes('/crates/worldwiki-domain/');
  const isWorldwikiCore =
    file.replace(/\\/g, '/').includes('/crates/worldwiki-calendar-core/') ||
    file.replace(/\\/g, '/').includes('/crates/worldwiki-document-core/') ||
    file.replace(/\\/g, '/').includes('/crates/worldwiki-manuscript-core/');

  // Skip core crates that don't depend on worldwiki-domain
  if (!isWorldwikiCore) {
    updated = updated.replace(valFmtBrace, (_, _e, msg) => {
      fileCount++;
      needsResultExt = true;
      return `.ctx_validation("${msg}")`;
    });
    updated = updated.replace(valFmtArg, (_, _e, msg) => {
      fileCount++;
      needsResultExt = true;
      return `.ctx_validation("${msg}")`;
    });
    updated = updated.replace(conFmtBrace, (_, _e, msg) => {
      fileCount++;
      needsResultExt = true;
      return `.ctx_constraint("${msg}")`;
    });
    updated = updated.replace(conFmtArg, (_, _e, msg) => {
      fileCount++;
      needsResultExt = true;
      return `.ctx_constraint("${msg}")`;
    });
    updated = updated.replace(unwrapStr, (_, lit) => {
      fileCount++;
      needsOptionStrExt = true;
      return `.unwrap_or_str("${lit}")`;
    });
  }

  updated = updated.replace(orElseGet, (_, expr) => {
    fileCount++;
    return `.or(${expr})`;
  });

  if (fileCount > 0 && updated !== original) {
    const prefix = isWorldwikiDomain ? 'crate::errors' : 'worldwiki_domain::errors';
    if (needsResultExt && !updated.includes('DomainResultExt')) {
      updated = insertUseAfterHeader(updated, `use ${prefix}::DomainResultExt;`);
    }
    if (needsOptionStrExt && !updated.includes('OptionStrExt')) {
      updated = insertUseAfterHeader(updated, `use ${prefix}::OptionStrExt;`);
    }
    totalFilesChanged++;
    totalReplacements += fileCount;
    const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
    console.log(`${APPLY ? '[APPLIED]' : '[DRY-RUN]'} ${rel}: ${fileCount} replacements`);
    if (APPLY) {
      fs.writeFileSync(file, updated, 'utf8');
    }
  }
}

console.log(`\nTotal: ${totalReplacements} closures across ${totalFilesChanged} files (${APPLY ? 'applied' : 'dry-run'}).`);
