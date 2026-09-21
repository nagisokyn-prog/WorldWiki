import fs from 'node:fs';
import path from 'node:path';

const stylesDir = path.resolve(process.cwd(), 'packages/resources/src/styles');

// 1. Move fonts.css -> tokens/fonts.css
const fontsSrc = path.join(stylesDir, 'fonts.css');
const fontsDest = path.join(stylesDir, 'tokens/fonts.css');
if (fs.existsSync(fontsSrc)) {
  fs.copyFileSync(fontsSrc, fontsDest);
  fs.unlinkSync(fontsSrc);
  console.log('Moved fonts.css -> tokens/fonts.css');
}

// 2. Move glass-animations.css -> base/glass-animations.css
const glassAnimSrc = path.join(stylesDir, 'glass-animations.css');
const glassAnimDest = path.join(stylesDir, 'base/glass-animations.css');
if (fs.existsSync(glassAnimSrc)) {
  fs.copyFileSync(glassAnimSrc, glassAnimDest);
  fs.unlinkSync(glassAnimSrc);
  console.log('Moved glass-animations.css -> base/glass-animations.css');
}

// 3. Move app.css -> styles.css
const appCssSrc = path.join(stylesDir, 'app.css');
const stylesCssDest = path.join(stylesDir, 'styles.css');
if (fs.existsSync(appCssSrc)) {
  fs.copyFileSync(appCssSrc, stylesCssDest);
  fs.unlinkSync(appCssSrc);
  console.log('Moved app.css -> styles.css');
}

// 4. Update packages/resources/src/index.ts
const resourcesIndex = path.resolve(process.cwd(), 'packages/resources/src/index.ts');
if (fs.existsSync(resourcesIndex)) {
  const content = `// Export generic CSS
import './styles/tokens/fonts.css';
import './styles/font-awesome.min.css';
import './styles/styles.css';
import './styles/base/glass-animations.css';
`;
  fs.writeFileSync(resourcesIndex, content, 'utf8');
  console.log('Updated packages/resources/src/index.ts');
}

// 5. Update imports across apps/spa and packages
function walkDir(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'target'].includes(entry.name)) continue;
      walkDir(fullPath, callback);
    } else if (entry.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.vue') || fullPath.endsWith('.html') || fullPath.endsWith('.css'))) {
      callback(fullPath);
    }
  }
}

walkDir(path.resolve(process.cwd(), 'apps/spa'), (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('@worldwiki/resources/styles/fonts.css')) {
    content = content.replace(/@worldwiki\/resources\/styles\/fonts\.css/g, '@worldwiki/resources/styles/tokens/fonts.css');
    changed = true;
  }
  if (content.includes('@worldwiki/resources/styles/glass-animations.css')) {
    content = content.replace(/@worldwiki\/resources\/styles\/glass-animations\.css/g, '@worldwiki/resources/styles/base/glass-animations.css');
    changed = true;
  }
  if (content.includes('@worldwiki/resources/styles/app.css')) {
    content = content.replace(/@worldwiki\/resources\/styles\/app\.css/g, '@worldwiki/resources/styles/styles.css');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated imports in: ${path.relative(process.cwd(), file)}`);
  }
});

// Update packages/components/src/shell/settings.html if exists
const settingsHtml = path.resolve(process.cwd(), 'packages/components/src/shell/settings.html');
if (fs.existsSync(settingsHtml)) {
  let content = fs.readFileSync(settingsHtml, 'utf8');
  content = content.replace(/styles\/fonts\.css/g, 'styles/tokens/fonts.css');
  content = content.replace(/styles\/glass-animations\.css/g, 'styles/base/glass-animations.css');
  content = content.replace(/styles\/app\.css/g, 'styles/styles.css');
  fs.writeFileSync(settingsHtml, content, 'utf8');
  console.log('Updated settings.html');
}
