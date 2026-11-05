/**
 * @file shell.persistence.ts
 * @description Сохранение и восстановление состояния вкладок, навигации и редактора в localStorage
 */

import type { Ref } from 'vue';
import type { useEditorGroups } from '@worldwiki/components';
import * as api from '@/services/api.client';
import { entityApi } from '@/services/Entity/entity.api';
import type { useSchemaStore } from '../schema';
import type { EditorGroup, EditorTab } from './shell.types';

export interface PersistenceDeps {
  projectName: Ref<string>;
  activeView: Ref<string>;
  currentSidebarTab: Ref<string | null>;
  activePanelTab: Ref<string>;
  activeTreeNode: Ref<{ type: string; node: { id?: string; [key: string]: unknown } } | null>;
  eg: ReturnType<typeof useEditorGroups>;
  schema: ReturnType<typeof useSchemaStore>;
}

export function useShellPersistence(deps: PersistenceDeps) {
  const getStateKey = () => `worldwiki-state-${deps.projectName.value}`;
  let isRestoring = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const saveState = () => {
    if (isRestoring) return;
    localStorage.setItem(getStateKey(), JSON.stringify({
      activeView: deps.activeView.value,
      currentSidebarTab: deps.currentSidebarTab.value,
      activePanelTab: deps.activePanelTab.value,
      activeTreeNode: deps.activeTreeNode.value,
      editorGroups: deps.eg.serializeState(),
      activeGroupId: deps.eg.activeGroupId.value,
    }));
  };

  const debouncedSaveState = (delay = 500) => {
    if (isRestoring) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveState();
    }, delay);
  };

  const restoreState = async (): Promise<boolean> => {
    const saved = localStorage.getItem(getStateKey());
    if (!saved) {
      deps.eg.closeAll(true);
      return false;
    }
    isRestoring = true;
    try {
      const state = JSON.parse(saved);
      deps.activeView.value = state.activeView || 'entity';
      deps.currentSidebarTab.value = state.currentSidebarTab || null;
      deps.activePanelTab.value = state.activePanelTab !== undefined ? state.activePanelTab : '';
      deps.activeTreeNode.value = state.activeTreeNode || null;

      const rawGroups = state.editorGroups as EditorGroup[] | undefined;
      const rawTabs = state.openTabs as EditorTab[] | undefined;
      const tabSources: EditorTab[] = rawGroups ? rawGroups.flatMap((g) => g.tabs) : (rawTabs || []);

      let planetCalendarBundle: {
        planets?: Array<{ id?: string; name?: string }>;
        calendars?: Array<{ id?: string; name?: string }>;
      } | null = null;

      const loadedTabs = new Map<string, EditorTab>();
      for (const tab of tabSources) {
        if (loadedTabs.has(tab.id)) continue;
        try {
          if (tab.tabType === 'entity') {
            if (tab.entityType === 'planet' || tab.entityType === 'calendar') {
              if (!planetCalendarBundle) {
                planetCalendarBundle = (await api.getPlanetCalendarBundle(deps.projectName.value).catch(() => null)) as {
                  planets?: Array<{ id?: string; name?: string }>;
                  calendars?: Array<{ id?: string; name?: string }>;
                } | null;
              }
              const exists = tab.entityType === 'planet'
                ? planetCalendarBundle?.planets?.some(p => p.id === tab.rawId || p.id === `planets:${tab.rawId}` || p.name === tab.title)
                : planetCalendarBundle?.calendars?.some(c => c.id === tab.rawId || c.id === `calendars:${tab.rawId}` || c.name === tab.title);
              if (exists) {
                loadedTabs.set(tab.id, { ...tab, unsaved: false });
              }
            } else {
              await deps.schema.loadSchema(tab.entityType);
              const detail = await entityApi.getEntity(deps.projectName.value, tab.entityType, tab.rawId);
              if (detail && Object.keys(detail).length > 0 && detail.id) {
                loadedTabs.set(tab.id, { ...tab, data: detail as Record<string, unknown>, unsaved: false });
              }
            }
          } else if (tab.tabType === 'chapter') {
            const chapter = await api.getChapter(tab.rawId);
            if (chapter) loadedTabs.set(tab.id, { ...tab, data: chapter as unknown as Record<string, unknown>, unsaved: false });
          } else if (tab.tabType === 'schema-editor') {
            loadedTabs.set(tab.id, { ...tab, data: {}, unsaved: false });
          }
        } catch (e) {
          console.warn(`Failed to restore tab ${tab.id}`, e);
        }
      }

      if (rawGroups) {
        deps.eg.restoreState(rawGroups as unknown as Parameters<typeof deps.eg.restoreState>[0], loadedTabs as unknown as Parameters<typeof deps.eg.restoreState>[1]);
      } else {
        const group = deps.eg.groups.value[0];
        for (const [, tab] of loadedTabs) group.tabs.push(tab as unknown as typeof group.tabs[0]);
        if (state.activeEditorId && loadedTabs.has(state.activeEditorId)) {
          group.activeTabId = state.activeEditorId;
        } else if (group.tabs.length > 0) {
          group.activeTabId = group.tabs[0].id;
        }
      }

      isRestoring = false;
      return true;
    } catch (e) {
      console.warn('Failed to restore app state', e);
      isRestoring = false;
      return false;
    }
  };

  return {
    getStateKey,
    saveState,
    debouncedSaveState,
    restoreState,
  };
}
