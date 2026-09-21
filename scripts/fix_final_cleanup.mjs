import fs from 'node:fs';
import path from 'node:path';

// 1. Move utilities/*.css -> base/*.css
const stylesDir = path.resolve(process.cwd(), 'packages/resources/src/styles');
const utilsDir = path.join(stylesDir, 'utilities');
const baseDir = path.join(stylesDir, 'base');

if (fs.existsSync(utilsDir)) {
  const files = fs.readdirSync(utilsDir);
  for (const f of files) {
    const src = path.join(utilsDir, f);
    const dest = path.join(baseDir, f);
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
    console.log(`Moved utilities/${f} -> base/${f}`);
  }
  try {
    fs.rmdirSync(utilsDir);
    console.log('Removed empty utilities directory');
  } catch {}
}

// Update imports in styles.css
const stylesCss = path.join(stylesDir, 'styles.css');
if (fs.existsSync(stylesCss)) {
  let content = fs.readFileSync(stylesCss, 'utf8');
  content = content.replace(/@import "\.\/utilities\//g, '@import "./base/');
  fs.writeFileSync(stylesCss, content, 'utf8');
  console.log('Updated imports in styles.css');
}

// 2. Fix DS-003 in Settings.css and AiAutoApproveModal.css
const settingsCss = path.join(stylesDir, 'components/Settings.css');
if (fs.existsSync(settingsCss)) {
  let content = fs.readFileSync(settingsCss, 'utf8');
  content = content.replace(/background:\s*var\(--color-text-muted,\s*var\(--border-active\)\);/g, 'background: var(--border-active);');
  fs.writeFileSync(settingsCss, content, 'utf8');
  console.log('Fixed Settings.css DS-003');
}

const aiModalCss = path.join(stylesDir, 'features/ai/AiAutoApproveModal.css');
if (fs.existsSync(aiModalCss)) {
  let content = fs.readFileSync(aiModalCss, 'utf8');
  content = content.replace(/background:\s*var\(--color-text-on-accent,\s*var\(--color-text-inverse\)\);/g, 'background: var(--accent-text);');
  fs.writeFileSync(aiModalCss, content, 'utf8');
  console.log('Fixed AiAutoApproveModal.css DS-003');
}
