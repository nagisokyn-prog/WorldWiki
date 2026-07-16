import { computed, nextTick } from 'vue';
import type { SchemaCacheLike } from './useSchemaCache';

export function useEditorTabs(ctx: {
  eg: any;
  schema: SchemaCacheLike;
  lists: {
    currentSidebarTab: { value: string | null };
    loadChapters: () => Promise<void>;
  };
  projectName: string;
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  getToastIcon: (type: 'success' | 'warn' | 'error' | 'info') => string;
  chapterTreeRef?: { value: { load?: (id?: string) => void } | null };
}) {
  const openEditors = computed(() => ctx.eg.allTabs.value);
  const activeEditorId = computed({
    get: () => ctx.eg.activeGroup.value?.activeTabId ?? null,
    set: (id: string | null) => {
      if (id) {
        const g = ctx.eg.findGroupByTab(id);
        if (g) {
          g.activeTabId = id;
          ctx.eg.activeGroupId.value = g.id;
        }
      }
    },
  });
  const activeEditor = computed(() => ctx.eg.activeTab.value);

  const openEntity = async (entity: any) => {
    const entityType = entity.entityType;
    if (!entityType || !entity.id || entity.id === 'undefined') return;
    const rawId = String(entity.id);
    const tabId = `entity:${entityType}:${rawId}`;
    if (!ctx.eg.findTabGlobal(tabId)) {
      try {
        await ctx.schema.loadSchema(entityType);
        const detail = await (await import('../services/api.service')).apiService.getEntity(ctx.projectName, entityType, rawId);
        const tabTitle = (entity as any).Name || (entity as any).name || (entity as any).title || ctx.schema.getEntityDisplayName(detail as Record<string, unknown>, entityType);
        ctx.eg.openTab({ id: tabId, rawId, title: tabTitle, entityType, tabType: 'entity', data: detail as Record<string, unknown>, unsaved: false });
        ctx.addLog(`Editor -> Opened ${entityType} [${tabTitle}]`, 'info');
      } catch (e) {
        ctx.addLog(`Editor -> Error opening: ${e}`, 'error');
        return;
      }
    } else {
      const g = ctx.eg.findGroupByTab(tabId);
      if (g) { g.activeTabId = tabId; ctx.eg.activeGroupId.value = g.id; }
    }
    ctx.lists.currentSidebarTab.value = 'entity';
  };

  const openChapterTab = (chapter: any) => {
    const id = String(chapter.id);
    if (!ctx.eg.findTabGlobal(id)) {
      ctx.eg.openTab({ id, rawId: id, title: chapter.title || `Глава ${id}`, entityType: 'chapter', tabType: 'chapter', data: chapter, unsaved: false });
    } else {
      const g = ctx.eg.findGroupByTab(id);
      if (g) { g.activeTabId = id; ctx.eg.activeGroupId.value = g.id; }
    }
    ctx.addLog(`Editor -> Chapter [${chapter.title}]`, 'info');
  };

  const openSchemaEditor = async (entityType: string) => {
    if (!entityType) return;
    const tabId = `schema-editor:${entityType}`;
    if (!ctx.eg.findTabGlobal(tabId)) {
      ctx.eg.openTab({ id: tabId, rawId: entityType, title: `Схема: ${entityType}`, entityType, tabType: 'schema-editor', data: {}, unsaved: false });
      ctx.addLog(`Editor -> Opened Schema Editor for ${entityType}`, 'info');
    } else {
      ctx.eg.openTab({ id: tabId } as any);
    }
  };

  const mountEntityEditor = (id: string) => {
    // stub for legacy compatibility
  };

  const closeEditor = (id: string, force = false) => {
    ctx.eg.closeTab(id, force);
    ctx.addLog(`Editor -> Closed [${id}]`, 'warn');
  };

  const closeAllTabs = () => ctx.eg.closeAll();

  const markUnsaved = (tabId?: string) => {
    const id = tabId ?? activeEditor.value?.id;
    if (id) ctx.eg.markTabUnsaved(id);
  };

  const markSaved = (tabId?: string) => {
    const id = tabId ?? activeEditor.value?.id;
    if (id) {
      ctx.eg.markTabSaved(id);
      ctx.getToastIcon('success');
    }
  };

  const onChapterRenamed = ({ id, title }: { id: string; title: string }) => {
    ctx.eg.updateTabData(id, { title });
  };

  const toggleEntityHistory = (rawId: string) => {
    document.dispatchEvent(new CustomEvent('ww:toggle-entity-history', { detail: { id: rawId } }));
  };

  const handleUpdateData = (tabId: string, newData: any) => {
    const tabsToUpdate = ctx.eg.allTabs.value.filter((t: any) => t.id === tabId);
    if (tabsToUpdate.length === 0) return;
    const merge = (target: any, source: any) => {
      for (const key in source) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') target[key] = {};
          merge(target[key], source[key]);
        } else if (Array.isArray(source[key])) {
          if (!Array.isArray(target[key])) target[key] = [];
          for (let i = 0; i < source[key].length; i++) {
            if (i < target[key].length) {
              if (typeof source[key][i] === 'object' && source[key][i] !== null) merge(target[key][i], source[key][i]);
              else target[key][i] = source[key][i];
            } else {
              target[key].push(source[key][i]);
            }
          }
          target[key].length = source[key].length;
        } else {
          target[key] = source[key];
        }
      }
    };
    for (const tab of tabsToUpdate) {
      const { __foreignUpdates, ...dataToMerge } = newData as any;
      merge(tab.data, dataToMerge);
      if (__foreignUpdates && Object.keys(__foreignUpdates).length > 0) (tab as any)._foreignUpdates = __foreignUpdates;
    }
  };

  return {
    openEditors,
    activeEditorId,
    activeEditor,
    openEntity,
    openChapterTab,
    openSchemaEditor,
    mountEntityEditor,
    closeEditor,
    closeAllTabs,
    markUnsaved,
    markSaved,
    markTabSaved: markSaved,
    onChapterRenamed,
    toggleEntityHistory,
    handleUpdateData,
  };
}