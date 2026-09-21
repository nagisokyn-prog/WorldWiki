/**
 * @file useShellPersistence.ts
 * @description Сохранение состояния макета, зума и вкладок для shell приложения
 */

import { ref, watch } from 'vue';
import type { useEditorGroups } from '../useEditorGroups';

export interface ShellPersistenceConfig {
  storagePrefix: string;
  eg: ReturnType<typeof useEditorGroups>;
  serializeExtra?: () => Record<string, unknown>;
  restoreExtra?: (saved: Record<string, unknown>) => Promise<void>;
}

export function useShellPersistence(config: ShellPersistenceConfig) {
  const prefix = config.storagePrefix;
  const STATE_KEY = `${prefix}:state`;
  const eg = config.eg;

  const showSettings = ref(false);
  const sidebarVisible = ref(true);
  const panelHeight = ref(parseInt(localStorage.getItem(`${prefix}:panel-height`) || '150'));
  const sidebarWidth = ref(parseInt(localStorage.getItem(`${prefix}:sidebar-width`) || '280'));
  const activePanelTab = ref('');
  const zoomLevel = ref(parseFloat(localStorage.getItem(`${prefix}:zoom`) || '1'));

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

  return {
    showSettings,
    sidebarVisible,
    panelHeight,
    sidebarWidth,
    activePanelTab,
    zoomLevel,
    applyZoom,
    saveState,
    restoreState
  };
}
