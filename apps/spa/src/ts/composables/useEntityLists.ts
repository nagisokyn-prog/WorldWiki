import { ref, shallowRef, computed } from 'vue';

export interface SchemaCacheLike {
  loadSchema: (entityType: string) => Promise<any>;
  getEntityDisplayName: (entity: Record<string, unknown>, entityType?: string) => string;
}

export function useEntityLists(ctx: {
  schema: SchemaCacheLike;
  projectName: string;
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  chapterTreeRef?: { value: { load?: (id?: string) => void } | null };
}) {
  const entityLists = shallowRef<Record<string, Array<Record<string, unknown>>>>({});
  const chapters = shallowRef<Array<any>>([]);
  const sidebarSearch = ref('');
  const currentSidebarTab = ref<string | null>(null);

  const filteredEntityList = computed(() => {
    const q = sidebarSearch.value.toLowerCase();
    if (currentSidebarTab.value === 'chapters') {
      const list = chapters.value || [];
      return q ? list.filter((c: any) => String(c.title || '').toLowerCase().includes(q)) : list;
    }
    const list = entityLists.value[currentSidebarTab.value || ''] || [];
    return q
      ? list.filter((e: any) => ctx.schema.getEntityDisplayName(e as Record<string, unknown>, currentSidebarTab.value || undefined).toLowerCase().includes(q))
      : list;
  });

  const activeSidebarItem = computed(() => {
    const items = (window as any).__sidebarItems || [];
    return items.find((i: any) => i.entityType === currentSidebarTab.value || i.url === currentSidebarTab.value) || null;
  });

  const setSidebarItems = (items: any[]) => {
    (window as any).__sidebarItems = items;
  };

  const loadEntityList = async (entityType: string) => {
    try {
      await ctx.schema.loadSchema(entityType);
      const list = await (await import('../services/api.service')).apiService.getEntityList(ctx.projectName, entityType);
      entityLists.value[entityType] = list as Array<Record<string, unknown>>;
      ctx.addLog(`Data -> Loaded ${(list as any[]).length} ${entityType}(s)`, 'info');
    } catch (e) {
      ctx.addLog(`Data -> Error loading ${entityType}: ${e}`, 'error');
      entityLists.value[entityType] = [];
    }
  };

  const loadChapters = async () => {
    try {
      const list = await (await import('../services/api.service')).apiService.getChaptersList(ctx.projectName);
      chapters.value = list as Array<any>;
      ctx.addLog(`Data -> Loaded ${chapters.value.length} chapter(s)`, 'info');
    } catch (e) {
      ctx.addLog(`Data -> Error loading chapters: ${e}`, 'error');
      chapters.value = [];
    }
  };

  const selectSidebarTab = (item: any) => {
    if (item.type === 'static' && item.url) {
      window.location.href = item.url + (item.url.includes('?') ? '&' : '?') + `project=${encodeURIComponent(ctx.projectName)}`;
      return;
    }
    if (item.type === 'chapters') {
      currentSidebarTab.value = 'chapters';
      loadChapters();
      return;
    }
    currentSidebarTab.value = item.entityType || null;
    if (item.entityType) loadEntityList(item.entityType);
  };

  return {
    entityLists,
    chapters,
    sidebarSearch,
    currentSidebarTab,
    filteredEntityList,
    activeSidebarItem,
    loadEntityList,
    loadChapters,
    selectSidebarTab,
  };
}