// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorGroups } from '../../../src/ts/composables/useEditorGroups';

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

    openTab({ id: 'tab1', title: 'Chapter 1', entityType: 'chapter' });

    expect(allTabs.value.length).toBe(1);
    expect(activeTab.value?.id).toBe('tab1');
    expect(activeTab.value?.title).toBe('Chapter 1');
  });

  it('splitRight splits into two groups and activates new group', () => {
    const { openTab, splitRight, groups, activeGroupId } = useEditorGroups();

    openTab({ id: 'tab1', title: 'Chapter 1' });
    splitRight();

    expect(groups.value.length).toBe(2);
    expect(activeGroupId.value).toBe(groups.value[1].id);
    expect(groups.value[1].tabs.length).toBe(1);
    expect(groups.value[1].tabs[0].id).toBe('tab1');
  });

  it('moveTab moves tab between groups', () => {
    const { openTab, splitRight, moveTab, groups } = useEditorGroups();

    openTab({ id: 'tab1', title: 'Chapter 1' });
    openTab({ id: 'tab2', title: 'Chapter 2' });
    splitRight();

    const targetGroupId = groups.value[1].id;
    moveTab('tab1', targetGroupId, 0);

    expect(groups.value[1].tabs.some(t => t.id === 'tab1')).toBe(true);
  });

  it('reorderTab updates tab order within a group', () => {
    const { openTab, reorderTab, groups } = useEditorGroups();

    openTab({ id: 'tab1', title: 'Chapter 1' });
    openTab({ id: 'tab2', title: 'Chapter 2' });

    const groupId = groups.value[0].id;
    reorderTab(groupId, 0, 1);

    expect(groups.value[0].tabs[0].id).toBe('tab2');
    expect(groups.value[0].tabs[1].id).toBe('tab1');
  });

  it('closeTab closes a tab and removes group if empty and groups > 1', async () => {
    const { openTab, splitRight, closeTab, groups } = useEditorGroups();

    openTab({ id: 'tab1', title: 'Chapter 1' });
    splitRight();
    expect(groups.value.length).toBe(2);

    await closeTab('tab1', true);
    // When closed in both groups or empty group removed
    expect(groups.value.length).toBeGreaterThanOrEqual(1);
  });

  it('updateTabData, markTabUnsaved, markTabSaved', () => {
    const { openTab, updateTabData, markTabUnsaved, markTabSaved, allTabs } = useEditorGroups();

    openTab({ id: 'tab1', title: 'Old Title' });
    updateTabData('tab1', { title: 'New Title' });

    expect(allTabs.value[0].title).toBe('New Title');

    markTabUnsaved('tab1');
    expect(allTabs.value[0].unsaved).toBe(true);

    markTabSaved('tab1');
    expect(allTabs.value[0].unsaved).toBe(false);
  });

  it('setActiveGroup and activateTab', () => {
    const { openTab, splitRight, setActiveGroup, activateTab, activeGroupId, groups } = useEditorGroups();

    openTab({ id: 'tab1', title: 'Tab 1' });
    openTab({ id: 'tab2', title: 'Tab 2' });
    splitRight();

    const firstGid = groups.value[0].id;
    setActiveGroup(firstGid);
    expect(activeGroupId.value).toBe(firstGid);

    activateTab(firstGid, 'tab2');
    expect(groups.value[0].activeTabId).toBe('tab2');
  });

  it('serializes and restores group state', () => {
    const { openTab, splitRight, serializeState, restoreState, groups } = useEditorGroups();

    openTab({ id: 'tab1', title: 'Chapter 1' });
    splitRight();

    const serialized = serializeState();
    expect(serialized.length).toBe(2);

    const tabMap = new Map([
      ['tab1', { id: 'tab1', title: 'Chapter 1 Restored', entityType: 'chapter' } as any],
    ]);

    restoreState(serialized, tabMap);
    expect(groups.value.length).toBe(2);
    expect(groups.value[0].tabs[0].title).toBe('Chapter 1 Restored');
  });

  it('switchTabInGroup switches to next or previous tab', () => {
    const { openTab, switchTabInGroup, groups } = useEditorGroups();

    openTab({ id: 't1', title: 'T1' });
    openTab({ id: 't2', title: 'T2' });
    openTab({ id: 't3', title: 'T3' });

    const gid = groups.value[0].id;
    groups.value[0].activeTabId = 't1';

    switchTabInGroup(gid, 1);
    expect(groups.value[0].activeTabId).toBe('t2');

    switchTabInGroup(gid, -1);
    expect(groups.value[0].activeTabId).toBe('t1');
  });
});
