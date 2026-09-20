import type { Ref, ComputedRef } from 'vue';
import type { useEditorGroups } from '@worldwiki/components';
import { entityApi } from '../../services/Entity/entity.api';
import type { Chapter } from '../../types/generated/Chapter';
import type { useSchemaStore } from '../schema';
import type { useShellLayout } from './shell.layout';
import type { useShellPersistence } from './shell.persistence';
import type { SidebarItem, EditorTab } from './shell.types';

export interface ShellNavigationDeps {
  eg: ReturnType<typeof useEditorGroups>;
  projectName: Ref<string>;
  schema: ReturnType<typeof useSchemaStore>;
  layout: ReturnType<typeof useShellLayout>;
  persistence: ReturnType<typeof useShellPersistence>;
  activeEditor: ComputedRef<EditorTab | null>;
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  addToast: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  loadEntityList: (entityType: string) => Promise<void>;
}

export function useShellNavigation(deps: ShellNavigationDeps) {
  const closeEditor = async (id: string, force = false) => {
    await deps.eg.closeTab(id, force);
    deps.addLog(`Editor -> Closed [${id}]`, 'warn');
  };

  const closeAllTabs = async () => await deps.eg.closeAll();

  const markUnsaved = (tabId?: string) => {
    const id = tabId ?? deps.activeEditor.value?.id;
    if (id) deps.eg.markTabUnsaved(id);
  };

  const markSaved = (tabId?: string) => {
    const id = tabId ?? deps.activeEditor.value?.id;
    if (id) {
      deps.eg.markTabSaved(id);
      deps.addToast('Глава сохранена', 'success');
    }
  };

  const openEntity = async (entity: { id?: string | number; entityType?: string; entity_type?: string; Name?: string; name?: string; title?: string; [key: string]: unknown }) => {
    const entityType = entity.entityType || entity.entity_type;
    if (!entityType) return;
    if (!entity.id || entity.id === 'undefined') {
      deps.addLog(`Editor -> Error: попытка открыть сущность без ID (${entityType})`, 'error');
      return;
    }
    const rawId = String(entity.id);
    const tabId = `entity:${entityType}:${rawId}`;
    if (!deps.eg.findTabGlobal(tabId)) {
      try {
        await deps.schema.loadSchema(entityType);
        const detail = await entityApi.getEntity(deps.projectName.value, entityType, rawId);
        const tabTitle = entity.Name || entity.name || entity.title || deps.schema.getEntityDisplayName(detail as Record<string, unknown>, entityType);
        deps.eg.openTab({
          id: tabId,
          rawId,
          title: tabTitle,
          entityType,
          tabType: 'entity',
          data: (detail || {}) as Record<string, unknown>,
          unsaved: false,
        });
        deps.addLog(`Editor -> Opened ${entityType} [${tabTitle}]`, 'info');
      } catch (e) {
        deps.addLog(`Editor -> Error opening: ${e}`, 'error');
        return;
      }
    } else {
      const g = deps.eg.findGroupByTab(tabId);
      if (g) {
        g.activeTabId = tabId;
        deps.eg.activeGroupId.value = g.id;
      }
    }
    deps.layout.showSettings.value = false;
    deps.layout.activeView.value = 'entity';
  };

  const openChapterTab = (chapter: Chapter | { id?: string | number; title?: string; [key: string]: unknown }) => {
    const id = String(chapter.id);
    if (!deps.eg.findTabGlobal(id)) {
      deps.eg.openTab({
        id,
        rawId: id,
        title: chapter.title || `Глава ${id}`,
        entityType: 'chapter',
        tabType: 'chapter',
        data: chapter as Record<string, unknown>,
        unsaved: false,
      });
    } else {
      const g = deps.eg.findGroupByTab(id);
      if (g) {
        g.activeTabId = id;
        deps.eg.activeGroupId.value = g.id;
      }
    }
    deps.layout.activeView.value = 'entity';
    deps.addLog(`Editor -> Chapter [${chapter.title}]`, 'info');
  };

  const openSchemaEditor = async (entityType: string) => {
    if (!entityType) return;
    const tabId = `schema-editor:${entityType}`;
    if (!deps.eg.findTabGlobal(tabId)) {
      deps.eg.openTab({
        id: tabId,
        rawId: entityType,
        title: `Схема: ${entityType}`,
        entityType,
        tabType: 'schema-editor',
        data: {},
        unsaved: false,
      });
      deps.addLog(`Editor -> Opened Schema Editor for ${entityType}`, 'info');
    } else {
      const g = deps.eg.findGroupByTab(tabId);
      if (g) {
        g.activeTabId = tabId;
        deps.eg.activeGroupId.value = g.id;
      }
    }
  };

  const selectSidebarTab = (item: SidebarItem) => {
    if (item.type === 'static' && item.url) {
      window.location.href = item.url + (item.url.includes('?') ? '&' : '?') + `project=${encodeURIComponent('')}`;
      return;
    }
    if (item.type === 'chapters') {
      deps.layout.currentSidebarTab.value = 'chapters';
      deps.layout.activeView.value = 'entity';
      deps.addLog('Navigation -> Chapters', 'info');
      return;
    }
    deps.layout.activeView.value = 'entity';
    deps.layout.currentSidebarTab.value = item.entityType || null;
    deps.addLog(`Navigation -> ${item.title}`, 'info');
    if (item.entityType) deps.loadEntityList(item.entityType);
  };

  const handleScrollChange = (groupId: string, tabId: string, scroll: number) => {
    const group = deps.eg.groups.value.find((g) => g.id === groupId);
    const tab = group?.tabs.find((t) => t.id === tabId);
    if (tab) {
      (tab as EditorTab).scrollPos = scroll;
      deps.persistence.debouncedSaveState(1000);
    }
  };

  const handleSectionChange = (groupId: string, tabId: string, sectionId: string) => {
    const group = deps.eg.groups.value.find((g) => g.id === groupId);
    const tab = group?.tabs.find((t) => t.id === tabId);
    if (tab) {
      (tab as EditorTab).activeSection = sectionId;
      deps.persistence.debouncedSaveState(500);
    }
  };

  return {
    closeEditor,
    closeAllTabs,
    markUnsaved,
    markSaved,
    openEntity,
    openChapterTab,
    openSchemaEditor,
    selectSidebarTab,
    handleScrollChange,
    handleSectionChange
  };
}
