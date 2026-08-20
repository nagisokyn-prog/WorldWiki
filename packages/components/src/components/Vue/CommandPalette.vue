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
          <div ref="resultsRef" class="cp-results">
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
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <span class="cp-item-title" v-html="highlight(cmd.title)"></span>
                  <span class="cp-item-desc">{{ cmd.desc }}</span>
                </div>
                <kbd v-if="cmd.hotkey" class="cp-kbd">{{ cmd.hotkey }}</kbd>
                <kbd v-if="idx === activeIdx" class="cp-enter-hint">↵</kbd>
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

<style scoped src="@worldwiki/resources/styles/components/CommandPalette.css"></style>
