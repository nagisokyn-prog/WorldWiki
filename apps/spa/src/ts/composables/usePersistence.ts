import { apiService } from '../services/api.service';

export interface UsePersistenceProps {
  projectName: string;
  activeView: any;
  currentSidebarTab: any;
  activePanelTab: any;
  activeTreeNode: any;
  eg: any; // Editor groups
  loadSchema: (entityType: string) => Promise<any>;
}

export function usePersistence({
  projectName,
  activeView,
  currentSidebarTab,
  activePanelTab,
  activeTreeNode,
  eg,
  loadSchema
}: UsePersistenceProps) {
  const STATE_KEY = `worldwiki-state-${projectName}`;
  let isRestoring = false;

  const saveState = () => {
    if (isRestoring) return;
    const state = {
      activeView: activeView.value,
      currentSidebarTab: currentSidebarTab.value,
      activePanelTab: activePanelTab.value,
      activeTreeNode: activeTreeNode.value,
      editorGroups: eg.serializeState(),
      activeGroupId: eg.activeGroupId.value,
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  };

  const restoreState = async () => {
    const saved = localStorage.getItem(STATE_KEY);
    if (!saved) return false;
    isRestoring = true;
    try {
      const state = JSON.parse(saved);
      activeView.value = state.activeView || 'entity';
      currentSidebarTab.value = state.currentSidebarTab || null;
      activePanelTab.value = state.activePanelTab !== undefined ? state.activePanelTab : '';
      activeTreeNode.value = state.activeTreeNode || null;

      const rawGroups = state.editorGroups;
      const rawTabs = state.openTabs; // обратная совместимость

      const tabSources: Array<{id:string;rawId:string;title:string;entityType:string;tabType:string;scrollPos?:number;activeSection?:string}> =
        rawGroups ? rawGroups.flatMap((g: any) => g.tabs) : (rawTabs || []);

      const loadedTabs = new Map<string, any>();
      for (const tab of tabSources) {
        if (loadedTabs.has(tab.id)) continue;
        try {
          if (tab.tabType === 'entity') {
            await loadSchema(tab.entityType);
            const detail = await apiService.getEntity(projectName, tab.entityType, tab.rawId);
            loadedTabs.set(tab.id, { ...tab, data: detail, unsaved: false });
          } else if (tab.tabType === 'chapter') {
            const chapter = await apiService.getChapter(projectName, tab.rawId);
            if (chapter) loadedTabs.set(tab.id, { ...tab, data: chapter, unsaved: false });
          } else if (tab.tabType === 'schema-editor') {
            loadedTabs.set(tab.id, { ...tab, data: {}, unsaved: false });
          }
        } catch (e) { console.warn(`Failed to restore tab ${tab.id}`, e); }
      }

      if (rawGroups) {
        eg.restoreState(rawGroups, loadedTabs);
      } else {
        const group = eg.groups.value[0];
        for (const [, tab] of loadedTabs) {
          group.tabs.push(tab as any);
        }
        if (state.activeEditorId && loadedTabs.has(state.activeEditorId)) {
          group.activeTabId = state.activeEditorId;
        } else if (group.tabs.length > 0) {
          group.activeTabId = group.tabs[0].id;
        }
      }

      isRestoring = false;
      return true;
    } catch (e) {
      console.warn('Failed to restore app state', e);
      isRestoring = false;
      return false;
    }
  };

  return {
    isRestoring: () => isRestoring,
    saveState,
    restoreState
  };
}
