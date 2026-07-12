<template>
  <Teleport to="body">
    <Transition name="cp-fade">
      <div v-if="isOpen" class="cp-overlay" @click.self="close">
        <div class="cp-modal" role="dialog" aria-label="Command Palette">
          <!-- Input -->
          <div class="cp-input-wrap">
            <i class="fas fa-terminal cp-icon"></i>
            <input
              ref="inputRef"
              v-model="query"
              class="cp-input"
              placeholder="Type a command..."
              @keydown.down.prevent="moveDown"
              @keydown.up.prevent="moveUp"
              @keydown.enter.prevent="runActive"
              @keydown.escape.prevent="close"
            />
            <span class="cp-hint-tag">⌘⇧P</span>
          </div>

          <!-- Results -->
          <div class="cp-results" ref="resultsRef">
            <template v-if="filtered.length > 0">
              <div
                v-for="(cmd, idx) in filtered"
                :key="cmd.id"
                class="cp-item"
                :class="{ active: idx === activeIdx }"
                @click="runCmd(cmd)"
                @mousemove="activeIdx = idx"
              >
                <span class="cp-item-icon">{{ cmd.icon }}</span>
                <div class="cp-item-body">
                  <span class="cp-item-title" v-html="highlight(cmd.title)"></span>
                  <span class="cp-item-desc">{{ cmd.desc }}</span>
                </div>
                <kbd v-if="cmd.hotkey" class="cp-kbd">{{ cmd.hotkey }}</kbd>
                <kbd class="cp-enter-hint" v-if="idx === activeIdx">↵</kbd>
              </div>
            </template>
            <div v-else class="cp-empty">No command found</div>
          </div>

          <!-- Footer -->
          <div class="cp-footer">
            <span><kbd>↑↓</kbd> select</span>
            <span><kbd>↵</kbd> run</span>
            <span><kbd>Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';

/**
 * CommandPalette — tauri-surreal-kit
 *
 * Domain-agnostic command palette (VS Code Ctrl+Shift+P).
 *
 * Pass your commands via the `commands` prop. Built-in system commands
 * (save, zoom, sidebar, settings) are always included by default and can
 * be disabled with `disableBuiltins`.
 *
 * Example:
 *   <CommandPalette
 *     ref="commandPaletteRef"
 *     :commands="myDomainCommands"
 *     @save="saveAll"
 *     @open-settings="showSettings = true"
 *   />
 */

export interface PaletteCommand {
  id: string;
  title: string;
  desc: string;
  icon: string;
  hotkey?: string;
  keywords?: string[];
  action: () => void;
}

const props = defineProps<{
  /** Additional domain-specific commands to inject. */
  commands?: PaletteCommand[];
  /** Set true to hide the built-in system commands. */
  disableBuiltins?: boolean;
}>();

const emit = defineEmits<{
  (e: 'save'): void;
  (e: 'save-all'): void;
  (e: 'new-entity'): void;
  (e: 'new-chapter'): void;
  (e: 'open-tags'): void;
  (e: 'open-sandbox'): void;
  (e: 'open-settings'): void;
  (e: 'toggle-sidebar'): void;
  (e: 'toggle-panel'): void;
  (e: 'close-all-tabs'): void;
  (e: 'zoom-in'): void;
  (e: 'zoom-out'): void;
  (e: 'zoom-reset'): void;
  (e: 'open-quick'): void;
}>();

const isOpen   = ref(false);
const query    = ref('');
const activeIdx = ref(0);
const inputRef  = ref<HTMLInputElement | null>(null);
const resultsRef = ref<HTMLElement | null>(null);

const builtinCommands = computed<PaletteCommand[]>(() => [
  {
    id: 'save',
    title: 'Save All',
    desc: 'Save all unsaved tabs',
    icon: '💾', hotkey: 'Ctrl+S',
    keywords: ['save', 'write'],
    action: () => { close(); emit('save'); }
  },
  {
    id: 'open-settings',
    title: 'Open Settings',
    desc: 'Themes, fonts, layout',
    icon: '⚙️', hotkey: 'Ctrl+,',
    keywords: ['settings', 'preferences', 'theme'],
    action: () => { close(); emit('open-settings'); }
  },
  {
    id: 'toggle-sidebar',
    title: 'Toggle Sidebar',
    desc: 'Show / hide navigation panel',
    icon: '🗂️', hotkey: 'Ctrl+B',
    keywords: ['sidebar', 'panel', 'navigation'],
    action: () => { close(); emit('toggle-sidebar'); }
  },
  {
    id: 'toggle-panel',
    title: 'Toggle Terminal',
    desc: 'Show / hide bottom panel',
    icon: '💻', hotkey: 'Ctrl+`',
    keywords: ['terminal', 'console', 'log', 'panel'],
    action: () => { close(); emit('toggle-panel'); }
  },
  {
    id: 'close-all-tabs',
    title: 'Close All Tabs',
    desc: 'Close all open editors',
    icon: '✖️',
    keywords: ['close', 'tabs'],
    action: () => { close(); emit('close-all-tabs'); }
  },
  {
    id: 'quick-open',
    title: 'Quick Open',
    desc: 'Find and open any item',
    icon: '🔎', hotkey: 'Ctrl+P',
    keywords: ['open', 'search', 'find', 'quick'],
    action: () => { close(); emit('open-quick'); }
  },
  {
    id: 'zoom-in',
    title: 'Zoom In',
    desc: 'Increase UI scale',
    icon: '🔍', hotkey: 'Ctrl+=',
    keywords: ['zoom', 'scale', 'larger'],
    action: () => { close(); emit('zoom-in'); }
  },
  {
    id: 'zoom-out',
    title: 'Zoom Out',
    desc: 'Decrease UI scale',
    icon: '🔎', hotkey: 'Ctrl+-',
    keywords: ['zoom', 'scale', 'smaller'],
    action: () => { close(); emit('zoom-out'); }
  },
  {
    id: 'zoom-reset',
    title: 'Reset Zoom',
    desc: 'Restore 100% scale',
    icon: '⊙', hotkey: 'Ctrl+0',
    keywords: ['zoom', 'reset', '100'],
    action: () => { close(); emit('zoom-reset'); }
  },
]);

const allCommands = computed<PaletteCommand[]>(() => [
  ...(props.disableBuiltins ? [] : builtinCommands.value),
  ...(props.commands ?? []),
]);

const filtered = computed(() => {
  if (!query.value.trim()) return allCommands.value;
  const q = query.value.toLowerCase();
  return allCommands.value.filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.desc.toLowerCase().includes(q) ||
    (c.keywords || []).some(k => k.includes(q))
  );
});

const highlight = (title: string) => {
  if (!query.value) return title;
  const q = query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return title.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>');
};

const open = async () => {
  isOpen.value = true;
  query.value  = '';
  activeIdx.value = 0;
  await nextTick();
  inputRef.value?.focus();
};

const close = () => { isOpen.value = false; };

const moveDown = () => {
  activeIdx.value = Math.min(activeIdx.value + 1, filtered.value.length - 1);
  scrollToActive();
};
const moveUp = () => {
  activeIdx.value = Math.max(activeIdx.value - 1, 0);
  scrollToActive();
};
const scrollToActive = () => {
  nextTick(() => {
    resultsRef.value?.querySelectorAll('.cp-item')[activeIdx.value]?.scrollIntoView({ block: 'nearest' });
  });
};
const runCmd = (cmd: PaletteCommand) => { close(); cmd.action(); };
const runActive = () => { const cmd = filtered.value[activeIdx.value]; if (cmd) runCmd(cmd); };

watch(query, () => { activeIdx.value = 0; });
defineExpose({ open, close });
</script>

<style scoped>
.cp-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  z-index: 99999;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 10vh;
}
.cp-modal {
  width: 600px; max-width: 94vw;
  background: var(--bg-panel, #1a1a2e);
  border: 1px solid rgba(139,92,246,0.4);
  border-radius: 14px;
  box-shadow: 0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.15) inset;
  overflow: hidden; display: flex; flex-direction: column;
}
.cp-input-wrap { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.cp-icon { color: rgba(139,92,246,0.8); font-size: 14px; flex-shrink: 0; }
.cp-input { flex: 1; background: transparent; border: none; outline: none; color: var(--text-main, #fff); font-size: 16px; font-family: var(--font-family, Inter, sans-serif); }
.cp-input::placeholder { color: rgba(255,255,255,0.25); }
.cp-hint-tag { font-size: 10px; padding: 2px 6px; background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.2); border-radius: 4px; color: rgba(139,92,246,0.6); flex-shrink: 0; }
.cp-results { max-height: 380px; overflow-y: auto; padding: 6px; }
.cp-results::-webkit-scrollbar { width: 4px; }
.cp-results::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }
.cp-empty { text-align: center; padding: 28px; color: rgba(255,255,255,0.25); font-size: 14px; }
.cp-item { display: flex; align-items: center; gap: 12px; padding: 9px 14px; border-radius: 8px; cursor: pointer; transition: background 0.1s; }
.cp-item:hover, .cp-item.active { background: rgba(139,92,246,0.14); }
.cp-item-icon { font-size: 18px; flex-shrink: 0; width: 26px; text-align: center; }
.cp-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cp-item-title { font-size: 14px; color: var(--text-main, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
:deep(.cp-item-title mark) { background: rgba(139,92,246,0.35); color: #c4b5fd; border-radius: 2px; padding: 0 1px; }
.cp-item-desc { font-size: 11px; color: rgba(255,255,255,0.35); }
.cp-kbd { font-size: 10px; padding: 1px 5px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; color: rgba(255,255,255,0.25); flex-shrink: 0; white-space: nowrap; }
.cp-enter-hint { font-size: 11px; padding: 1px 5px; background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.4); border-radius: 4px; color: #a78bfa; flex-shrink: 0; }
.cp-footer { display: flex; gap: 20px; padding: 8px 18px; border-top: 1px solid rgba(255,255,255,0.04); font-size: 11px; color: rgba(255,255,255,0.2); }
.cp-footer kbd { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 0 4px; font-size: 10px; color: rgba(255,255,255,0.35); }
.cp-fade-enter-active, .cp-fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.cp-fade-enter-from, .cp-fade-leave-to { opacity: 0; transform: scale(0.97) translateY(-6px); }
</style>
