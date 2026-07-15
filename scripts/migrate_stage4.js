import fs from 'fs';
import path from 'path';

const root = process.cwd();

function mkdirp(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function moveDirOrFile(src, dest) {
    if (fs.existsSync(src)) {
        console.log(`Copying ${src} -> ${dest}`);
        fs.cpSync(src, dest, { recursive: true });
        console.log(`Removing ${src}`);
        try {
            fs.rmSync(src, { recursive: true, force: true });
        } catch (e) {
            console.warn(`Warning: Could not remove ${src} (might be locked by an editor)`);
        }
    }
}

// 1. Setup apps/spa directory
console.log('--- Setting up apps/spa ---');
const spaRoot = path.join(root, 'apps/spa');
mkdirp(path.join(spaRoot, 'src'));

// 2. Move HTML files
const htmlFiles = ['app.html', 'project_launcher.html', 'settings.html', 'ui_editor.html', 'splash.html', 'index.html'];
for (const file of htmlFiles) {
    moveDirOrFile(path.join(root, 'src', file), path.join(spaRoot, file));
}

// 3. Move src subdirectories
const srcDirs = ['ts', 'logic', 'struct'];
for (const dir of srcDirs) {
    moveDirOrFile(path.join(root, 'src', dir), path.join(spaRoot, 'src', dir));
}

// 4. Move config files
moveDirOrFile(path.join(root, 'vite.config.ts'), path.join(spaRoot, 'vite.config.ts'));
moveDirOrFile(path.join(root, 'tsconfig.json'), path.join(spaRoot, 'tsconfig.json'));
moveDirOrFile(path.join(root, 'tsconfig.node.json'), path.join(spaRoot, 'tsconfig.node.json'));

// 5. Create package.json for apps/spa
fs.writeFileSync(path.join(spaRoot, 'package.json'), JSON.stringify({
  name: "@worldwiki/spa",
  private: true,
  version: "0.1.0",
  type: "module",
  scripts: {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview"
  },
  dependencies: {
    "vue": "^3.5.0",
    "vue-i18n": "^9.14.0",
    "@worldwiki/components": "workspace:*",
    "@worldwiki/resources": "workspace:*"
  },
  devDependencies: {
    "@vitejs/plugin-vue": "^5.2.1",
    "typescript": "~5.7.2",
    "vite": "^8.1.4",
    "vue-tsc": "^3.3.7"
  }
}, null, 2));

console.log('--- Migration to apps/spa completed successfully! ---');
