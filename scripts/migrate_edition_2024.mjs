import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetDirs = [
    path.join(rootDir, 'src-tauri'),
    path.join(rootDir, 'tauri-surreal-kit')
];

function findCargoTomlFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === 'target' || entry.name === 'node_modules' || entry.name === '.git') {
            continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findCargoTomlFiles(fullPath, fileList);
        } else if (entry.isFile() && entry.name === 'Cargo.toml') {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

console.log('🔍 Searching for Cargo.toml files in specified directories...');
const cargoFiles = targetDirs.flatMap(dir => findCargoTomlFiles(dir));

console.log(`📦 Found ${cargoFiles.length} Cargo.toml files.`);

let updatedCount = 0;
for (const filePath of cargoFiles) {
    const relPath = path.relative(rootDir, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Replace edition = "2021" (or "2018") with edition = "2024"
    const updatedContent = content.replace(/edition\s*=\s*"20(18|21)"/g, 'edition = "2024"');

    if (content !== updatedContent) {
        fs.writeFileSync(filePath, updatedContent, 'utf-8');
        console.log(`  ✅ Updated: ${relPath} -> edition = "2024"`);
        updatedCount++;
    } else {
        console.log(`  ℹ️  No changes needed: ${relPath}`);
    }
}

console.log(`\n🎉 Successfully updated ${updatedCount} Cargo.toml file(s).`);

console.log('\n🧹 Executing cargo clean...');
const srcTauriDir = path.join(rootDir, 'src-tauri');
const targetDir = path.join(srcTauriDir, 'target');

try {
    console.log(`Running 'cargo clean' in ${path.relative(rootDir, srcTauriDir)}...`);
    execSync('cargo clean', { cwd: srcTauriDir, stdio: 'inherit' });
    console.log('✅ cargo clean completed successfully.');
} catch (err) {
    console.warn('⚠️ cargo clean encountered a file lock. Attempting direct folder removal...');
    if (fs.existsSync(targetDir)) {
        try {
            fs.rmSync(targetDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
            console.log('✅ target directory successfully purged via filesystem.');
        } catch (fsErr) {
            console.error('❌ Failed to purge target directory:', fsErr.message);
        }
    }
}
