import { ref } from 'vue';

export function useQuickOpen(ctx: {
  projectName: string;
  lists: {
    chapters: { value: any[] };
    currentSidebarTab: { value: string | null };
  };
  tabs: {
    openChapterTab: (chapter: any) => void;
    openEntity: (entity: any) => void;
  };
  schema: {
    getEntityDisplayName: (entity: Record<string, unknown>, entityType?: string) => string;
  };
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
}) {
  const quickOpenRef = ref<{ open?: () => void } | null>(null);

  const quickOpenDataSource = async (): Promise<any[]> => {
    const items: any[] = [];
    try {
      const { apiService } = await import('../services/api.service');
      const list = await apiService.getChaptersList(ctx.projectName);
      for (const c of list as Array<any>) {
        items.push({
          id: `chapter_${c.id}`,
          rawId: String(c.id),
          title: c.title || `Глава ${c.id}`,
          typeLabel: 'Глава',
          entityType: 'chapter',
          emoji: '📝',
          data: c,
        });
      }
    } catch (e) {}

    const sidebarItems = (window as any).__sidebarItems || [];
    for (const tab of sidebarItems) {
      if (tab.type === 'entity' && tab.entityType) {
        try {
          const { apiService } = await import('../services/api.service');
          const list = await apiService.getEntityList(ctx.projectName, tab.entityType);
          for (const e of list as Array<any>) {
            items.push({
              id: `entity_${tab.entityType}_${e.id}`,
              rawId: String(e.id),
              title: ctx.schema.getEntityDisplayName(e, tab.entityType),
              typeLabel: tab.title,
              entityType: tab.entityType,
              emoji: tab.icon || '📄',
              data: { ...e, entityType: tab.entityType },
            });
          }
        } catch (e) {}
      }
    }
    return items;
  };

  const handleQuickOpenSelect = (item: any) => {
    if (item.entityType === 'chapter') {
      ctx.tabs.openChapterTab(item.data);
    } else {
      ctx.tabs.openEntity(item.data);
    }
  };

  const openQuickOpen = () => quickOpenRef.value?.open?.();

  return {
    quickOpenRef,
    quickOpenDataSource,
    handleQuickOpenSelect,
    openQuickOpen,
  };
}