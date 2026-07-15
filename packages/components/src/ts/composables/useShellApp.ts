/**
 * @file useShellApp.ts — tauri-surreal-kit
 * @description Framework-level VS Code-style shell composable.
 *
 * Provides the full UI infrastructure layer for any Tauri + SurrealDB app:
 *   - Split-pane editor groups (VS Code style)        ← useEditorGroups
 *   - Toast notifications                             ← addToast
 *   - Console log panel                               ← addLog
 *   - Zoom controls                                   ← applyZoom
 *   - Sidebar / panel resize handlers                 ← startResize, startSidebarResize
 *   - Group resize handler                            ← startGroupResize
 *   - Floating windows                                ← openFloatingEditor
 *   - Settings toggle                                 ← toggleSettings
 *   - Keyboard shortcuts (Ctrl+S, Ctrl+W, F11, etc.)
 *   - State persistence (editorGroups → localStorage)
 *
 * HOW TO USE:
 *   const shell = useShellApp({
 *     storagePrefix: 'my-app',       // localStorage key prefix
 *     onSave: async () => { ... },   // your domain save logic
 *     serializeExtra: () => ({ ... }),         // extra state fields to persist
 *     restoreExtra: async (saved) => { ... },  // restore domain state
 *     quickOpenRef, commandPaletteRef,
 *   });
 */

import {
  ref, shallowRef, computed, watch, onMounted,
  triggerRef, type Ref
} from 'vue';
import { useEditorGroups } from './useEditorGroups';
import { settingsService } from '../services/settings.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Toast {
  id: number;
  text: string;
  type: 'success' | 'warn' | 'error' | 'info';
}

export interface ConsoleLog {
  id: number;
  text: string;
  type: 'info' | 'warn' | 'error' | 'success';
  timestamp: string;
}

export interface FloatingEditor {
  id: string;
  entityType: string;
  entityId: string;
  zIndex: number;
}

export interface ShellAppConfig {
  /** Prefix for localStorage keys — e.g. 'my-app' → 'my-app:zoom', 'my-app:state'. */
  storagePrefix: string;
  /** Called when Ctrl+S is pressed. Your domain save logic goes here. */
  onSave?: () => Promise<void>;
  /** Extra state to serialize alongside editor groups (for domain-specific keys). */
  serializeExtra?: () => Record<string, unknown>;
  /** Restore domain-specific state from the serialized snapshot. */
  restoreExtra?: (saved: Record<string, unknown>) => Promise<void>;
  /** Ref to QuickOpen component (opened on Ctrl+P). */
  quickOpenRef?: Ref<any>;
  /** Ref to CommandPalette component (opened on Ctrl+Shift+P). */
  commandPaletteRef?: Ref<any>;
  /** Override toast duration in ms (default: 3000). */
  toastDuration?: number;
  /** App-id for Tauri WebviewWindow labels (default: 'app'). */
  appId?: string;
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useShellApp(config: ShellAppConfig) {
  const prefix    = config.storagePrefix;
  const STATE_KEY = `${prefix}:state`;

  // ── Editor Groups ─────────────────────────────────────────────────────────
  const eg = useEditorGroups();

  // ── Settings reactive ref ─────────────────────────────────────────────────
  const settings = ref(settingsService.getSettings());

  // ── Layout state ──────────────────────────────────────────────────────────
  const showSettings  = ref(false);
  const sidebarVisible = ref(true);
  const panelHeight   = ref(parseInt(localStorage.getItem(`${prefix}:panel-height`) || '150'));
  const sidebarWidth  = ref(parseInt(localStorage.getItem(`${prefix}:sidebar-width`) || '280'));
  const activePanelTab = ref('');
  const zoomLevel     = ref(parseFloat(localStorage.getItem(`${prefix}:zoom`) || '1'));
  const nextZIndex    = ref(20000);

  // ── Floating windows ──────────────────────────────────────────────────────
  const floatingEditors = ref<FloatingEditor[]>([]);

  // ── Toasts ────────────────────────────────────────────────────────────────
  const toasts = ref<Toast[]>([]);
  let toastId  = 0;
  const toastDuration = config.toastDuration ?? 3000;

  const addToast = (text: string, type: Toast['type'] = 'info') => {
    const id = ++toastId;
    toasts.value.push({ id, text, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, toastDuration);
  };

  const getToastIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return 'fas fa-check-circle';
      case 'warn':    return 'fas fa-exclamation-triangle';
      case 'error':   return 'fas fa-times-circle';
      default:        return 'fas fa-info-circle';
    }
  };

  // ── Console log ───────────────────────────────────────────────────────────
  const consoleLogs = shallowRef<ConsoleLog[]>([]);
  let logCounter = 0;

  const addLog = (text: string, type: ConsoleLog['type'] = 'info') => {
    const logs = consoleLogs.value;
    logs.unshift({ id: ++logCounter, text, type, timestamp: new Date().toLocaleTimeString() });
    if (logs.length > 100) logs.splice(100);
    triggerRef(consoleLogs);
  };

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const applyZoom = (level: number) => {
    const clamped = Math.max(0.5, Math.min(2, level));
    zoomLevel.value = clamped;
    document.documentElement.style.setProperty('--app-zoom', String(clamped));
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.style.transform     = `scale(${clamped})`;
      appEl.style.transformOrigin = 'top left';
      appEl.style.width  = `${100 / clamped}%`;
      appEl.style.height = `${100 / clamped}%`;
    }
    localStorage.setItem(`${prefix}:zoom`, String(clamped));
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const toggleSettings  = () => { showSettings.value = !showSettings.value; };
  const resetSettings   = () => { settingsService.resetSettings(); addLog('Settings → Reset', 'warn'); };

  // ── State persistence ─────────────────────────────────────────────────────
  let isRestoring = false;

  const saveState = () => {
    if (isRestoring) return;
    const state: Record<string, unknown> = {
      activePanelTab: activePanelTab.value,
      editorGroups:   eg.serializeState(),
      activeGroupId:  eg.activeGroupId.value,
      ...(config.serializeExtra?.() ?? {}),
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  };

  const restoreState = async (): Promise<boolean> => {
    const saved = localStorage.getItem(STATE_KEY);
    if (!saved) return false;
    isRestoring = true;
    try {
      const state = JSON.parse(saved);
      activePanelTab.value = state.activePanelTab ?? '';

      // Restore editor groups skeleton (tab data loaded by domain via restoreExtra)
      if (state.editorGroups) {
        eg.restoreState(state.editorGroups, new Map());
      }

      // Domain-specific state (entities, chapters, etc.)
      if (config.restoreExtra) {
        await config.restoreExtra(state);
      }

      isRestoring = false;
      return true;
    } catch (e) {
      console.warn('[useShellApp] Failed to restore state', e);
      isRestoring = false;
      return false;
    }
  };

  watch(activePanelTab, () => { if (!isRestoring) saveState(); });
  watch(eg.groups, saveState, { deep: true });

  // ── Resize: bottom panel ──────────────────────────────────────────────────
  const startResize = (e: MouseEvent) => {
    const startY = e.clientY;
    const startH = panelHeight.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    document.body.classList.add('resizing');
    const onMove = (ev: MouseEvent) => {
      panelHeight.value = Math.max(80, Math.min(600, startH - (ev.clientY - startY)));
      localStorage.setItem(`${prefix}:panel-height`, String(panelHeight.value));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Resize: sidebar width ─────────────────────────────────────────────────
  const startSidebarResize = (e: MouseEvent) => {
    const startX = e.clientX;
    const startW = sidebarWidth.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('resizing');
    const onMove = (ev: MouseEvent) => {
      const isReverse = settings.value.layout?.sidebarPos === 'row-reverse';
      const diff = ev.clientX - startX;
      sidebarWidth.value = Math.max(160, Math.min(520, startW + (isReverse ? -diff : diff)));
      localStorage.setItem(`${prefix}:sidebar-width`, String(sidebarWidth.value));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Resize: between editor groups ────────────────────────────────────────
  const startGroupResize = (e: MouseEvent, groupIdx: number) => {
    const container = (e.currentTarget as HTMLElement).closest('.editor-groups-container') as HTMLElement;
    if (!container) return;
    const totalW   = container.getBoundingClientRect().width;
    const startX   = e.clientX;
    const groups   = eg.groups.value;
    const left     = groups[groupIdx];
    const right    = groups[groupIdx + 1];
    if (!left || !right) return;
    const startLeft  = left.flexBasis;
    const startRight = right.flexBasis;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    const onMove = (ev: MouseEvent) => {
      const d = ((ev.clientX - startX) / totalW) * 100;
      const nl = Math.max(15, Math.min(85, startLeft + d));
      const nr = Math.max(15, Math.min(85, startRight - d));
      if (nl + nr > 100 || nl < 15 || nr < 15) return;
      left.flexBasis  = nl;
      right.flexBasis = nr;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      saveState();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Floating windows ──────────────────────────────────────────────────────
  const openFloatingEditor = (entityType: string, entityId: string) => {
    const id  = `${entityType}:${entityId}`;
    const appId = config.appId ?? 'app';

    // Try native Tauri WebviewWindow first
    try {
      const tauri = (window as any).__TAURI__;
      if (tauri?.webviewWindow?.WebviewWindow) {
        const label = `${appId}-editor-${entityType}-${entityId}`.replace(/[^a-z0-9]/gi, '-');
        new tauri.webviewWindow.WebviewWindow(label, {
          url: `ui_editor.html?type=${entityType}&id=${entityId}`,
          title: `Edit: ${entityType} [${entityId}]`,
          width: 950, height: 750,
          resizable: true, center: true, decorations: true
        });
        return;
      }
    } catch (e) {
      console.warn('[useShellApp] Native window failed:', e);
    }

    // Fallback: inline floating window
    const existing = floatingEditors.value.find(fe => fe.id === id);
    if (existing) {
      existing.zIndex = nextZIndex.value++;
    } else {
      floatingEditors.value.push({ id, entityType, entityId, zIndex: nextZIndex.value++ });
    }
  };

  const focusFloatingEditor = (id: string) => {
    const fe = floatingEditors.value.find(e => e.id === id);
    if (fe) fe.zIndex = nextZIndex.value++;
  };

  const closeFloatingEditor = (id: string) => {
    floatingEditors.value = floatingEditors.value.filter(e => e.id !== id);
  };

  // Expose globally for legacy HTML components
  if (typeof window !== 'undefined') {
    (window as any).openFloatingEditor = openFloatingEditor;
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const initKeyboardShortcuts = () => {
    window.addEventListener('keydown', async (e: KeyboardEvent) => {
      // Block browser defaults for all Ctrl keys we handle
      if (e.ctrlKey) {
        const OVERRIDES = new Set([
          'KeyS', 'KeyP', 'KeyN', 'KeyW', 'KeyF', 'KeyB',
          'Comma', 'Minus', 'Equal', 'Digit0', 'Backquote',
          'Tab', 'Backslash',
          'Digit1','Digit2','Digit3','Digit4','Digit5',
          'Digit6','Digit7','Digit8','Digit9', 'KeyT',
        ]);
        if (OVERRIDES.has(e.code)) e.preventDefault();
      }

      // F11 — fullscreen
      if (e.code === 'F11') {
        e.preventDefault();
        const tauri = (window as any).__TAURI__;
        if (tauri?.core) {
          tauri.core.invoke('toggle_fullscreen').catch(console.error);
        } else {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(console.warn);
          } else {
            document.exitFullscreen?.();
          }
        }
        return;
      }

      // Escape — close settings overlay
      if (e.code === 'Escape') {
        if (showSettings.value) { showSettings.value = false; return; }
        return;
      }

      // ── Ctrl (no Shift, no Alt) ──
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        switch (e.code) {
          case 'KeyS':
            await config.onSave?.();
            return;
          case 'Comma':
            toggleSettings();
            return;
          case 'KeyB':
            sidebarVisible.value = !sidebarVisible.value;
            return;
          case 'KeyW': {
            // Close active tab — app must handle via eg API
            const activeId = eg.activeGroup.value?.activeTabId;
            if (activeId) eg.closeTab(activeId);
            return;
          }
          case 'KeyP':
            config.quickOpenRef?.value?.open();
            return;
          case 'Equal':
            applyZoom(zoomLevel.value + 0.1);
            return;
          case 'Minus':
            applyZoom(zoomLevel.value - 0.1);
            return;
          case 'Digit0':
            applyZoom(1);
            return;
          case 'Backquote':
            activePanelTab.value = activePanelTab.value === '' ? 'console' : '';
            return;
          case 'Backslash':
            eg.splitRight();
            addLog(`Layout → Split added (groups: ${eg.groups.value.length})`, 'info');
            return;
          case 'Tab': {
            const all = eg.allTabs.value;
            if (all.length > 1) {
              const idx = all.findIndex((t: any) => t.id === eg.activeGroup.value?.activeTabId);
              const next = all[(idx + 1) % all.length];
              const g = eg.findGroupByTab(next.id);
              if (g) { g.activeTabId = next.id; eg.activeGroupId.value = g.id; }
            }
            return;
          }
          default: {
            const n = parseInt(e.code.replace('Digit', ''));
            if (n >= 1 && n <= 9) {
              const tab = eg.allTabs.value[n - 1] as any;
              if (tab) {
                const g = eg.findGroupByTab(tab.id);
                if (g) { g.activeTabId = tab.id; eg.activeGroupId.value = g.id; }
              }
            }
          }
        }
      }

      // ── Ctrl+Shift ──
      if (e.ctrlKey && e.shiftKey && !e.altKey) {
        if (['KeyP', 'KeyS', 'Tab'].includes(e.code)) e.preventDefault();
        switch (e.code) {
          case 'KeyP':
            config.commandPaletteRef?.value?.open();
            return;
          case 'KeyS':
            await config.onSave?.();
            return;
          case 'Tab': {
            const all = eg.allTabs.value;
            if (all.length > 1) {
              const idx  = all.findIndex((t: any) => t.id === eg.activeGroup.value?.activeTabId);
              const prev = (idx - 1 + all.length) % all.length;
              const tab  = all[prev] as any;
              const g    = eg.findGroupByTab(tab.id);
              if (g) { g.activeTabId = tab.id; eg.activeGroupId.value = g.id; }
            }
            return;
          }
        }
      }
    });
  };

  // ── onMounted ─────────────────────────────────────────────────────────────
  onMounted(async () => {
    applyZoom(zoomLevel.value);

    settingsService.onChange((newSettings) => {
      settings.value = newSettings;
    });

    initKeyboardShortcuts();

    addLog('System → Shell initialized', 'success');

    await restoreState();
  });

  // ── Watchers ──────────────────────────────────────────────────────────────
  watch(() => settingsService.getSettings(), (n) => {
    settingsService.saveSettings(n);
  }, { deep: true });

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    // Editor groups
    eg,
    editorGroups:       eg.groups,
    activeGroupId:      eg.activeGroupId,
    allTabs:            eg.allTabs,
    activeTab:          eg.activeTab,
    activeGroup:        eg.activeGroup,
    splitRight:         () => eg.splitRight(),
    closeGroup:         (gid: string) => eg.removeGroup(gid),
    moveTab:            (p: any) => eg.moveTab(p.tabId, p.toGroupId, p.toIndex),
    reorderTab:         (p: any) => eg.reorderTab(p.groupId, p.fromIdx, p.toIdx),
    activateTabInGroup: (gid: string, tid: string) => {
      const g = eg.groups.value.find(g => g.id === gid);
      if (g) { g.activeTabId = tid; eg.activeGroupId.value = gid; }
    },
    focusGroup:         (gid: string) => { eg.activeGroupId.value = gid; },

    // Layout
    settings,
    showSettings,
    sidebarVisible,
    panelHeight,
    sidebarWidth,
    activePanelTab,
    zoomLevel,

    // Actions
    applyZoom,
    toggleSettings,
    resetSettings,
    saveState,
    restoreState,

    // Resize
    startResize,
    startSidebarResize,
    startGroupResize,

    // Floating windows
    floatingEditors,
    openFloatingEditor,
    focusFloatingEditor,
    closeFloatingEditor,

    // Toasts & Logs
    toasts,
    addToast,
    getToastIcon,
    consoleLogs,
    addLog,
  };
}
