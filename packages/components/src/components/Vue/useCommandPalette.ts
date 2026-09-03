import { ref, computed, watch, nextTick } from 'vue';

export interface PaletteCommand {
  id: string;
  title: string;
  desc: string;
  icon: string;
  hotkey?: string;
  keywords?: string[];
  action: () => void;
}

export interface CommandPaletteProps {
  commands?: PaletteCommand[];
  disableBuiltins?: boolean;
}

export interface CommandPaletteEmits {
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
}

export function useCommandPalette(
  props: CommandPaletteProps,
  emit: CommandPaletteEmits
) {
  const isOpen = ref(false);
  const query = ref('');
  const activeIdx = ref(0);
  const inputRef = ref<HTMLInputElement | null>(null);
  const resultsRef = ref<HTMLElement | null>(null);

  const close = () => {
    isOpen.value = false;
  };

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

  const open = async () => {
    isOpen.value = true;
    query.value = '';
    activeIdx.value = 0;
    await nextTick();
    inputRef.value?.focus();
  };

  const scrollToActive = () => {
    void nextTick(() => {
      resultsRef.value?.querySelectorAll('.cp-item')[activeIdx.value]?.scrollIntoView({ block: 'nearest' });
    });
  };

  const moveDown = () => {
    activeIdx.value = Math.min(activeIdx.value + 1, filtered.value.length - 1);
    scrollToActive();
  };

  const moveUp = () => {
    activeIdx.value = Math.max(activeIdx.value - 1, 0);
    scrollToActive();
  };

  const runCmd = (cmd: PaletteCommand) => {
    close();
    cmd.action();
  };

  const runActive = () => {
    const cmd = filtered.value[activeIdx.value];
    if (cmd) runCmd(cmd);
  };

  watch(query, () => {
    activeIdx.value = 0;
  });

  return {
    isOpen,
    query,
    activeIdx,
    inputRef,
    resultsRef,
    filtered,
    open,
    close,
    moveDown,
    moveUp,
    runCmd,
    runActive
  };
}
