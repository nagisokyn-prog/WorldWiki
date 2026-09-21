import fs from 'node:fs';
import path from 'node:path';

function walkDir(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (entry.isFile() && fullPath.endsWith('.css')) {
      callback(fullPath);
    }
  }
}

const safeProps = ['opacity', 'transform', 'background-color', 'border-color', 'color'];

// 1. Walk styles and clean transition properties that include width, height, max-height, padding, margin, box-shadow
walkDir(path.resolve(process.cwd(), 'packages/resources/src/styles'), (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace transitions containing width or height or box-shadow with compositor safe properties
  const transitionRegex = /transition\s*:\s*([^;]+);/g;
  content = content.replace(transitionRegex, (match, transValue) => {
    // If it contains width, height, max-height, min-height, top, left, right, bottom, padding, margin, box-shadow
    if (/\b(width|height|max-height|min-height|max-width|min-width|top|left|right|bottom|padding|margin|box-shadow)\b/.test(transValue)) {
      changed = true;
      return `transition: opacity var(--anim-speed-normal, 0.2s) ease, transform var(--anim-speed-normal, 0.2s) ease, background-color var(--anim-speed-normal, 0.2s) ease, border-color var(--anim-speed-normal, 0.2s) ease, color var(--anim-speed-normal, 0.2s) ease;`;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Cleaned layout transitions in: ${path.relative(process.cwd(), filePath)}`);
  }
});

// 2. Fix specific @keyframes in EditorCoreTiptap.css
const tiptapCssPath = path.resolve(process.cwd(), 'packages/resources/src/styles/features/chapters/EditorCoreTiptap.css');
if (fs.existsSync(tiptapCssPath)) {
  let content = fs.readFileSync(tiptapCssPath, 'utf8');
  
  // Replace linkLockPulse
  content = content.replace(
    /@keyframes linkLockPulse \{[\s\S]*?\}/,
    `@keyframes linkLockPulse {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}`
  );

  // Replace promisePulse
  content = content.replace(
    /@keyframes promisePulse \{[\s\S]*?\}/,
    `@keyframes promisePulse {
  0% {
    background-color: var(--accent-glow);
    opacity: 1;
  }
  70% {
    background-color: var(--bg-selected);
    opacity: 0.9;
  }
  100% {
    background-color: transparent;
    opacity: 1;
  }
}`
  );

  fs.writeFileSync(tiptapCssPath, content, 'utf8');
  console.log('Cleaned @keyframes in EditorCoreTiptap.css');
}
