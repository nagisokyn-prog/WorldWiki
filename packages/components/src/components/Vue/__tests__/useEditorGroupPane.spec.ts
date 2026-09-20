import { describe, it, expect, vi } from 'vitest';
import { useEditorGroupPane } from '../useEditorGroupPane';
import type { EditorGroupPaneProps, EditorTab } from '../EditorGroupPane.model';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('useEditorGroupPane', () => {
  const sampleTab: EditorTab = {
    id: 'tab-1',
    rawId: 'raw-1',
    title: 'Test Tab',
    entityType: 'char',
    tabType: 'entity',
    data: {},
    unsaved: false,
  };

  it('computes activeTab based on activeTabId', () => {
    const emit = vi.fn();
    const props: EditorGroupPaneProps = {
      group: {
        id: 'group-1',
        tabs: [sampleTab],
        activeTabId: 'tab-1',
        flexBasis: 1,
      },
      isActive: true,
      canClose: true,
    };

    const { activeTab } = useEditorGroupPane(props, emit as any);
    expect(activeTab.value).toEqual(sampleTab);
  });

  it('handles tab events symmetrically', () => {
    const emit = vi.fn();
    const props: EditorGroupPaneProps = {
      group: {
        id: 'group-1',
        tabs: [sampleTab],
        activeTabId: 'tab-1',
        flexBasis: 1,
      },
      isActive: true,
      canClose: true,
    };

    const { handleActivateTab, handleCloseTab, handleSplit } = useEditorGroupPane(props, emit as any);

    handleActivateTab('tab-1');
    expect(emit).toHaveBeenCalledWith('activate-tab', 'group-1', 'tab-1');

    handleCloseTab('tab-1');
    expect(emit).toHaveBeenCalledWith('close-tab', 'group-1', 'tab-1');

    handleSplit();
    expect(emit).toHaveBeenCalledWith('split', 'group-1');
  });
});
