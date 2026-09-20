import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const componentsDir = path.resolve(rootDir, 'apps/spa/src/ts/features/ai/components');
const testsDir = path.resolve(componentsDir, '__tests__');

const moves = [
  {
    from: 'useAiActionButtons.spec.ts',
    to: 'controls/AiActionButtons/useAiActionButtons.spec.ts',
    importFix: s => s.replace('../useAiActionButtons', './useAiActionButtons')
  },
  {
    from: 'useAiCitationBadge.spec.ts',
    to: 'citations/AiCitationBadge/useAiCitationBadge.spec.ts',
    importFix: s => s.replace('../useAiCitationBadge', './useAiCitationBadge')
  },
  {
    from: 'useAiCitationPopover.spec.ts',
    to: 'citations/AiCitationPopover/useAiCitationPopover.spec.ts',
    importFix: s => s.replace('../useAiCitationPopover', './useAiCitationPopover')
  },
  {
    from: 'useAiHeader.spec.ts',
    to: 'controls/AiHeader/useAiHeader.spec.ts',
    importFix: s => s.replace('../useAiHeader', './useAiHeader')
  },
  {
    from: 'useAiResearchProgress.spec.ts',
    to: 'visuals/AiResearchProgress/useAiResearchProgress.spec.ts',
    importFix: s => s.replace('../useAiResearchProgress', './useAiResearchProgress')
  }
];

for (const m of moves) {
  const src = path.resolve(testsDir, m.from);
  const dest = path.resolve(componentsDir, m.to);
  if (fs.existsSync(src)) {
    let content = fs.readFileSync(src, 'utf-8');
    content = m.importFix(content);
    fs.writeFileSync(dest, content, 'utf-8');
    fs.unlinkSync(src);
    console.log(`✓ Moved and fixed test: ${m.from} -> ${m.to}`);
  }
}

// If __tests__ is now empty, remove it
if (fs.existsSync(testsDir)) {
  const files = fs.readdirSync(testsDir);
  if (files.length === 0) {
    fs.rmdirSync(testsDir);
    console.log(`✓ Removed empty __tests__ directory`);
  }
}
