/**
 * @file shell.entityCrud.ts
 * @description CRUD операции над сущностями и главами для shell store
 */

import { type Ref, triggerRef } from 'vue';
import type { useEditorGroups } from '@worldwiki/components';
import * as api from '../../services/api.client';
import { projectRecordId } from '../../services/api/project.api';
import { entityApi } from '../../services/Entity/entity.api';
import type { Chapter } from '../../types/generated/Chapter';
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
      const schemaTitleField = sch?.titleField || (sch?.sections?.[0]?.fields as Array<{ isTitle?: boolean; path?: string }> | undefined)?.find((f: { isTitle?: boolean; path?: string }) => f.isTitle)?.path;
      const titleField = schemaTitleField || (detail ? (Object.keys(detail).find((k) => k.toLowerCase() === 'name') || Object.keys(detail)[0]) : 'name');

      if (titleField && detail) {
        detail[titleField] = newName;
        await entityApi.saveEntity(deps.projectName.value, entityType, detail, idToUpdate, newName);

        const actualTabId = deps.eg.findTabGlobal(idToUpdate) ? idToUpdate : null;
        if (actualTabId) {
          deps.eg.updateTabData(actualTabId, { title: newName });
          deps.handleUpdateData(actualTabId, { [titleField]: newName });
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

  const addNewEntity = async (entityType: string, preDefinedName?: string) => {
    if (!entityType || isCreatingEntity.value) return;
    isCreatingEntity.value = true;
    try {
      if (entityType === 'chapters') {
        const newChapterTitle = preDefinedName || prompt('Введите название новой главы:', 'Новая глава');
        if (newChapterTitle === null) return;
        const newChapter: Chapter = {
          id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          project_id: projectRecordId(deps.projectName.value),
          title: newChapterTitle || 'Новая глава',
          content: '# Начните писать\n\n',
          summary: undefined,
          word_count: 0 as unknown as bigint,
          embeddings: {},
          footnotes: {},
          timeline_events: [],
          participants: [],
          volume_id: null,
        } as unknown as Chapter;
        await api.saveChapter(newChapter);
        deps.addLog(`Chapter -> Created [${newChapter.title}]`, 'success');
        deps.addToast(`Глава "${newChapter.title}" создана`, 'success');
        deps.chapters.value.push(newChapter);
        triggerRef(deps.chapters);
        if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
        deps.openChapterTab(newChapter);
        return;
      }

      const sch = await deps.schema.loadSchema(entityType);
      const titleFieldPath: string = sch?.titleField || sch?.sections?.[0]?.fields?.[0]?.path || 'name';
      const initialData: Record<string, unknown> = {};
      const nameToSet = preDefinedName || prompt(`Введите название для нового элемента:`, 'Без названия');
      if (nameToSet === null) return;
      if (nameToSet) {
        const parts = titleFieldPath.split('.');
        let current = initialData;
        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = {};
          current = current[parts[i]] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]] = nameToSet;
      }

      const saveResult = await entityApi.saveEntity(deps.projectName.value, entityType, initialData, undefined, nameToSet);
      const newEntityId = saveResult.id;
      if (!newEntityId) {
        deps.addLog(`Entity -> Error: не удалось сохранить сущность`, 'error');
        return;
      }

      const newEntity = await entityApi.getEntity(deps.projectName.value, entityType, newEntityId as string);
      if (!newEntity) {
        deps.addLog(`Entity -> Error: не удалось загрузить только что созданную сущность`, 'error');
        return;
      }

      deps.addLog(`Entity -> Created`, 'success');
      await deps.loadEntityList(entityType);
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();

      const entityToOpen = { ...(newEntity as Record<string, unknown>), entityType };
      deps.openEntity(entityToOpen);
    } catch (e) {
      deps.addLog(`Entity -> Error: ${e}`, 'error');
    } finally {
      isCreatingEntity.value = false;
    }
  };

  return {
    deleteEntity,
    renameEntity,
    addNewEntity
  };
}
