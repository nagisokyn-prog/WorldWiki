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
 */

import {
  ref, shallowRef, watch, onMounted, onUnmounted,
  triggerRef, type Ref
} from 'vue';
import { useEditorGroups } from './useEditorGroups';
import { settingsService } from '../services/settings.service';
import { useShellFloating, type FloatingEditor } from './shell/useShellFloating';
import { useShellResize } from './shell/useShellResize';
import { createShellKeydownHandler } from './shell/useShellShortcuts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { FloatingEditor };

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

export interface ShellAppConfig {
  storagePrefix: string;
  onSave?: () => Promise<void>;
  serializeExtra?: () => Record<string, unknown>;
  restoreExtra?: (saved: Record<string, unknown>) => Promise<void>;
  quickOpenRef?: Ref<{ open: () => void } | null>;
  commandPaletteRef?: Ref<{ open: () => void } | null>;
  toastDuration?: number;
  appId?: string;
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useShellApp(config: ShellAppConfig) {
  const prefix = config.storagePrefix;
  const STATE_KEY = `${prefix}:state`;

  // ── Editor Groups ─────────────────────────────────────────────────────────
  const eg = useEditorGroups();

  // ── Settings reactive ref ─────────────────────────────────────────────────
  const settings = ref(settingsService.getSettings());

  // ── Layout state ──────────────────────────────────────────────────────────
  const showSettings = ref(false);
  const sidebarVisible = ref(true);
  const panelHeight = ref(parseInt(localStorage.getItem(`${prefix}:panel-height`) || '150'));
  const sidebarWidth = ref(parseInt(localStorage.getItem(`${prefix}:sidebar-width`) || '280'));
  const activePanelTab = ref('');
  const zoomLevel = ref(parseFloat(localStorage.getItem(`${prefix}:zoom`) || '1'));

  // ── Floating windows ──────────────────────────────────────────────────────
  const floating = useShellFloating(config.appId ?? 'app');

  // ── Toasts ────────────────────────────────────────────────────────────────
  const toasts = ref<Toast[]>([]);
  let toastId = 0;
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
      case 'warn': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      default: return 'fas fa-info-circle';
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
      appEl.style.transform = `scale(${clamped})`;
      appEl.style.transformOrigin = 'top left';
      appEl.style.width = `${100 / clamped}%`;
      appEl.style.height = `${100 / clamped}%`;
    }
    localStorage.setItem(`${prefix}:zoom`, String(clamped));
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const toggleSettings = () => { showSettings.value = !showSettings.value; };
  const resetSettings = () => { settingsService.resetSettings(); addLog('Settings → Reset', 'warn'); };

  // ── State persistence ─────────────────────────────────────────────────────
  let isRestoring = false;

  const saveState = () => {
    if (isRestoring) return;
    const state: Record<string, unknown> = {
      activePanelTab: activePanelTab.value,
      editorGroups: eg.serializeState(),
      activeGroupId: eg.activeGroupId.value,
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

      if (state.editorGroups) {
        eg.restoreState(state.editorGroups, new Map());
      }

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

  // ── Resizers ──────────────────────────────────────────────────────────────
  const resizers = useShellResize({
    prefix,
    panelHeight,
    sidebarWidth,
    settings,
    eg,
    saveState
  });

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const handleKeydown = createShellKeydownHandler({
    eg,
    showSettings,
    sidebarVisible,
    activePanelTab,
    zoomLevel,
    applyZoom,
    toggleSettings,
    addLog,
    onSave: config.onSave,
    quickOpenRef: config.quickOpenRef,
    commandPaletteRef: config.commandPaletteRef
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMounted(async () => {
    applyZoom(zoomLevel.value);

    settingsService.onChange((newSettings) => {
      settings.value = newSettings;
    });

    window.addEventListener('keydown', handleKeydown);
    addLog('System → Shell initialized', 'success');
    await restoreState();
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  watch(() => settingsService.getSettings(), (n) => {
    settingsService.saveSettings(n);
  }, { deep: true });

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    eg,
    editorGroups: eg.groups,
    activeGroupId: eg.activeGroupId,
    allTabs: eg.allTabs,
    activeTab: eg.activeTab,
    activeGroup: eg.activeGroup,
    splitRight: () => eg.splitRight(),
    closeGroup: (gid: string) => eg.removeGroup(gid),
    moveTab: (p: { tabId: string; toGroupId: string; toIndex: number }) => eg.moveTab(p.tabId, p.toGroupId, p.toIndex),
    reorderTab: (p: { groupId: string; fromIdx: number; toIdx: number }) => eg.reorderTab(p.groupId, p.fromIdx, p.toIdx),
    activateTabInGroup: (gid: string, tid: string) => {
      const g = eg.groups.value.find(g => g.id === gid);
      if (g) { g.activeTabId = tid; eg.activeGroupId.value = gid; }
    },
    focusGroup: (gid: string) => { eg.activeGroupId.value = gid; },

    settings,
    showSettings,
    sidebarVisible,
    panelHeight,
    sidebarWidth,
    activePanelTab,
    zoomLevel,

    applyZoom,
    toggleSettings,
    resetSettings,
    saveState,
    restoreState,

    startResize: resizers.startResize,
    startSidebarResize: resizers.startSidebarResize,
    startGroupResize: resizers.startGroupResize,

    floatingEditors: floating.floatingEditors,
    openFloatingEditor: floating.openFloatingEditor,
    focusFloatingEditor: floating.focusFloatingEditor,
    closeFloatingEditor: floating.closeFloatingEditor,

    toasts,
    addToast,
    getToastIcon,
    consoleLogs,
    addLog,
  };
}
