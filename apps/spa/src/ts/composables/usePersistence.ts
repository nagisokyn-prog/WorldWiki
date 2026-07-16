import { watch, type Ref } from 'vue';
import { useEditorGroups } from '@worldwiki/components';

export function usePersistence(ctx: {
  projectName: string;
  activeView: Ref<'entity' | 'chapters' | 'static' | 'sandbox'>;
  currentSidebarTab: Ref<string | null>;
  activePanelTab: Ref<string>;
  activeTreeNode: Ref<{ type: string; node: any } | null>;
}) {
  const eg = useEditorGroups();

  const STATE_KEY = `worldwiki-state-${ctx.projectName}`;
  let isRestoring = false;

  const saveState = () => {
    if (isRestoring) return;
    const state = {
      activeView: ctx.activeView.value,
      currentSidebarTab: ctx.currentSidebarTab.value,
      activePanelTab: ctx.activePanelTab.value,
      activeTreeNode: ctx.activeTreeNode.value,
      editorGroups: eg.serializeState(),
      activeGroupId: eg.activeGroupId.value,
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  };

  const restoreState = async (): Promise<boolean> => {
    const saved = localStorage.getItem(STATE_KEY);
    if (!saved) return false;
    isRestoring = true;
    try {
      const state = JSON.parse(saved);
      ctx.activeView.value = state.activeView || 'entity';
      ctx.currentSidebarTab.value = state.currentSidebarTab || null;
      ctx.activePanelTab.value = state.activePanelTab ?? '';
      ctx.activeTreeNode.value = state.activeTreeNode || null;
      const rawGroups = state.editorGroups;
      const rawTabs = state.openTabs;
      const tabSources = rawGroups ? rawGroups.flatMap((g: any) => g.tabs) : (rawTabs || []);
      const loadedTabs = new Map<string, any>();
      for (const tab of tabSources) {
        if (loadedTabs.has(tab.id)) continue;
        loadedTabs.set(tab.id, { ...tab, data: {}, unsaved: false });
      }
      if (rawGroups) eg.restoreState(rawGroups, loadedTabs);
      else {
        const group = eg.groups.value[0];
        for (const [, tab] of loadedTabs) group.tabs.push(tab as any);
        if (state.activeEditorId && loadedTabs.has(state.activeEditorId)) group.activeTabId = state.activeEditorId;
        else if (group.tabs.length > 0) group.activeTabId = group.tabs[0].id;
      }
      isRestoring = false;
      return true;
    } catch (e) {
      console.warn('Failed to restore app state', e);
      isRestoring = false;
      return false;
    }
  };

  watch([ctx.activePanelTab, ctx.currentSidebarTab, ctx.activeView, ctx.activeTreeNode], () => {
    if (!isRestoring) saveState();
  });
  watch(eg.groups, saveState, { deep: true });

  return { saveState, restoreState };
}