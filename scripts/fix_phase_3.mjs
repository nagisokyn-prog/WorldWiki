import fs from 'node:fs';
import path from 'node:path';

// 1. Fix HistorySidebar.css keyframe formatting
const historyCssPath = path.resolve(process.cwd(), 'packages/resources/src/styles/components/HistorySidebar.css');
if (fs.existsSync(historyCssPath)) {
  let content = fs.readFileSync(historyCssPath, 'utf8');
  content = content.replace(
    /@keyframes spin\s*\{[^}]+\}/g,
    `@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}`
  );
  fs.writeFileSync(historyCssPath, content, 'utf8');
  console.log('Fixed HistorySidebar.css keyframes formatting');
}

// 2. Fix CSS-004 direct rgba/hsl calls in remaining stylesheets
const css004Fixes = [
  {
    file: 'packages/resources/src/styles/features/shell/ProjectLauncher.css',
    replacements: [
      { from: /rgba\(\s*34,\s*197,\s*94,\s*0\.2\s*\)/g, to: 'var(--success-bg)' },
      { from: /rgba\(\s*234,\s*179,\s*8,\s*0\.2\s*\)/g, to: 'var(--warning-bg)' }
    ]
  },
  {
    file: 'packages/resources/src/styles/features/shell/EditorView.css',
    replacements: [
      { from: /rgba\(\s*239,\s*68,\s*68,\s*0\.4\s*\)/g, to: 'var(--error-bg)' }
    ]
  },
  {
    file: 'packages/resources/src/styles/features/schemas/RelationshipBlock.css',
    replacements: [
      { from: /rgba\(\s*245,\s*158,\s*11,\s*0\.25\s*\)/g, to: 'var(--warning-border)' }
    ]
  },
  {
    file: 'packages/resources/src/styles/features/chapters/PromisesPanel.css',
    replacements: [
      { from: /rgba\(\s*16,\s*185,\s*129,\s*0\.05\s*\)/g, to: 'var(--success-bg)' }
    ]
  },
  {
    file: 'packages/resources/src/styles/features/shell/CloudSyncModal.css',
    replacements: [
      { from: /hsl\(10,\s*98%,\s*55%\)/g, to: 'var(--error)' }
    ]
  },
  {
    file: 'packages/resources/src/styles/components/WorkspaceLayout.css',
    replacements: [
      { from: /color:\s*var\(--bg-hover\)/g, to: 'color: var(--text-muted)' }
    ]
  }
];

for (const item of css004Fixes) {
  const full = path.resolve(process.cwd(), item.file);
  if (fs.existsSync(full)) {
    let content = fs.readFileSync(full, 'utf8');
    for (const r of item.replacements) {
      content = content.replace(r.from, r.to);
    }
    fs.writeFileSync(full, content, 'utf8');
    console.log(`Applied fixes to: ${item.file}`);
  }
}
