/**
 * @file useShellApp.ts — tauri-surreal-kit
 * @description Framework-level VS Code-style shell composable.
 */

import {
  ref, watch, onMounted, onUnmounted, type Ref
} from 'vue';
import { useEditorGroups } from './useEditorGroups';
import { settingsService } from '../services/settings.service';
import { useShellFloating, type FloatingEditor } from './shell/useShellFloating';
import { useShellResize } from './shell/useShellResize';
import { createShellKeydownHandler } from './shell/useShellShortcuts';
import { useShellLogging, type Toast, type ConsoleLog } from './shell/useShellLogging';
import { useShellPersistence } from './shell/useShellPersistence';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { FloatingEditor, Toast, ConsoleLog };

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

  // ── Editor Groups ─────────────────────────────────────────────────────────
  const eg = useEditorGroups();

  // ── Settings reactive ref ─────────────────────────────────────────────────
  const settings = ref(settingsService.getSettings());

  // ── Persistence, Layout & Zoom ────────────────────────────────────────────
  const {
    showSettings,
    sidebarVisible,
    panelHeight,
    sidebarWidth,
    activePanelTab,
    zoomLevel,
    applyZoom,
    saveState,
    restoreState
  } = useShellPersistence({
    storagePrefix: prefix,
    eg,
    serializeExtra: config.serializeExtra,
    restoreExtra: config.restoreExtra
  });

  // ── Floating windows ──────────────────────────────────────────────────────
  const floating = useShellFloating(config.appId ?? 'app');

  // ── Logging & Toasts ──────────────────────────────────────────────────────
  const { toasts, addToast, getToastIcon, consoleLogs, addLog } = useShellLogging(config.toastDuration ?? 3000);

  // ── Settings actions ──────────────────────────────────────────────────────
  const toggleSettings = () => { showSettings.value = !showSettings.value; };
  const resetSettings = () => { settingsService.resetSettings(); addLog('Settings → Reset', 'warn'); };

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
