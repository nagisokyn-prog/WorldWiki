import fs from 'fs';
import path from 'path';

const vuePath = path.join(process.cwd(), 'apps/spa/src/ts/components/Vue/Chapters/EditorCoreTiptap.vue');
const composableDir = path.join(process.cwd(), 'apps/spa/src/ts/composables');
const composablePath = path.join(composableDir, 'useTiptapEditor.ts');

if (!fs.existsSync(composableDir)) fs.mkdirSync(composableDir, { recursive: true });

let vueContent = fs.readFileSync(vuePath, 'utf8');
const lines = vueContent.split('\n');

const scriptStart = lines.findIndex(l => l.includes('<script setup lang="ts">'));
const scriptEnd = lines.findIndex(l => l.includes('</script>'));

const scriptLines = lines.slice(scriptStart + 1, scriptEnd);

const emitIndex = scriptLines.findIndex(l => l.includes('const emit = defineEmits'));
const importsPart = scriptLines.slice(0, emitIndex - 12); // rough estimate
const propsStart = scriptLines.findIndex(l => l.includes('const props = defineProps'));

// The extensions (EnterHandler, SemanticParagraph) are right after imports.
// They start around line 205. We can just extract everything between imports and props.
const beforeProps = scriptLines.slice(25, propsStart).join('\n'); // extensions and apiService
const logicLines = scriptLines.slice(emitIndex + 1);

const returnVars = new Set();
logicLines.forEach(line => {
    let match = line.match(/^(?:export )?(?:const|let|var) ([a-zA-Z0-9_]+) =/);
    if (match) returnVars.add(match[1]);
    
    let funcMatch = line.match(/^function ([a-zA-Z0-9_]+)\(/);
    if (funcMatch) returnVars.add(funcMatch[1]);
});

const composableContent = `import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import { useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Extension } from '@tiptap/core';
import TurndownService from 'turndown';
import MarkdownIt from 'markdown-it';
import Paragraph from '@tiptap/extension-paragraph';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import SemanticParagraphNode from '../components/Vue/Chapters/SemanticParagraphNode.vue';
import { settingsService } from '@worldwiki/components';
import { apiService } from '../../services/api.service';

${beforeProps}

export function useTiptapEditor(props: any, emit: any) {
${logicLines.join('\n')}

  return {
    ${Array.from(returnVars).join(',\n    ')}
  };
}
`;

fs.writeFileSync(composablePath, composableContent);

// Rewrite the Vue component's script block
const newScript = `<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { EditorContent } from '@tiptap/vue-3';
import { XboxWheel, settingsService } from '@worldwiki/components';
import { useTiptapEditor } from '../../../composables/useTiptapEditor';

const props = defineProps({
  project: { type: String, required: true },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  hasUnsavedChanges: { type: Boolean, default: false },
  footnotesData: { type: Object, default: () => ({}) },
  initialScrollPos: { type: Number, default: 0 },
  changedFields: { type: Array as () => string[], default: () => [] }
});

const emit = defineEmits(['update:title', 'update:content', 'update:footnotesData', 'change', 'save', 'openEntity', 'scroll-change', 'toggle-history']);

const {
    ${Array.from(returnVars).join(',\n    ')}
} = useTiptapEditor(props, emit);

</script>`;

const newVueContent = lines.slice(0, scriptStart).join('\n') + '\n' + newScript + '\n' + lines.slice(scriptEnd + 1).join('\n');
fs.writeFileSync(vuePath, newVueContent);

console.log('Successfully refactored EditorCoreTiptap.vue into useTiptapEditor.ts');
