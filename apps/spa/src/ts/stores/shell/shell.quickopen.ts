/**
 * @file shell.quickopen.ts
 * @description Быстрый поиск, палитра команд и диалоги
 */

import { ref, type Ref } from 'vue';
import * as api from '../../services/api.client';
import type { Chapter } from '../../types/generated/Chapter';
import type { useSchemaStore } from '../schema';
import type { QuickOpenItem, SidebarItem } from './shell.types';

export interface QuickOpenDeps {
  projectName: Ref<string>;
  sidebarItems: Ref<SidebarItem[]>;
  schema: ReturnType<typeof useSchemaStore>;
  openChapterTab: (chapter: Chapter) => void;
  openEntity: (entity: Record<string, unknown>) => void;
}

export function useShellQuickOpen(deps: QuickOpenDeps) {
  const quickOpenRef = ref<{ open: () => void; close?: () => void } | null>(null);
  const commandPaletteRef = ref<{ open: () => void; close?: () => void } | null>(null);
  const tagsManagerRef = ref<{ open: () => void; close?: () => void } | null>(null);

  const quickOpenDataSource = async (): Promise<QuickOpenItem[]> => {
    const items: QuickOpenItem[] = [];
    try {
      const list = await api.getChapters('');
      for (const c of list) {
        items.push({
          id: `chapter_${c.id}`,
          rawId: String(c.id),
          title: c.title || `Глава ${c.id}`,
          typeLabel: 'Глава',
          entityType: 'chapter',
          emoji: '📝',
          data: c as unknown as Record<string, unknown>
        });
      }
    } catch (err) {
      console.warn('[shell.quickopen] Failed to load chapters for quickopen:', err);
    }

    for (const tab of deps.sidebarItems.value) {
      if (tab.type === 'entity' && tab.entityType) {
        try {
          const list = await api.getEntities(deps.projectName.value, tab.entityType);
          for (const e of list) {
            items.push({
              id: `entity_${tab.entityType}_${e.id}`,
              rawId: String(e.id),
              title: deps.schema.getEntityDisplayName(e as Record<string, unknown>, tab.entityType),
              typeLabel: tab.title,
              entityType: tab.entityType,
              emoji: tab.icon || '📄',
              data: { ...e, entityType: tab.entityType } as Record<string, unknown>
            });
          }
        } catch (err) {
          console.warn(`[shell.quickopen] Failed to load entities of type ${tab.entityType} for quickopen:`, err);
        }
      }
    }
    return items;
  };

  const handleQuickOpenSelect = (item: QuickOpenItem) => {
    if (item.entityType === 'chapter') {
      deps.openChapterTab(item.data as unknown as Chapter);
    } else {
      deps.openEntity(item.data);
    }
  };

  const openQuickOpen = () => quickOpenRef.value?.open?.();
  const openTagsManager = () => tagsManagerRef.value?.open?.();

  return {
    quickOpenRef,
    commandPaletteRef,
    tagsManagerRef,
    quickOpenDataSource,
    handleQuickOpenSelect,
    openQuickOpen,
    openTagsManager
  };
}
