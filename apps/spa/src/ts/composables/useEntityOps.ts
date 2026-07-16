import { ref } from 'vue';

export function useEntityOps(ctx: {
  projectName: string;
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  addToast: (text: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  schema: {
    loadSchema: (entityType: string) => Promise<any>;
    getEntityDisplayName: (entity: Record<string, unknown>, entityType?: string) => string;
  };
  lists: {
    loadEntityList: (entityType: string) => Promise<void>;
    currentSidebarTab: { value: string | null };
  };
  tabs: {
    openEntity: (entity: any) => void;
    closeEditor: (id: string, force?: boolean) => void;
  };
  activeTreeNode: { value: { type: string; node: any } | null };
  chapterTreeRef?: { value: { load?: () => void } | null };
}) {
  const isCreatingEntity = ref(false);

  const addNewEntity = async (entityType: string, preDefinedName?: string) => {
    if (!entityType || isCreatingEntity.value) return;
    isCreatingEntity.value = true;
    try {
      const { apiService } = await import('../services/api.service');
      const schema = await ctx.schema.loadSchema(entityType);
      const titleFieldPath: string = schema?.titleField || schema?.sections?.[0]?.fields?.[0]?.path || 'name';
      const initialData: any = {};
      const nameToSet = preDefinedName || prompt(`Введите название для нового элемента:`, 'Без названия');
      if (nameToSet === null) { isCreatingEntity.value = false; return; }
      if (nameToSet) {
        const parts = titleFieldPath.split('.');
        let current = initialData;
        for (let i = 0; i < parts.length - 1; i++) { current[parts[i]] = {}; current = current[parts[i]]; }
        current[parts[parts.length - 1]] = nameToSet;
      }
      const saveResult = await apiService.saveEntity(ctx.projectName, entityType, initialData, undefined, nameToSet || undefined);
      const newEntityId = saveResult?.id;
      if (!newEntityId || newEntityId === 'undefined') {
        ctx.addLog(`Entity -> Error: сервер не вернул валидный ID для ${entityType}`, 'error');
        ctx.addToast(`Ошибка: не удалось создать ${entityType}`, 'error');
        return;
      }
      const newEntity = await apiService.getEntity(ctx.projectName, entityType, newEntityId);
      if (!newEntity) { ctx.addLog(`Entity -> Error: не удалось загрузить только что созданную сущность ${newEntityId}`, 'error'); return; }
      if (preDefinedName) {
        (newEntity as any).Name = preDefinedName;
        await apiService.saveEntity(ctx.projectName, entityType, newEntity as any, newEntityId);
      }
      ctx.addLog(`Entity -> Created ${entityType} "${preDefinedName || newEntityId}"`, 'success');
      ctx.addToast(`Сущность "${preDefinedName || 'Создана'}" добавлена`, 'success');
      await ctx.lists.loadEntityList(entityType);
      if (ctx.chapterTreeRef?.value?.load) ctx.chapterTreeRef.value.load();
      const entityToOpen = { ...newEntity, entityType };
      if (preDefinedName) (entityToOpen as any).Name = preDefinedName;
      if (entityToOpen.id && entityToOpen.id !== 'undefined') ctx.tabs.openEntity(entityToOpen);
    } catch (e) {
      ctx.addLog(`Entity -> Error: ${e}`, 'error');
    } finally {
      isCreatingEntity.value = false;
    }
  };

  const deleteEntity = async (tabId: string, entityType: string, silent = false) => {
    if (!silent && !confirm(`Удалить эту запись безвозвратно?`)) return;
    const colonIdx = tabId.indexOf(':');
    const rawId = colonIdx > -1 ? tabId.slice(colonIdx + 1) : tabId;
    try {
      const { apiService } = await import('../services/api.service');
      await apiService.deleteEntity(ctx.projectName, entityType, rawId);
      ctx.tabs.closeEditor(tabId, true);
      if (ctx.activeTreeNode.value && ctx.activeTreeNode.value.type === entityType && ctx.activeTreeNode.value.node.id === rawId) {
        ctx.activeTreeNode.value = null;
      }
      if (ctx.lists.currentSidebarTab.value) await ctx.lists.loadEntityList(ctx.lists.currentSidebarTab.value);
      if (ctx.chapterTreeRef?.value?.load) ctx.chapterTreeRef.value.load();
      ctx.addToast(`Запись удалена`, 'warn');
    } catch (e) {
      ctx.addLog(`Entity -> Delete error: ${e}`, 'error');
    }
  };

  return { addNewEntity, deleteEntity };
}