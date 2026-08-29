/**
 * @file shell.entityOps.ts
 * @description Операции над сущностями: загрузка списков, создание, удаление, сохранение и синхронизация
 */

import { ref, triggerRef, type Ref } from 'vue';
import type { useEditorGroups } from '@worldwiki/components';
import * as api from '../../services/api.client';
import { entityApi } from '../../services/Entity/entity.api';
import type { Entity } from '../../types/generated/Entity';
import type { Chapter } from '../../types/generated/Chapter';
import type { useSchemaStore } from '../schema';
import type { EditorTab } from './shell.types';

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
    const tabsToUpdate = deps.eg.allTabs.value.filter((t) => t.id === tabId || t.rawId === tabId.replace('entities:', ''));
    if (tabsToUpdate.length === 0) return;

    const merge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
      for (const key in source) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') target[key] = {};
          merge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
        } else if (Array.isArray(source[key])) {
          if (!Array.isArray(target[key])) target[key] = [];
          const targetArr = target[key] as unknown[];
          const sourceArr = source[key] as unknown[];
          for (let i = 0; i < sourceArr.length; i++) {
            if (i < targetArr.length) {
              if (typeof sourceArr[i] === 'object' && sourceArr[i] !== null) {
                merge(targetArr[i] as Record<string, unknown>, sourceArr[i] as Record<string, unknown>);
              } else {
                targetArr[i] = sourceArr[i];
              }
            } else {
              targetArr.push(sourceArr[i]);
            }
          }
          targetArr.length = sourceArr.length;
        } else {
          target[key] = source[key];
        }
      }
    };

    let updatedEntityType: string | null = null;
    let updatedRawId: string | null = null;

    for (const tab of tabsToUpdate) {
      const { __foreignUpdates, ...dataToMerge } = newData as Record<string, unknown> & { __foreignUpdates?: Record<string, unknown> };
      const oldTitle = tab.title;
      merge(tab.data, dataToMerge);
      if (__foreignUpdates && Object.keys(__foreignUpdates).length > 0) {
        (tab as EditorTab)._foreignUpdates = __foreignUpdates;
      }

      const newTitle = deps.schema.getEntityDisplayName(tab.data as Record<string, unknown>, tab.entityType);
      if (newTitle && newTitle !== oldTitle) {
        tab.title = newTitle;
      }

      updatedEntityType = tab.entityType;
      updatedRawId = tab.rawId;
    }

    if (!fromLiveSync && !isLiveSyncing && updatedEntityType && updatedRawId) {
      if (liveSyncTimer) clearTimeout(liveSyncTimer);
      liveSyncTimer = setTimeout(async () => {
        try {
          console.log('[LiveSync] Emitting ww-entity-live-sync from shell', { type: updatedEntityType, id: updatedRawId });
          const { emit } = await import('@tauri-apps/api/event');
          await emit('ww-entity-live-sync', { type: updatedEntityType, id: updatedRawId, data: newData });
        } catch (e) {
          console.error('[LiveSync] Error emitting from shell', e);
        }
      }, 150);
    }
  };

  const saveAll = async () => {
    let savedCount = 0;
    for (const editor of deps.openEditors.value) {
      if (!editor.unsaved) continue;
      if (editor.tabType === 'chapter') {
        document.dispatchEvent(new CustomEvent('ww:trigger-chapter-save'));
        continue;
      }
      if (editor.tabType === 'schema-editor') {
        document.dispatchEvent(new CustomEvent('ww:trigger-schema-save', { detail: { entityType: editor.entityType } }));
        editor.unsaved = false;
        deps.markSaved(editor.id);
        triggerRef(deps.openEditors);
        continue;
      }
      try {
        const prepareEntityForSave = async (_t: string, d: Record<string, unknown>) => d;
        const dataToSave = editor.data as Record<string, unknown> & { __foreignUpdates?: Record<string, unknown> };
        await prepareEntityForSave(editor.entityType, dataToSave);
        const foreignUpdatesToProcess = (editor as EditorTab)._foreignUpdates;
        (editor as EditorTab)._foreignUpdates = undefined;
        delete dataToSave.__foreignUpdates;

        const foreignUpdatesFinal = foreignUpdatesToProcess || {};
        try {
          const configRes = await fetch(`/struct/editor/${editor.entityType}.json`);
          if (configRes.ok) {
            const schemaConfig = await configRes.json();
            const oldStateReq = await entityApi.getEntity(deps.projectName.value, editor.entityType, editor.rawId);
            const oldState = oldStateReq as Record<string, unknown> | null;
            if (oldState) {
              for (const section of (schemaConfig.sections as Array<{ dynamicContainers?: Array<{ template: string; dataPath?: string; id: string }> }>) || []) {
                for (const dc of section.dynamicContainers || []) {
                  const tpl = (schemaConfig.templates as Record<string, { isBidirectional?: boolean; bidirectionalLinkClass?: string; fields?: Array<{ class?: string; entityType?: string }> }>)?.[dc.template];
                  if (tpl && tpl.isBidirectional) {
                    const dataPath = dc.dataPath || dc.id;
                    const linkClass = tpl.bidirectionalLinkClass;
                    let targetType = '';
                    if (tpl.fields) {
                      const targetField = tpl.fields.find((f) => f.class === linkClass);
                      if (targetField && targetField.entityType) targetType = targetField.entityType;
                    }
                    if (linkClass && targetType) {
                      const oldArr: Array<Record<string, unknown>> = Array.isArray(oldState[dataPath]) ? (oldState[dataPath] as Array<Record<string, unknown>>) : (Array.isArray(oldState[dc.id]) ? (oldState[dc.id] as Array<Record<string, unknown>>) : []);
                      const newArr: Array<Record<string, unknown>> = Array.isArray(dataToSave[dataPath]) ? (dataToSave[dataPath] as Array<Record<string, unknown>>) : (Array.isArray(dataToSave[dc.id]) ? (dataToSave[dc.id] as Array<Record<string, unknown>>) : []);
                      for (const oldItem of oldArr) {
                        const oldTarget = String(oldItem[linkClass] || '');
                        if (!oldTarget) continue;
                        const stillExists = newArr.some((newItem) => String(newItem[linkClass]) === oldTarget);
                        if (!stillExists) {
                          const targetEntityId = oldTarget;
                          const updateKey = `${targetType}:${targetEntityId}_delete`;
                          foreignUpdatesFinal[updateKey] = {
                            entityType: targetType,
                            entityId: targetEntityId,
                            data: {},
                            linkClass,
                            backLinkValue: `entities:${editor.rawId}`,
                            __deleted: true,
                          };
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('[saveAll] Error scanning deleted relationships:', e);
        }

        const modifiedForeignEntities: Entity[] = [];
        const rawMyId = (editor.rawId || '').replace(/^entities:/, '');
        const myFullId = rawMyId ? `entities:${rawMyId}` : '';

        // Подготовка сущностей стороны Б для сохранения в транзакции
        const updatesByTarget: Record<string, typeof foreignUpdatesFinal[string]> = {};
        for (const update of Object.values(foreignUpdatesFinal)) {
          if (!update || typeof update !== 'object') continue;
          const u = update as {
            entityType?: string;
            entityId?: string;
            dataPath?: string;
            linkClass?: string;
            backLinkValue?: string;
            item?: Record<string, unknown>;
            data?: Record<string, unknown>;
            __deleted?: boolean;
          };
          if (!u.entityType || !u.entityId) continue;
          const cleanTargetId = String(u.entityId).replace(/^entities:/, '');
          const groupKey = `${u.entityType}:${cleanTargetId}`;
          updatesByTarget[groupKey] = u;
        }

        for (const [groupKey, update] of Object.entries(updatesByTarget)) {
          const u = update as {
            entityType: string;
            entityId: string;
            dataPath?: string;
            linkClass?: string;
            backLinkValue?: string;
            item?: Record<string, unknown>;
            data?: Record<string, unknown>;
            __deleted?: boolean;
          };
          const cleanTargetId = String(u.entityId).replace(/^entities:/, '');
          try {
            const targetDataRaw = await entityApi.getEntity(deps.projectName.value, u.entityType, cleanTargetId);
            if (!targetDataRaw) continue;
            const targetData = JSON.parse(JSON.stringify(targetDataRaw));

            const dataPath = u.dataPath;
            if (!dataPath) continue;

            let targetArr: Array<Record<string, unknown>> = [];
            if (Array.isArray(targetData[dataPath])) {
              targetArr = targetData[dataPath];
            } else {
              targetData[dataPath] = [];
              targetArr = targetData[dataPath];
            }

            const linkClass = u.linkClass;
            if (!linkClass) continue;

            if (u.__deleted) {
              targetData[dataPath] = targetArr.filter((item) => {
                const val = String(item[linkClass] || '');
                return val !== myFullId && val !== rawMyId && !val.endsWith(`:${rawMyId}`);
              });
            } else {
              const mirrorItem = u.item || u.data || {};
              const existingIdx = targetArr.findIndex((item) => {
                const val = String(item[linkClass] || '');
                return val === myFullId || val === rawMyId || val.endsWith(`:${rawMyId}`);
              });

              const completeMirror = {
                ...mirrorItem,
                [linkClass]: myFullId || rawMyId
              };

              if (existingIdx >= 0) {
                targetArr[existingIdx] = {
                  ...targetArr[existingIdx],
                  ...completeMirror
                };
              } else {
                targetArr.push(completeMirror);
              }
            }

            const foreignPayload = entityApi.formatEntityPayload(
              deps.projectName.value,
              u.entityType,
              targetData,
              `entities:${cleanTargetId}`,
              (targetData.name as string) || 'Связанная сущность'
            );
            modifiedForeignEntities.push(foreignPayload as unknown as Entity);

            for (const openTab of deps.openEditors.value) {
              if (openTab.entityType === u.entityType && (openTab.rawId === cleanTargetId || openTab.rawId === `entities:${cleanTargetId}`)) {
                if (openTab.data && typeof openTab.data === 'object') {
                  (openTab.data as Record<string, unknown>)[dataPath] = targetData[dataPath];
                }
              }
            }
          } catch (err) {
            console.error(`[saveAll] Error preparing foreign entity ${groupKey}:`, err);
          }
        }
        const entityId = editor.rawId ? (editor.rawId.startsWith('entities:') ? editor.rawId : `entities:${editor.rawId}`) : `entities:${editor.entityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const mainPayload = entityApi.formatEntityPayload(deps.projectName.value, editor.entityType, dataToSave, entityId, editor.title || 'Новая сущность');

        const savedEntity = await api.saveEntityWithRelations(deps.projectName.value, mainPayload as unknown as Entity, modifiedForeignEntities);
        if (savedEntity && savedEntity.id) {
          editor.rawId = savedEntity.id.replace('entities:', '');
        }

        const newTitle = deps.schema.getEntityDisplayName(editor.data as Record<string, unknown>, editor.entityType);
        if (newTitle && newTitle !== editor.title) {
          editor.title = newTitle;
        }
        if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
        if (deps.currentSidebarTab.value === editor.entityType) loadEntityList(deps.currentSidebarTab.value as string);
        editor.unsaved = false;
        deps.markSaved(editor.id);
        triggerRef(deps.openEditors);
        try {
          const { emit } = await import('@tauri-apps/api/event');
          await emit('ww-entity-saved', { type: editor.entityType, id: `entities:${editor.rawId}` });
          for (const f of modifiedForeignEntities) {
            await emit('ww-entity-saved', { type: f.entity_type, id: f.id });
          }
        } catch (e) {
          console.warn('Tauri emit ww-entity-saved failed', e);
        }
        savedCount++;
      } catch (e) {
        deps.addLog(`Save -> Error: ${e}`, 'error');
      }
    }
    if (savedCount > 0) {
      document.dispatchEvent(new CustomEvent('ww:entity-saved'));
      deps.addToast(`Успешно сохранено: ${savedCount}`, 'success');
      deps.addLog(`System -> Saved ${savedCount} items`, 'success');
    }
  };

  const deleteEntity = async (tabId: string, entityType: string, silent = false) => {
    if (!silent) {
      const { appConfirm } = await import('@worldwiki/components');
      const confirmed = await appConfirm('Вы уверены, что хотите безвозвратно удалить эту запись?', 'Удаление записи');
      if (!confirmed) return;
    }
    const colonIdx = tabId.indexOf(':');
    const rawId = colonIdx > -1 ? tabId.slice(colonIdx + 1) : tabId;

    try {
      await api.deleteEntity(rawId);
      await deps.closeEditor(tabId, true);
      if (deps.activeTreeNode.value && deps.activeTreeNode.value.type === entityType && deps.activeTreeNode.value.node.id === rawId) {
        deps.activeTreeNode.value = null;
      }
      if (deps.currentSidebarTab.value) await loadEntityList(deps.currentSidebarTab.value);
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
      deps.addToast('Запись удалена', 'warn');
    } catch (e) {
      console.error(`[deleteEntity] ERROR:`, e);
      deps.addLog(`Entity -> Delete error: ${e}`, 'error');
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
          handleUpdateData(actualTabId, { [titleField]: newName });
        }

        if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
        if (deps.currentSidebarTab.value === entityType) await loadEntityList(entityType);

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
          project_id: `projects:${deps.projectName.value}`,
          title: newChapterTitle || 'Новая глава',
          content: '# Начните писать\n\n',
          summary: undefined,
          word_count: 0 as unknown as bigint,
          embeddings: {},
          footnotes: {},
          timeline_events: [],
          participants: [],
          arc_id: null,
          volume_id: null,
        } as unknown as Chapter;
        await api.saveChapter(deps.projectName.value, newChapter);
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
      await loadEntityList(entityType);
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();

      const entityToOpen = { ...(newEntity as Record<string, unknown>), entityType };
      deps.openEntity(entityToOpen);
    } catch (e) {
      deps.addLog(`Entity -> Error: ${e}`, 'error');
    } finally {
      isCreatingEntity.value = false;
    }
  };

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
    deleteEntity,
    renameEntity,
    addNewEntity,
    setIsLiveSyncing
  };
}
