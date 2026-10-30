/**
 * @file shell.entityOps.ts
 * @description Операции над сущностями: загрузка списков, создание, удаление, сохранение и синхронизация
 */

import { ref, type Ref } from 'vue';
import type { useEditorGroups } from '@worldwiki/components';
import { entityApi } from '../../services/Entity/entity.api';
import type { Chapter } from '../../types/generated/Chapter';
import type { useSchemaStore } from '../schema';
import type { EditorTab } from './shell.types';
import { executeSaveAll } from './shell.saveAll';
import { useShellEntityCrud } from './shell.entityCrud';
import { performUpdateData } from './shell.dataMerge';

export interface EntityOpsDeps {
  projectName: Ref<string>;
  eg: ReturnType<typeof useEditorGroups>;
  openEditors: Ref<EditorTab[]>;
  schema: ReturnType<typeof useSchemaStore>;
  activeEditor: Ref<EditorTab | null>;
  activeTreeNode: Ref<{ type: string; node: { id?: string; [key: string]: unknown } } | null>;
  currentSidebarTab: Ref<string | null>;
  chapterTreeRef: Ref<{ load?: (targetId?: string) => Promise<void> } | null>;
  chapters: Ref<Chapter[]>;
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  addToast: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  closeEditor: (id: string, force?: boolean) => Promise<void>;
  markSaved: (tabId?: string) => void;
  openEntity: (entity: Record<string, unknown>) => void;
  openChapterTab: (chapter: Chapter) => void;
}

export function useShellEntityOps(deps: EntityOpsDeps) {
  const entityLists = ref<Record<string, Array<Record<string, unknown>>>>({});
  const isCreatingEntity = ref(false);

  let isLiveSyncing = false;
  let liveSyncTimer: ReturnType<typeof setTimeout> | null = null;

  const loadEntityList = async (entityType: string) => {
    try {
      await deps.schema.loadSchema(entityType);
      const list = await entityApi.getEntityList(deps.projectName.value, entityType);
      entityLists.value = { ...entityLists.value, [entityType]: list as Array<Record<string, unknown>> };
      deps.addLog(`Data -> Loaded ${list.length} ${entityType}(s)`, 'info');
    } catch (e) {
      deps.addLog(`Data -> Error loading ${entityType}: ${e}`, 'error');
    }
  };

  const toggleEntityHistory = (rawId: string) => {
    document.dispatchEvent(new CustomEvent('ww:toggle-entity-history', { detail: { id: rawId } }));
  };

  const handleUpdateData = (tabId: string, newData: Record<string, unknown>, fromLiveSync = false) => {
    performUpdateData({
      tabId,
      newData,
      fromLiveSync,
      allTabs: deps.eg.allTabs.value as EditorTab[],
      getEntityDisplayName: deps.schema.getEntityDisplayName,
      isLiveSyncing,
      onEmitLiveSync: (type, id, data) => {
        if (liveSyncTimer) clearTimeout(liveSyncTimer);
        liveSyncTimer = setTimeout(async () => {
          try {
            console.log('[LiveSync] Emitting ww-entity-live-sync from shell', { type, id, sender: 'main' });
            const { emit } = await import('@tauri-apps/api/event');
            await emit('ww-entity-live-sync', { type, id, data, sender: 'main' });
          } catch (e) {
            console.error('[LiveSync] Error emitting from shell', e);
          }
        }, 250);
      }
    });
  };

  const saveAll = async () => {
    await executeSaveAll({
      projectName: deps.projectName,
      openEditors: deps.openEditors,
      chapterTreeRef: deps.chapterTreeRef,
      currentSidebarTab: deps.currentSidebarTab,
      addLog: deps.addLog,
      addToast: deps.addToast,
      markSaved: deps.markSaved,
      loadEntityList,
      getEntityDisplayName: deps.schema.getEntityDisplayName
    });
  };

  const crud = useShellEntityCrud(
    {
      projectName: deps.projectName,
      eg: deps.eg,
      schema: deps.schema,
      activeTreeNode: deps.activeTreeNode,
      currentSidebarTab: deps.currentSidebarTab,
      chapterTreeRef: deps.chapterTreeRef,
      chapters: deps.chapters,
      addLog: deps.addLog,
      addToast: deps.addToast,
      closeEditor: deps.closeEditor,
      openEntity: deps.openEntity,
      openChapterTab: deps.openChapterTab,
      loadEntityList,
      handleUpdateData
    },
    isCreatingEntity
  );

  const setIsLiveSyncing = (val: boolean) => {
    isLiveSyncing = val;
  };

  return {
    entityLists,
    isCreatingEntity,
    loadEntityList,
    toggleEntityHistory,
    handleUpdateData,
    saveAll,
    deleteEntity: crud.deleteEntity,
    renameEntity: crud.renameEntity,
    addNewEntity: crud.addNewEntity,
    isCreateEntityModalOpen: crud.isCreateEntityModalOpen,
    createEntityTargetType: crud.createEntityTargetType,
    openCreateEntityModal: crud.openCreateEntityModal,
    closeCreateEntityModal: crud.closeCreateEntityModal,
    confirmCreateEntity: crud.confirmCreateEntity,
    setIsLiveSyncing
  };
}
