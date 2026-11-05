/**
 * @file shell.entityCrud.ts
 * @description CRUD операции над сущностями и главами для shell store
 */

import { ref, type Ref } from 'vue';
import type { useEditorGroups } from '@worldwiki/components';
import * as api from '@/services/api.client';
import { entityApi } from '@/services/Entity/entity.api';
import type { Chapter } from '@/types/generated/Chapter';
import type { useSchemaStore } from '../schema';

export interface EntityCrudDeps {
  projectName: Ref<string>;
  eg: ReturnType<typeof useEditorGroups>;
  schema: ReturnType<typeof useSchemaStore>;
  activeTreeNode: Ref<{ type: string; node: { id?: string; [key: string]: unknown } } | null>;
  currentSidebarTab: Ref<string | null>;
  chapterTreeRef: Ref<{ load?: (targetId?: string) => Promise<void> } | null>;
  chapters: Ref<Chapter[]>;
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  addToast: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  closeEditor: (id: string, force?: boolean) => Promise<void>;
  openEntity: (entity: Record<string, unknown>) => void;
  openChapterTab: (chapter: Chapter) => void;
  loadEntityList: (entityType: string) => Promise<void>;
  handleUpdateData: (tabId: string, newData: Record<string, unknown>, fromLiveSync?: boolean) => void;
  confirmCreateChapter?: (payload: { title: string; volumeId: string | null }) => Promise<void>;
}

export function useShellEntityCrud(deps: EntityCrudDeps, isCreatingEntity: Ref<boolean>) {
  const deleteEntity = async (tabId: string, entityType: string, silent = false) => {
    if (!silent) {
      const { appConfirm } = await import('@worldwiki/components');
      const confirmed = await appConfirm('Вы уверены, что хотите безвозвратно удалить эту запись?', 'Удаление записи');
      if (!confirmed) return;
    }
    const colonIdx = tabId.indexOf(':');
    const rawId = colonIdx > -1 ? tabId.slice(colonIdx + 1) : tabId;

    console.log(`[deleteEntity] Initiating deletion: tabId='${tabId}', rawId='${rawId}', type='${entityType}'`);
    deps.addLog(`[deleteEntity] Запрос на удаление '${rawId}' (${entityType})...`, 'info');

    try {
      await api.deleteEntity(rawId);
      console.log(`[deleteEntity] Successfully deleted '${rawId}' in backend`);
      await deps.closeEditor(tabId, true);
      if (deps.activeTreeNode.value && deps.activeTreeNode.value.type === entityType && (deps.activeTreeNode.value.node.id === rawId || tabId.includes(String(deps.activeTreeNode.value.node.id)))) {
        deps.activeTreeNode.value = null;
      }
      if (deps.currentSidebarTab.value) await deps.loadEntityList(deps.currentSidebarTab.value);
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
      deps.addLog(`[deleteEntity] Сущность '${rawId}' успешно удалена из проекта`, 'info');
      deps.addToast('Запись удалена', 'warn');
    } catch (e) {
      console.error(`[deleteEntity] ERROR:`, e);
      deps.addLog(`[deleteEntity] Ошибка при удалении '${rawId}': ${e}`, 'error');
      const { appAlert } = await import('@worldwiki/components');
      appAlert(`Ошибка при удалении сущности: ${e}`);
    }
  };

  const renameEntity = async (entityType: string, idToUpdate: string, newName: string) => {
    try {
      const detail = await entityApi.getEntity(deps.projectName.value, entityType, idToUpdate) as Record<string, unknown> | null;
      const sch = await deps.schema.loadSchema(entityType);
      const firstSection = sch?.sections?.[0];
      const firstField = firstSection?.fields?.[0];
      const rawField = sch?.titleField || firstField?.path || firstField?.id || firstField?.class;
      const titleField: string = typeof rawField === 'string' && rawField.trim().length > 0 ? rawField.trim() : 'name';

      if (detail) {
        const parts = titleField.split('.');
        let current: Record<string, unknown> = detail;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
            current[parts[i]] = {};
          }
          current = current[parts[i]] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]] = newName;
        detail.name = newName;

        if (detail.attributes && typeof detail.attributes === 'object') {
          const attrs = detail.attributes as Record<string, unknown>;
          if (titleField in attrs) attrs[titleField] = newName;
          attrs.name = newName;
        }
        await entityApi.saveEntity(deps.projectName.value, entityType, detail, idToUpdate, newName);

        const actualTabId = deps.eg.findTabGlobal(idToUpdate) ? idToUpdate : null;
        if (actualTabId) {
          deps.eg.updateTabData(actualTabId, { title: newName });
          deps.handleUpdateData(actualTabId, { [titleField]: newName, name: newName });
        }

        if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
        if (deps.currentSidebarTab.value === entityType) await deps.loadEntityList(entityType);

        document.dispatchEvent(new CustomEvent('ww:entity-renamed', {
          detail: { id: idToUpdate, type: entityType, name: newName }
        }));
      }
    } catch (e) {
      console.error('[renameEntity] Error:', e);
      deps.addLog(`Error renaming entity: ${e}`, 'error');
    }
  };

  const isCreateEntityModalOpen = ref(false);
  const createEntityTargetType = ref<string | null>(null);

  const openCreateEntityModal = (entityType?: string | null) => {
    let initialType = entityType || null;
    if (!initialType && deps.currentSidebarTab.value && deps.currentSidebarTab.value !== 'chapters') {
      initialType = deps.currentSidebarTab.value;
    }
    createEntityTargetType.value = initialType;
    isCreateEntityModalOpen.value = true;
  };

  const closeCreateEntityModal = () => {
    isCreateEntityModalOpen.value = false;
    createEntityTargetType.value = null;
  };

  const confirmCreateEntity = async ({ entityType, name }: { entityType: string; name: string }) => {
    closeCreateEntityModal();
    const resolvedType = entityType.trim();
    const nameToSet = name.trim();
    if (!resolvedType || !nameToSet || isCreatingEntity.value) return;

    isCreatingEntity.value = true;
    try {
      const sch = await deps.schema.loadSchema(resolvedType);
      const titleFieldPath: string = sch?.titleField || sch?.sections?.[0]?.fields?.[0]?.path || 'name';
      const initialData: Record<string, unknown> = {};

      const parts = titleFieldPath.split('.');
      let current = initialData;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = {};
        current = current[parts[i]] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = nameToSet;

      const saveResult = await entityApi.saveEntity(deps.projectName.value, resolvedType, initialData, undefined, nameToSet);
      const newEntityId = saveResult.id;
      if (!newEntityId) {
        deps.addLog(`Entity -> Error: не удалось сохранить сущность`, 'error');
        deps.addToast('Ошибка при создании сущности', 'error');
        return;
      }

      const newEntity = await entityApi.getEntity(deps.projectName.value, resolvedType, newEntityId as string);
      if (!newEntity) {
        deps.addLog(`Entity -> Error: не удалось загрузить только что созданную сущность`, 'error');
        return;
      }

      deps.addLog(`Entity -> Created [${nameToSet}] (${resolvedType})`, 'success');
      deps.addToast(`Сущность "${nameToSet}" создана`, 'success');
      await deps.loadEntityList(resolvedType);
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();

      const entityToOpen = { ...(newEntity as Record<string, unknown>), entityType: resolvedType };
      deps.openEntity(entityToOpen);
    } catch (e) {
      console.error('[confirmCreateEntity] Error:', e);
      deps.addLog(`Entity -> Error: ${e}`, 'error');
      deps.addToast(`Ошибка создания: ${e}`, 'error');
    } finally {
      isCreatingEntity.value = false;
    }
  };

  const addNewEntity = async (entityType: string, preDefinedName?: string) => {
    if (!entityType) return;
    const isChapter = entityType === 'chapters' || entityType === 'chapter';
    let name = preDefinedName;
    if (!name) {
      const promptTitle = isChapter ? 'Введите название новой главы:' : `Введите имя для ${entityType}:`;
      const promptFn = typeof window !== 'undefined' && window.prompt ? window.prompt.bind(window) : (typeof prompt === 'function' ? prompt : null);
      const res = promptFn ? promptFn(promptTitle, isChapter ? 'Новая глава' : '') : null;
      if (!res) return;
      name = res;
    }

    if (isChapter) {
      if (deps.confirmCreateChapter) {
        await deps.confirmCreateChapter({ title: name, volumeId: null });
      }
      return;
    }

    await confirmCreateEntity({ entityType, name });
  };

  return {
    deleteEntity,
    renameEntity,
    addNewEntity,
    isCreateEntityModalOpen,
    createEntityTargetType,
    openCreateEntityModal,
    closeCreateEntityModal,
    confirmCreateEntity,
  };
}
