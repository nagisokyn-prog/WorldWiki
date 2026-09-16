import fs from 'node:fs';
import path from 'node:path';

const REPLACEMENTS = [
  ['arch_guard_domain', 'cerberus_domain'],
  ['arch_guard_ports', 'cerberus_ports'],
  ['arch_guard_application', 'cerberus_application'],
  ['arch_guard_infrastructure', 'cerberus_infrastructure'],
  ['cargo_arch_guard', 'cargo_cerberus'],
  ['cargo-arch-guard', 'cargo-cerberus'],
  ['arch-guard-domain', 'cerberus-domain'],
  ['arch-guard-ports', 'cerberus-ports'],
  ['arch-guard-application', 'cerberus-application'],
  ['arch-guard-infrastructure', 'cerberus-infrastructure'],
  ['package.metadata.arch-guard', 'package.metadata.cerberus'],
  ['ArchGuard', 'Cerberus'],
  ['ARCH_GUARD', 'CERBERUS'],
];

const TARGET_EXTENSIONS = new Set(['.rs', '.toml', '.md', '.json']);

function walk(dir) {
  const results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'target' && entry.name !== 'node_modules' && entry.name !== '.git') {
        results.push(...walk(fullPath));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (TARGET_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const cratesDir = path.resolve('crates');
const files = walk(cratesDir);
let modifiedCount = 0;

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  for (const [from, to] of REPLACEMENTS) {
    content = content.replaceAll(from, to);
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${path.relative(process.cwd(), filePath)}`);
    modifiedCount++;
  }
}

console.log(`\nSuccessfully processed ${files.length} files. Modified ${modifiedCount} files.`);
