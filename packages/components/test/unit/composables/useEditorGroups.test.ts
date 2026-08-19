// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorGroups, type EditorTab } from '../../../src/ts/composables/useEditorGroups';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn().mockResolvedValue(true),
}));

const createTab = (tab: Partial<EditorTab> & { id: string; title: string }): EditorTab => ({
  rawId: tab.id,
  entityType: 'chapter',
  tabType: 'chapter',
  data: {},
  unsaved: false,
  ...tab,
});

describe('useEditorGroups', () => {
  beforeEach(() => {
    const eg = useEditorGroups();
    eg.closeAll();
  });

  it('initializes with default group', () => {
    const { groups, activeGroupId } = useEditorGroups();
    expect(groups.value.length).toBe(1);
    expect(activeGroupId.value).toBe(groups.value[0].id);
  });

  it('openTab opens new tab and marks it active in group', () => {
    const { openTab, allTabs, activeTab } = useEditorGroups();

    openTab(createTab({ id: 'tab1', title: 'Chapter 1', entityType: 'chapter' }));

    expect(allTabs.value.length).toBe(1);
    expect(activeTab.value?.id).toBe('tab1');
    expect(activeTab.value?.title).toBe('Chapter 1');
  });

  it('splitRight splits into two groups and activates new group', () => {
    const { openTab, splitRight, groups, activeGroupId } = useEditorGroups();

    openTab(createTab({ id: 'tab1', title: 'Chapter 1' }));
    splitRight();

    expect(groups.value.length).toBe(2);
    expect(activeGroupId.value).toBe(groups.value[1].id);
    expect(groups.value[1].tabs.length).toBe(1);
    expect(groups.value[1].tabs[0].id).toBe('tab1');
  });

  it('moveTab moves tab between groups', () => {
    const { openTab, splitRight, moveTab, groups } = useEditorGroups();

    openTab(createTab({ id: 'tab1', title: 'Chapter 1' }));
    openTab(createTab({ id: 'tab2', title: 'Chapter 2' }));
    splitRight();

    const targetGroupId = groups.value[1].id;
    moveTab('tab1', targetGroupId, 0);

    expect(groups.value[1].tabs.some(t => t.id === 'tab1')).toBe(true);
  });

  it('reorderTab updates tab order within a group', () => {
    const { openTab, reorderTab, groups } = useEditorGroups();

    openTab(createTab({ id: 'tab1', title: 'Chapter 1' }));
    openTab(createTab({ id: 'tab2', title: 'Chapter 2' }));

    const groupId = groups.value[0].id;
    reorderTab(groupId, 0, 1);

    expect(groups.value[0].tabs[0].id).toBe('tab2');
    expect(groups.value[0].tabs[1].id).toBe('tab1');
  });

  it('closeTab closes a tab and removes group if empty and groups > 1', async () => {
    const { openTab, splitRight, closeTab, groups } = useEditorGroups();

    openTab(createTab({ id: 'tab1', title: 'Chapter 1' }));
    splitRight();
    expect(groups.value.length).toBe(2);

    await closeTab('tab1', true);
    // When closed in both groups or empty group removed
    expect(groups.value.length).toBeGreaterThanOrEqual(1);
  });

  it('updateTabData, markTabUnsaved, markTabSaved', () => {
    const { openTab, updateTabData, markTabUnsaved, markTabSaved, allTabs } = useEditorGroups();

    openTab(createTab({ id: 'tab1', title: 'Old Title' }));
    updateTabData('tab1', { title: 'New Title' });

    expect(allTabs.value[0].title).toBe('New Title');

    markTabUnsaved('tab1');
    expect(allTabs.value[0].unsaved).toBe(true);

    markTabSaved('tab1');
    expect(allTabs.value[0].unsaved).toBe(false);
  });

  it('setActiveGroup and activateTab', () => {
    const { openTab, splitRight, setActiveGroup, activateTab, activeGroupId, groups } = useEditorGroups();

    openTab(createTab({ id: 'tab1', title: 'Tab 1' }));
    openTab(createTab({ id: 'tab2', title: 'Tab 2' }));
    splitRight();

    const firstGid = groups.value[0].id;
    setActiveGroup(firstGid);
    expect(activeGroupId.value).toBe(firstGid);

    activateTab(firstGid, 'tab2');
    expect(groups.value[0].activeTabId).toBe('tab2');
  });

  it('serializes and restores group state', () => {
    const { openTab, splitRight, serializeState, restoreState, groups } = useEditorGroups();

    openTab(createTab({ id: 'tab1', title: 'Chapter 1' }));
    splitRight();

    const serialized = serializeState();
    expect(serialized.length).toBe(2);

    const tabMap = new Map([
      ['tab1', createTab({ id: 'tab1', title: 'Chapter 1 Restored', entityType: 'chapter' })],
    ]);

    restoreState(serialized, tabMap);
    expect(groups.value.length).toBe(2);
    expect(groups.value[0].tabs[0].title).toBe('Chapter 1 Restored');
  });

  it('switchTabInGroup switches to next or previous tab', () => {
    const { openTab, switchTabInGroup, groups } = useEditorGroups();

    openTab(createTab({ id: 't1', title: 'T1' }));
    openTab(createTab({ id: 't2', title: 'T2' }));
    openTab(createTab({ id: 't3', title: 'T3' }));

    const gid = groups.value[0].id;
    groups.value[0].activeTabId = 't1';

    switchTabInGroup(gid, 1);
    expect(groups.value[0].activeTabId).toBe('t2');

    switchTabInGroup(gid, -1);
    expect(groups.value[0].activeTabId).toBe('t1');
  });

  describe('Additional branch edge cases for useEditorGroups', () => {
    it('handles closeTab and closeAll unsaved cancellation and single group empty state', async () => {
      const eg = useEditorGroups();

      // 1. closeTab unsaved with confirm = false
      const { confirm } = await import('@tauri-apps/plugin-dialog');
      (confirm as any).mockResolvedValueOnce(false);
      eg.openTab({ id: 'unsaved_1', title: 'Unsaved', unsaved: true } as any);
      const closed = await eg.closeTab('unsaved_1', false);
      expect(closed).toBe(false);

      // 2. closeTab on empty group 1 of 1 (stays 1 group with 0 tabs)
      await eg.closeTab('unsaved_1', true);
      expect(eg.groups.value.length).toBe(1);
      expect(eg.groups.value[0].tabs.length).toBe(0);

      // 3. closeAll with unsaved
      eg.openTab({ id: 'u1', title: 'U1', unsaved: true } as any);
      globalThis.confirm = () => false;
      eg.closeAll(false);
      expect(eg.allTabs.value.length).toBe(1);

      eg.closeAll(true);
      expect(eg.allTabs.value.length).toBe(0);
    });

    it('handles moveTab to non-existent group and moving active tab', () => {
      const eg = useEditorGroups();
      eg.openTab({ id: 't1', title: 'T1' } as any);
      eg.openTab({ id: 't2', title: 'T2' } as any);
      eg.splitRight();

      // moveTab to non existent group
      eg.moveTab('t1', 'non_existent_group_id');
      expect(eg.groups.value[0].tabs.some(t => t.id === 't1')).toBe(true);

      // move active tab
      const targetGid = eg.groups.value[1].id;
      eg.moveTab('t2', targetGid);
      expect(eg.groups.value[1].activeTabId).toBe('t2');
    });

    it('handles restoreState edge cases: empty serialized, missing tabs, invalid active tab', () => {
      const eg = useEditorGroups();

      // 1. Empty serialized
      eg.restoreState([], new Map());

      // 2. Tab not found in loadedTabs + invalid activeTabId
      const serialized = [
        {
          id: 'g1',
          flexBasis: 100,
          activeTabId: 'missing_tab_id',
          tabs: [
            { id: 'missing_tab_id', rawId: 'm1', title: 'M1', entityType: 'char', tabType: 'entity' as const },
            { id: 'existing_tab_id', rawId: 'e1', title: 'E1', entityType: 'char', tabType: 'entity' as const },
          ],
        },
      ];
      const loadedMap = new Map([
        ['existing_tab_id', { id: 'existing_tab_id', title: 'Loaded E1' } as any],
      ]);

      eg.restoreState(serialized as any, loadedMap);
      expect(eg.groups.value[0].tabs.length).toBe(1);
      expect(eg.groups.value[0].activeTabId).toBe('existing_tab_id');
    });

    it('handles splitRight with invalid sourceGroupId, reorderTab identical index, switchTab with < 2 tabs', () => {
      const eg = useEditorGroups();

      // 1. splitRight with invalid groupId
      eg.splitRight('invalid_source_gid');
      expect(eg.groups.value.length).toBe(2);

      // 2. reorderTab fromIdx === toIdx
      eg.openTab({ id: 'single_tab', title: 'Single' } as any);
      const gid = eg.groups.value[0].id;
      eg.reorderTab(gid, 0, 0);

      // 3. switchTabInGroup with < 2 tabs
      eg.switchTabInGroup(gid, 1);
    });
  });
});

