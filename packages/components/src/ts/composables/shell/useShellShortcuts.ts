import type { Ref } from 'vue';
import type { useEditorGroups } from '../useEditorGroups';

export interface ShellShortcutsDeps {
  eg: ReturnType<typeof useEditorGroups>;
  showSettings: Ref<boolean>;
  sidebarVisible: Ref<boolean>;
  activePanelTab: Ref<string>;
  zoomLevel: Ref<number>;
  applyZoom: (level: number) => void;
  toggleSettings: () => void;
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  onSave?: () => Promise<void>;
  quickOpenRef?: Ref<{ open: () => void } | null>;
  commandPaletteRef?: Ref<{ open: () => void } | null>;
}

export function createShellKeydownHandler(deps: ShellShortcutsDeps) {
  return async (e: KeyboardEvent) => {
    if (e.ctrlKey) {
      const OVERRIDES = new Set([
        'KeyS', 'KeyP', 'KeyN', 'KeyW', 'KeyF', 'KeyB',
        'Comma', 'Minus', 'Equal', 'Digit0', 'Backquote',
        'Tab', 'Backslash',
        'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
        'Digit6', 'Digit7', 'Digit8', 'Digit9', 'KeyT',
      ]);
      if (OVERRIDES.has(e.code)) e.preventDefault();
    }

    if (e.code === 'F11') {
      e.preventDefault();
      const tauri = window.__TAURI__;
      if (tauri?.core) {
        tauri.core.invoke('toggle_fullscreen').catch(console.error);
      } else {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.()?.catch(console.warn);
        } else {
          document.exitFullscreen?.();
        }
      }
      return;
    }

    if (e.code === 'Escape') {
      if (deps.showSettings.value) {
        deps.showSettings.value = false;
        return;
      }
      return;
    }

    if (e.ctrlKey && !e.shiftKey && !e.altKey) {
      switch (e.code) {
        case 'KeyS':
          await deps.onSave?.();
          return;
        case 'Comma':
          deps.toggleSettings();
          return;
        case 'KeyB':
          deps.sidebarVisible.value = !deps.sidebarVisible.value;
          return;
        case 'KeyW': {
          const activeId = deps.eg.activeGroup.value?.activeTabId;
          if (activeId) deps.eg.closeTab(activeId);
          return;
        }
        case 'KeyP':
          deps.quickOpenRef?.value?.open();
          return;
        case 'Equal':
          deps.applyZoom(deps.zoomLevel.value + 0.1);
          return;
        case 'Minus':
          deps.applyZoom(deps.zoomLevel.value - 0.1);
          return;
        case 'Digit0':
          deps.applyZoom(1);
          return;
        case 'Backquote':
          deps.activePanelTab.value = deps.activePanelTab.value === '' ? 'console' : '';
          return;
        case 'Backslash':
          deps.eg.splitRight();
          deps.addLog(`Layout → Split added (groups: ${deps.eg.groups.value.length})`, 'info');
          return;
        case 'Tab': {
          const all = deps.eg.allTabs.value;
          if (all.length > 1) {
            const idx = all.findIndex((t) => t.id === deps.eg.activeGroup.value?.activeTabId);
            const next = all[(idx + 1) % all.length];
            const g = deps.eg.findGroupByTab(next.id);
            if (g) {
              g.activeTabId = next.id;
              deps.eg.activeGroupId.value = g.id;
            }
          }
          return;
        }
        default: {
          const n = parseInt(e.code.replace('Digit', ''));
          if (n >= 1 && n <= 9) {
            const tab = deps.eg.allTabs.value[n - 1];
            if (tab) {
              const g = deps.eg.findGroupByTab(tab.id);
              if (g) {
                g.activeTabId = tab.id;
                deps.eg.activeGroupId.value = g.id;
              }
            }
          }
        }
      }
    }

    if (e.ctrlKey && e.shiftKey && !e.altKey) {
      if (['KeyP', 'KeyS', 'Tab'].includes(e.code)) e.preventDefault();
      switch (e.code) {
        case 'KeyP':
          deps.commandPaletteRef?.value?.open();
          return;
        case 'KeyS':
          await deps.onSave?.();
          return;
        case 'Tab': {
          const all = deps.eg.allTabs.value;
          if (all.length > 1) {
            const idx = all.findIndex((t) => t.id === deps.eg.activeGroup.value?.activeTabId);
            const prev = (idx - 1 + all.length) % all.length;
            const tab = all[prev];
            const g = deps.eg.findGroupByTab(tab.id);
            if (g) {
              g.activeTabId = tab.id;
              deps.eg.activeGroupId.value = g.id;
            }
          }
          return;
        }
      }
    }
  };
}
