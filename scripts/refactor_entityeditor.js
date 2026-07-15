import fs from 'fs';
import path from 'path';

const vuePath = path.join(process.cwd(), 'apps/spa/src/ts/components/Vue/EntityEditor.vue');
const composableDir = path.join(process.cwd(), 'apps/spa/src/ts/composables');
const composablePath = path.join(composableDir, 'useEntityEditor.ts');

if (!fs.existsSync(composableDir)) fs.mkdirSync(composableDir, { recursive: true });

let vueContent = fs.readFileSync(vuePath, 'utf8');
const lines = vueContent.split('\n');

const scriptStart = lines.findIndex(l => l.includes('<script setup lang="ts">'));
const scriptEnd = lines.findIndex(l => l.includes('</script>'));

const scriptLines = lines.slice(scriptStart + 1, scriptEnd);

// Find the line with "const emit ="
const emitIndex = scriptLines.findIndex(l => l.includes('const emit = defineEmits'));

const importsPart = scriptLines.slice(0, emitIndex - 8).join('\n'); // getting imports
// Wait, the props definition might be multiple lines.
// Let's just manually construct the useEntityEditor.ts since we know exactly what is inside.

let composableLines = scriptLines.slice(emitIndex + 1, scriptLines.length - 4); // skip defineExpose

// Find all top-level variables and functions to return
const returnVars = new Set();
composableLines.forEach(line => {
    let match = line.match(/^(?:export )?(?:const|let|var) ([a-zA-Z0-9_]+) =/);
    if (match) returnVars.add(match[1]);
    
    let funcMatch = line.match(/^function ([a-zA-Z0-9_]+)\(/);
    if (funcMatch) returnVars.add(funcMatch[1]);
});

// Remove some internal ones if needed, but returning everything is safe.
returnVars.delete('_doMarkModified');

const composableContent = `import { ref, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue';
import { apiService } from '../../services/api.service';
import { settingsService } from '@worldwiki/components';

export function useEntityEditor(props: any, emit: any) {
${composableLines.join('\n')}

  return {
    ${Array.from(returnVars).join(',\n    ')}
  };
}
`;

fs.writeFileSync(composablePath, composableContent);

// Now rewrite the Vue component's script block
const newScript = `<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue';
import { apiService } from '../../services/api.service';
import { XboxWheel, TagsField, settingsService } from '@worldwiki/components';
import DateWheels from './DateWheels.vue';
import RelationshipBlock from './RelationshipBlock.vue';
import { useEntityEditor } from '../../composables/useEntityEditor';

const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

const props = defineProps({
  entityId: { type: String, required: true },
  entityType: { type: String, required: true },
  project: { type: String, required: true },
  initialData: { type: Object, default: () => ({}) },
  initialSection: { type: String, default: '' },
  initialScrollPos: { type: Number, default: 0 }
});

const emit = defineEmits(['update-data', 'modified', 'section-change', 'scroll-change']);

const {
    ${Array.from(returnVars).join(',\n    ')}
} = useEntityEditor(props, emit);

defineExpose({
  toggleHistory
});
</script>`;

const newVueContent = lines.slice(0, scriptStart).join('\n') + '\n' + newScript + '\n' + lines.slice(scriptEnd + 1).join('\n');
fs.writeFileSync(vuePath, newVueContent);

console.log('Successfully refactored EntityEditor.vue into useEntityEditor.ts');
