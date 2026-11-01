import { triggerRef, type Ref } from 'vue';
import * as api from '../../services/api.client';
import { entityApi } from '../../services/Entity/entity.api';
import type { Entity } from '../../types/generated/Entity';
import type { EditorTab } from './shell.types';

export interface SaveAllDeps {
  projectName: Ref<string>;
  openEditors: Ref<EditorTab[]>;
  chapterTreeRef: Ref<{ load?: (targetId?: string) => Promise<void> } | null>;
  currentSidebarTab: Ref<string | null>;
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  addToast: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  markSaved: (tabId?: string) => void;
  loadEntityList: (entityType: string) => Promise<void>;
  getEntityDisplayName: (data: Record<string, unknown>, entityType?: string) => string;
}

export async function executeSaveAll(deps: SaveAllDeps): Promise<void> {
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
    if (editor.entityType === 'calendar') {
      document.dispatchEvent(new CustomEvent('ww:trigger-calendar-save', { detail: { id: editor.rawId } }));
      try {
        const { useCalendarStore } = await import('../calendar.store');
        const calendarStore = useCalendarStore();
        const calData = (editor.data as Record<string, unknown>) || {};
        await calendarStore.saveCalendar(
          deps.projectName.value,
          {
            название: editor.title || 'Календарь',
            ...calData,
            id: editor.rawId,
          } as unknown as Parameters<typeof calendarStore.saveCalendar>[1]
        );
        editor.unsaved = false;
        deps.markSaved(editor.id);
        triggerRef(deps.openEditors);
        savedCount++;
      } catch (err) {
        console.error('[saveAll] Error saving calendar tab:', err);
      }
      continue;
    }
    if (editor.entityType === 'planet') {
      document.dispatchEvent(new CustomEvent('ww:trigger-planet-save', { detail: { id: editor.rawId } }));
      editor.unsaved = false;
      deps.markSaved(editor.id);
      triggerRef(deps.openEditors);
      savedCount++;
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

      const newTitle = deps.getEntityDisplayName(editor.data as Record<string, unknown>, editor.entityType);
      if (newTitle && newTitle !== editor.title) {
        editor.title = newTitle;
      }
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
      if (deps.currentSidebarTab.value === editor.entityType) deps.loadEntityList(deps.currentSidebarTab.value as string);
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
}
