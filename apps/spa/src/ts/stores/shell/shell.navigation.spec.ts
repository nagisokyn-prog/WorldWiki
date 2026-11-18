import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { useShellNavigation, type ShellNavigationDeps } from './shell.navigation';
import type { EditorTab } from './shell.types';
import type { Chapter } from '@/types/generated/Chapter';

const mockGetEntity = vi.fn();

vi.mock('@/services/Entity/entity.api', () => ({
  entityApi: {
    getEntity: (...args: unknown[]) => mockGetEntity(...args)
  }
}));

describe('shell.navigation', () => {
  let deps: ShellNavigationDeps;
  let tabsInGroup: EditorTab[];
  let activeGroup: { id: string; activeTabId: string | null; tabs: EditorTab[] };

  beforeEach(() => {
    vi.clearAllMocks();
    tabsInGroup = [];
    activeGroup = { id: 'g1', activeTabId: null, tabs: tabsInGroup };

    deps = {
      eg: {
        groups: ref([activeGroup]),
        activeGroupId: ref('g1'),
        closeTab: vi.fn(async () => {}),
        closeAll: vi.fn(async () => {}),
        markTabUnsaved: vi.fn(),
        markTabSaved: vi.fn(),
        findTabGlobal: vi.fn((id: string) => tabsInGroup.find((t) => t.id === id) || null),
        findGroupByTab: vi.fn((id: string) => (tabsInGroup.some((t) => t.id === id) ? activeGroup : null)),
        openTab: vi.fn((tab: EditorTab) => {
          tabsInGroup.push(tab);
          activeGroup.activeTabId = tab.id;
        })
      } as unknown as ShellNavigationDeps['eg'],
      projectName: ref('proj-1'),
      schema: {
        loadSchema: vi.fn(async () => {}),
        getEntityDisplayName: vi.fn(() => 'Fallback Name')
      } as unknown as ShellNavigationDeps['schema'],
      layout: {
        showSettings: ref(true),
        activeView: ref('settings'),
        currentSidebarTab: ref<string | null>(null)
      } as unknown as ShellNavigationDeps['layout'],
      persistence: {
        debouncedSaveState: vi.fn()
      } as unknown as ShellNavigationDeps['persistence'],
      activeEditor: computed(() => tabsInGroup[0] || null),
      addLog: vi.fn(),
      addToast: vi.fn(),
      loadEntityList: vi.fn(async () => {}),
      chapters: ref([{ id: 'chapters:c1', title: 'Первая глава' } as Chapter])
    };
  });

  it('closes editors, closes all, and marks tabs unsaved/saved', async () => {
    const nav = useShellNavigation(deps);

    await nav.closeEditor('chapters:c1', true);
    expect(deps.eg.closeTab).toHaveBeenCalledWith('chapters:c1', true);
    expect(deps.eg.closeTab).toHaveBeenCalledWith('c1', true);
    expect(deps.eg.closeTab).toHaveBeenCalledWith('chapter:c1', true);

    await nav.closeAllTabs();
    expect(deps.eg.closeAll).toHaveBeenCalled();

    nav.markUnsaved('t1');
    expect(deps.eg.markTabUnsaved).toHaveBeenCalledWith('t1');

    nav.markSaved('t1');
    expect(deps.eg.markTabSaved).toHaveBeenCalledWith('t1');
    expect(deps.addToast).toHaveBeenCalledWith('Глава сохранена', 'success');

    // No active editor and no id -> no-op
    vi.clearAllMocks();
    nav.markUnsaved();
    nav.markSaved();
    expect(deps.eg.markTabUnsaved).not.toHaveBeenCalled();
    expect(deps.eg.markTabSaved).not.toHaveBeenCalled();
  });

  it('opens planet/calendar and regular entities, focuses existing tabs, and handles errors', async () => {
    const nav = useShellNavigation(deps);

    // Guards
    await nav.openEntity({ id: '1' });
    await nav.openEntity({ entityType: 'character' });
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining('без ID'), 'error');

    // Planet tab open + focus existing
    await nav.openEntity({ entityType: 'planet', id: 'planets:p1', name: 'Земля' });
    expect(deps.eg.openTab).toHaveBeenCalledWith(expect.objectContaining({ id: 'entity:planet:p1', title: 'Земля' }));
    expect(deps.layout.showSettings.value).toBe(false);
    expect(deps.layout.activeView.value).toBe('entity');

    await nav.openEntity({ entityType: 'planet', id: 'p1' });
    expect(deps.eg.openTab).toHaveBeenCalledTimes(1);

    // Regular entity open + focus existing + error
    mockGetEntity.mockResolvedValueOnce({ name: 'Алиса' });
    await nav.openEntity({ entityType: 'character', id: 'characters:c1' });
    expect(deps.eg.openTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'entity:character:c1', title: 'Fallback Name' })
    );

    await nav.openEntity({ entityType: 'character', id: 'c1' });
    expect(deps.eg.openTab).toHaveBeenCalledTimes(2);

    mockGetEntity.mockRejectedValueOnce(new Error('fetch err'));
    await nav.openEntity({ entityType: 'character', id: 'c2' });
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining('Error opening'), 'error');
  });

  it('opens chapter tabs, schema editor tabs, switches sidebar tabs, and updates scroll/section', async () => {
    const nav = useShellNavigation(deps);

    // Open chapter by string ID (found in deps.chapters and fallback)
    nav.openChapterTab('chapters:c1');
    expect(deps.eg.openTab).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', title: 'Первая глава' }));
    nav.openChapterTab('c1'); // focus existing
    nav.openChapterTab({ id: 'chapters:c2' }); // object without title -> fallback

    await nav.openSchemaEditor('');
    await nav.openSchemaEditor('character');
    expect(deps.eg.openTab).toHaveBeenCalledWith(expect.objectContaining({ id: 'schema-editor:character' }));
    await nav.openSchemaEditor('character'); // focus existing

    nav.selectSidebarTab({ type: 'chapters', title: 'Главы' });
    expect(deps.layout.currentSidebarTab.value).toBe('chapters');

    nav.selectSidebarTab({ type: 'entity', title: 'Персонажи', entityType: 'character' });
    expect(deps.layout.currentSidebarTab.value).toBe('character');
    expect(deps.loadEntityList).toHaveBeenCalledWith('character');

    nav.handleScrollChange('g1', 'c1', 250);
    expect(tabsInGroup[0].scrollPos).toBe(250);
    expect(deps.persistence.debouncedSaveState).toHaveBeenCalledWith(1000);

    nav.handleSectionChange('g1', 'c1', 'sec-2');
    expect(tabsInGroup[0].activeSection).toBe('sec-2');
    expect(deps.persistence.debouncedSaveState).toHaveBeenCalledWith(500);
  });
});
