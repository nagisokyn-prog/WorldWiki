import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src-tauri');
const APPLY = process.argv.includes('--apply');

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

const REPLACEMENTS = [
  // DomainError
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?DomainError)::Validation\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::validation)',
  },
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?DomainError)::ConstraintViolation\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::constraint_violation)',
  },
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?DomainError)::InvalidAstNode\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::invalid_ast_node)',
  },
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?DomainError)::InvalidPlotPromise\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::invalid_plot_promise)',
  },
  // ApplicationError
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?ApplicationError)::NotFound\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::not_found)',
  },
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?ApplicationError)::Conflict\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::conflict)',
  },
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?ApplicationError)::Validation\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::validation)',
  },
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?ApplicationError)::ExecutionFailed\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::execution_failed)',
  },
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?ApplicationError)::PermissionDenied\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::permission_denied)',
  },
  // ProjectError
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?ProjectError)::InvalidData\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::invalid_data)',
  },
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?ProjectError)::NotFound\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::not_found)',
  },
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?ProjectError)::Transaction\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::transaction)',
  },
  {
    regex: /\.map_err\(\s*\|([a-zA-Z_][a-zA-Z0-9_]*)\|\s*((?:[a-zA-Z0-9_:]+::)?ProjectError)::OperationFailed\(\s*\1\.to_string\(\)\s*\)\s*\)/g,
    to: '.map_err($2::operation_failed)',
  },
];

const files = collectRsFiles(ROOT);
let totalFilesChanged = 0;
let totalReplacements = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let updated = original;
  let fileCount = 0;

  for (const rule of REPLACEMENTS) {
    updated = updated.replace(rule.regex, (...args) => {
      fileCount++;
      const fullMatch = args[0];
      const errType = args[2];
      return rule.to.replace('$2', errType);
    });
  }

  if (fileCount > 0 && updated !== original) {
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
