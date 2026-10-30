/**
 * @file shell.quickopen.ts
 * @description Быстрый поиск, палитра команд и диалоги
 */

import { ref, shallowRef, type Ref } from 'vue';
import * as api from '../../services/api.client';
import type { Chapter } from '../../types/generated/Chapter';
import type { StoryArc } from '../../types/generated/StoryArc';
import type { useSchemaStore } from '../schema';
import type { QuickOpenItem, SidebarItem } from './shell.types';
import type { PaletteCommand } from '@worldwiki/components';

export interface QuickOpenDeps {
  projectName: Ref<string>;
  sidebarItems: Ref<SidebarItem[]>;
  schema: ReturnType<typeof useSchemaStore>;
  openChapterTab: (chapter: Chapter) => void;
  openEntity: (entity: Record<string, unknown>) => void;
  setActivePanelTab?: (tab: string) => void;
}

export function useShellQuickOpen(deps: QuickOpenDeps) {
  const quickOpenRef = ref<{ open: () => void; close?: () => void } | null>(null);
  const commandPaletteRef = ref<{ open: () => void; close?: () => void } | null>(null);
  const tagsManagerRef = ref<{ open: () => void; close?: () => void } | null>(null);
  const paletteCommands = shallowRef<PaletteCommand[]>([]);

  const quickOpenDataSource = async (): Promise<QuickOpenItem[]> => {
    const items: QuickOpenItem[] = [];
    try {
      const list = await api.getChapters(deps.projectName.value || '');
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

  const updatePaletteCommands = async (): Promise<void> => {
    const cmds: PaletteCommand[] = [];

    // 1. Главы рукописи
    try {
      const chaptersList = await api.getChapters(deps.projectName.value || '');
      for (const c of chaptersList) {
        const title = c.title || `Глава ${c.id}`;
        cmds.push({
          id: `cmd_ch_${c.id}`,
          title: title,
          desc: 'Глава рукописи',
          icon: '📝',
          keywords: ['глава', 'рукопись', 'chapter', title],
          action: () => deps.openChapterTab(c)
        });
      }
    } catch (e) {
      console.warn('[shell.quickopen] Failed to index chapters for palette:', e);
    }

    // 2. Сущности лора из бокового меню
    for (const tab of deps.sidebarItems.value) {
      if (tab.type === 'entity' && tab.entityType) {
        try {
          const entitiesList = await api.getEntities(deps.projectName.value, tab.entityType);
          for (const ent of entitiesList) {
            const displayName = deps.schema.getEntityDisplayName(ent as Record<string, unknown>, tab.entityType);
            cmds.push({
              id: `cmd_ent_${ent.id}`,
              title: displayName,
              desc: tab.title || tab.entityType,
              icon: tab.icon || '👤',
              keywords: ['сущность', tab.title, tab.entityType, displayName],
              action: () => deps.openEntity({ ...ent, entityType: tab.entityType })
            });
          }
        } catch (e) {
          console.warn(`[shell.quickopen] Failed to index entities of type ${tab.entityType} for palette:`, e);
        }
      }
    }

    // 3. Сюжетные арки
    try {
      const arcs = await api.getStoryArcs(deps.projectName.value || '');
      for (const arc of arcs as StoryArc[]) {
        if (arc?.title) {
          cmds.push({
            id: `cmd_arc_${arc.id}`,
            title: arc.title,
            desc: 'Сюжетная арка',
            icon: '📋',
            keywords: ['арка', 'сюжет', 'arc', arc.title],
            action: () => {
              if (deps.setActivePanelTab) {
                deps.setActivePanelTab('arc-board');
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('[shell.quickopen] Failed to index story arcs for palette:', e);
    }

    // 4. Системные действия и инструменты нижней панели
    if (deps.setActivePanelTab) {
      const setTab = deps.setActivePanelTab;
      cmds.push(
        {
          id: 'tool_arc_board',
          title: 'Открыть Канбан Арок',
          desc: 'Визуализация и фазы сюжетных линий',
          icon: '📋',
          keywords: ['канбан', 'арки', 'сюжет', 'доска'],
          action: () => setTab('arc-board')
        },
        {
          id: 'tool_matrix',
          title: 'Открыть Матрицу Участий',
          desc: 'Сетка участия сущностей в главах',
          icon: '📊',
          keywords: ['матрица', 'участия', 'персонажи', 'главы'],
          action: () => setTab('matrix')
        },
        {
          id: 'tool_consistency',
          title: 'Открыть Аудит Сюжета',
          desc: 'Проверка сюжетных нестыковок и консистентности',
          icon: '🛡️',
          keywords: ['аудит', 'сюжет', 'нестыковки', 'проверка'],
          action: () => setTab('consistency')
        },
        {
          id: 'tool_chekhov_guns',
          title: 'Открыть Чеховские Ружья',
          desc: 'Сюжетные обещания и невыстрелившие ружья',
          icon: '🗡️',
          keywords: ['ружья', 'чеховские', 'обещания', 'тайны'],
          action: () => setTab('chekhov-guns')
        },
        {
          id: 'tool_graph_web',
          title: 'Открыть Паутину Связей',
          desc: 'Интерактивный граф отношений между сущностями',
          icon: '🕸️',
          keywords: ['граф', 'связи', 'паутина', 'отношения'],
          action: () => setTab('graph-web')
        },
        {
          id: 'tool_timeline_inspector',
          title: 'Открыть Хроно-Инспектор',
          desc: 'Хронология событий и абсолютная минута',
          icon: '⏳',
          keywords: ['хронология', 'таймлайн', 'время', 'инспектор'],
          action: () => setTab('timeline-inspector')
        },
        {
          id: 'tool_surreal',
          title: 'Открыть SurrealDB SQL Консоль',
          desc: 'Прямые запросы к базе данных SurQL',
          icon: '⚡',
          keywords: ['surreal', 'sql', 'surql', 'база', 'запросы'],
          action: () => setTab('surreal')
        }
      );
    }

    paletteCommands.value = cmds;
  };

  const openQuickOpen = () => quickOpenRef.value?.open?.();
  const openTagsManager = () => tagsManagerRef.value?.open?.();

  const openCommandPalette = async () => {
    void updatePaletteCommands();
    commandPaletteRef.value?.open?.();
  };

  return {
    quickOpenRef,
    commandPaletteRef,
    tagsManagerRef,
    paletteCommands,
    quickOpenDataSource,
    handleQuickOpenSelect,
    updatePaletteCommands,
    openQuickOpen,
    openTagsManager,
    openCommandPalette
  };
}
