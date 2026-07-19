import { triggerRef, type ComputedRef } from 'vue';

export function useSaveManager(ctx: {
  projectName: string;
  tabs: {
    openEditors: ComputedRef<any[]>;
    markTabSaved: (id: string) => void;
  };
  lists: {
    loadEntityList: (entityType: string) => Promise<void>;
    currentSidebarTab: { value: string | null };
  };
  schema: {
    getEntityDisplayName: (entity: Record<string, unknown>, entityType?: string) => string;
  };
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  addToast: (text: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  chapterTreeRef?: { value: { load?: () => void } | null };
  connectionsManager?: any;
}) {
  const saveAll = async () => {
    let savedCount = 0;
    for (const editor of ctx.tabs.openEditors.value) {
      if (!editor.unsaved) continue;
      if (editor.tabType === 'chapter') {
        document.dispatchEvent(new CustomEvent('ww:trigger-chapter-save'));
        continue;
      }
      try {
        const { apiService } = await import('../services/api.service');
        const { prepareEntityForSave, saveForeignRelationships } = await import('../services/relationship-save.service');
        const dataToSave = editor.data as any;
        await prepareEntityForSave(editor.entityType, dataToSave);
        const foreignUpdatesToProcess = (editor as any)._foreignUpdates;
        (editor as any)._foreignUpdates = null;
        delete dataToSave.__foreignUpdates;
        await apiService.saveEntity(ctx.projectName, editor.entityType, dataToSave, editor.rawId, editor.title);
        if (ctx.connectionsManager) {
          try {
            ctx.connectionsManager.setCurrentEntity(editor.entityType, editor.rawId);
            ctx.connectionsManager.setFormData(dataToSave);
            ctx.connectionsManager.setCurrentProject(ctx.projectName);
            const configRes = await fetch(`/struct/editor/${editor.entityType}.json`);
            if (configRes.ok) {
              const config = await configRes.json();
              ctx.connectionsManager.setConfig(config);
              await ctx.connectionsManager.saveConnections();
            }
          } catch (connError) {
            console.error(`[saveAll] Error saving connections:`, connError);
          }
        }
        const foreignUpdatesFinal = foreignUpdatesToProcess || {};
        try {
          const configRes = await fetch(`/struct/editor/${editor.entityType}.json`);
          if (configRes.ok) {
            const schema = await configRes.json();
            const oldStateReq = await apiService.getEntity(ctx.projectName, editor.entityType, editor.rawId);
            const oldState = (oldStateReq as any)?.data || oldStateReq;
            if (oldState) {
              for (const section of schema.sections || []) {
                for (const dc of section.dynamicContainers || []) {
                  const tpl = schema.templates?.[dc.template];
                  if (tpl && tpl.isBidirectional) {
                    const dataPath = dc.dataPath || dc.id;
                    const linkClass = tpl.bidirectionalLinkClass;
                    let targetType = '';
                    if (tpl.fields) {
                      const targetField = tpl.fields.find((f: any) => f.class === linkClass);
                      if (targetField && targetField.entityType) targetType = targetField.entityType;
                    }
                    if (linkClass && targetType) {
                      const oldArr = Array.isArray(oldState[dataPath]) ? oldState[dataPath] : (Array.isArray(oldState[dc.id]) ? oldState[dc.id] : []);
                      const newArr = Array.isArray(dataToSave[dataPath]) ? dataToSave[dataPath] : (Array.isArray(dataToSave[dc.id]) ? dataToSave[dc.id] : []);
                      for (const oldItem of oldArr) {
                        const oldTarget = String(oldItem[linkClass] || '');
                        if (!oldTarget) continue;
                        const stillExists = newArr.some((newItem: any) => String(newItem[linkClass]) === oldTarget);
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
        if (foreignUpdatesFinal && Object.keys(foreignUpdatesFinal).length > 0) {
          await saveForeignRelationships(ctx.projectName, editor.rawId, foreignUpdatesFinal);
        }
        const newTitle = ctx.schema.getEntityDisplayName(editor.data as Record<string, unknown>, editor.entityType);
        if (newTitle && newTitle !== editor.title) {
          editor.title = newTitle;
        }
        if (ctx.chapterTreeRef?.value?.load) ctx.chapterTreeRef.value.load();
        if (ctx.lists.currentSidebarTab.value === editor.entityType) ctx.lists.loadEntityList(ctx.lists.currentSidebarTab.value as string);
        editor.unsaved = false;
        ctx.tabs.markTabSaved(editor.id);
        triggerRef(ctx.tabs.openEditors);
        savedCount++;
      } catch (e) {
        ctx.addLog(`Save -> Error: ${e}`, 'error');
      }
    }
    if (savedCount > 0) {
      document.dispatchEvent(new CustomEvent('ww:entity-saved'));
      ctx.addToast(`Успешно сохранено: ${savedCount}`, 'success');
      ctx.addLog(`System -> Saved ${savedCount} items`, 'success');
    }
  };

  return { saveAll };
}