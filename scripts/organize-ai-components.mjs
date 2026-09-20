import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const componentsDir = path.resolve(rootDir, 'apps/spa/src/ts/features/ai/components');

const mappings = [
  // chat
  {
    targetDir: 'chat/AiMessageList',
    files: ['AiMessageList.vue', 'AiMessageList.model.ts', 'useAiMessageList.ts', 'useAiMessageList.spec.ts']
  },
  {
    targetDir: 'chat/AiChatInput',
    files: ['AiChatInput.vue', 'AiChatInput.model.ts', 'useAiChatInput.ts', 'useAiChatInput.spec.ts']
  },
  {
    targetDir: 'chat/AiChatTopBar',
    files: ['AiChatTopBar.vue', 'useAiChatTopBar.ts']
  },
  {
    targetDir: 'chat/AiChatHistory',
    files: ['AiChatHistory.vue', 'useAiChatHistory.ts']
  },
  {
    targetDir: 'chat/AiQuoteReplyBanner',
    files: ['AiQuoteReplyBanner.vue', 'AiQuoteReplyBanner.model.ts']
  },
  {
    targetDir: 'chat/AiSelectionToolbar',
    files: ['AiSelectionToolbar.vue', 'AiSelectionToolbar.model.ts', 'useAiSelectionToolbar.ts', 'useAiSelectionToolbar.spec.ts']
  },
  // tools
  {
    targetDir: 'tools/AiToolApproval',
    files: ['AiToolApproval.vue', 'useAiToolApproval.ts']
  },
  {
    targetDir: 'tools/AiToolInspector',
    files: ['AiToolInspector.vue', 'useAiToolInspector.ts']
  },
  {
    targetDir: 'tools/AiAutoApproveModal',
    files: ['AiAutoApproveModal.vue', 'AiAutoApproveModal.model.ts', 'useAiAutoApproveModal.ts', 'useAiAutoApproveModal.spec.ts']
  },
  {
    targetDir: 'tools/AiSkillAutocomplete',
    files: ['AiSkillAutocomplete.vue', 'AiSkillAutocomplete.model.ts', 'useAiSkillAutocomplete.ts', 'useAiSkillAutocomplete.spec.ts']
  },
  // citations
  {
    targetDir: 'citations/AiCitationBadge',
    files: ['AiCitationBadge.vue', 'useAiCitationBadge.ts']
  },
  {
    targetDir: 'citations/AiCitationPopover',
    files: ['AiCitationPopover.vue', 'useAiCitationPopover.ts']
  },
  {
    targetDir: 'citations',
    files: ['AiCitation.model.ts']
  },
  // visuals
  {
    targetDir: 'visuals/AiMermaidDiagram',
    files: ['AiMermaidDiagram.vue', 'AiMermaidDiagram.model.ts', 'useAiMermaidDiagram.ts', 'useAiMermaidDiagram.spec.ts']
  },
  {
    targetDir: 'visuals/AiResearchProgress',
    files: ['AiResearchProgress.vue', 'AiResearchProgress.model.ts', 'useAiResearchProgress.ts']
  },
  // controls
  {
    targetDir: 'controls/AiHeader',
    files: ['AiHeader.vue', 'AiHeader.model.ts', 'useAiHeader.ts']
  },
  {
    targetDir: 'controls/AiModeSelector',
    files: ['AiModeSelector.vue', 'AiModeSelector.model.ts', 'useAiModeSelector.ts']
  },
  {
    targetDir: 'controls/AiContextSelector',
    files: ['AiContextSelector.vue', 'useAiContextSelector.ts']
  },
  {
    targetDir: 'controls/AiActionButtons',
    files: ['AiActionButtons.vue', 'AiActionButtons.model.ts', 'useAiActionButtons.ts']
  },
  {
    targetDir: 'controls/AiSelect',
    files: ['AiSelect.vue', 'useAiSelect.ts']
  }
];

console.log('📦 Starting AI components migration...');

for (const group of mappings) {
  const destDirPath = path.resolve(componentsDir, group.targetDir);
  if (!fs.existsSync(destDirPath)) {
    fs.mkdirSync(destDirPath, { recursive: true });
  }

  for (const filename of group.files) {
    const srcPath = path.resolve(componentsDir, filename);
    const destPath = path.resolve(destDirPath, filename);

    if (fs.existsSync(srcPath)) {
      fs.renameSync(srcPath, destPath);
      console.log(`  ✓ Moved: ${filename} -> ${group.targetDir}/${filename}`);
    } else if (fs.existsSync(destPath)) {
      console.log(`  - Already in place: ${group.targetDir}/${filename}`);
    } else {
      console.warn(`  ⚠️ File not found: ${filename}`);
    }
  }
}

console.log('✅ AI components file move completed.');
