import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useShellQuickOpen, type QuickOpenDeps } from './shell.quickopen';
import type { SidebarItem } from './shell.types';

const mockGetChapters = vi.fn();
const mockGetEntities = vi.fn();
const mockGetStoryArcs = vi.fn();

vi.mock('@/services/api.client', () => ({
  getChapters: (...args: unknown[]) => mockGetChapters(...args),
  getEntities: (...args: unknown[]) => mockGetEntities(...args),
  getStoryArcs: (...args: unknown[]) => mockGetStoryArcs(...args)
}));

describe('shell.quickopen', () => {
  let deps: QuickOpenDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = {
      projectName: ref('proj-1'),
      sidebarItems: ref<SidebarItem[]>([
        { type: 'chapters', title: 'Главы' },
        { type: 'entity', title: 'Персонажи', entityType: 'character', icon: '🧑' },
        { type: 'entity', title: 'Локации', entityType: 'location' }
      ]),
      schema: {
        getEntityDisplayName: vi.fn((ent: Record<string, unknown>) => String(ent.name || 'Unnamed'))
      } as unknown as QuickOpenDeps['schema'],
      openChapterTab: vi.fn(),
      openEntity: vi.fn(),
      setActivePanelTab: vi.fn()
    };
  });

  it('builds quickOpenDataSource from chapters and sidebar entity tabs and handles errors', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const qo = useShellQuickOpen(deps);

    mockGetChapters.mockResolvedValueOnce([{ id: 'c1', title: '' }]);
    mockGetEntities.mockImplementation(async (_proj: string, type: string) => {
      if (type === 'character') return [{ id: 'e1', name: 'Алиса' }];
      throw new Error('location fetch err');
    });

    const items = await qo.quickOpenDataSource();
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: 'chapter_c1', title: 'Глава c1', entityType: 'chapter' });
    expect(items[1]).toMatchObject({ id: 'entity_character_e1', title: 'Алиса', emoji: '🧑' });

    // Chapters fetch failure still continues to entities
    mockGetChapters.mockRejectedValueOnce(new Error('ch fail'));
    mockGetEntities.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'l1', name: 'Замок' }]);
    const items2 = await qo.quickOpenDataSource();
    expect(items2).toHaveLength(1);
    expect(items2[0]).toMatchObject({ id: 'entity_location_l1', emoji: '📄' });

    qo.handleQuickOpenSelect(items[0]);
    expect(deps.openChapterTab).toHaveBeenCalled();

    qo.handleQuickOpenSelect(items[1]);
    expect(deps.openEntity).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('updates paletteCommands across chapters, entities, story arcs, and panel tools, and opens modals', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const qo = useShellQuickOpen(deps);

    mockGetChapters.mockResolvedValueOnce([{ id: 'c1', title: 'Начало' }]);
    mockGetEntities
      .mockResolvedValueOnce([{ id: 'e1', name: 'Боб' }])
      .mockResolvedValueOnce([]);
    mockGetStoryArcs.mockResolvedValueOnce([
      { id: 'a1', title: 'Месть' },
      { id: 'a2', title: '' }
    ]);

    await qo.updatePaletteCommands();
    const expectedMin = typeof __FEATURE_RAZRAB__ !== 'undefined' && __FEATURE_RAZRAB__ ? 10 : 9;
    expect(qo.paletteCommands.value.length).toBeGreaterThanOrEqual(expectedMin);

    // Execute actions on generated commands
    const chCmd = qo.paletteCommands.value.find((c) => c.id === 'cmd_ch_c1');
    const entCmd = qo.paletteCommands.value.find((c) => c.id === 'cmd_ent_e1');
    const arcCmd = qo.paletteCommands.value.find((c) => c.id === 'cmd_arc_a1');
    chCmd?.action();
    entCmd?.action();
    arcCmd?.action();
    expect(deps.openChapterTab).toHaveBeenCalled();
    expect(deps.openEntity).toHaveBeenCalledWith({ id: 'e1', name: 'Боб', entityType: 'character' });
    expect(deps.setActivePanelTab).toHaveBeenCalledWith('arc-board');

    // Execute all 7 tool commands
    const toolIds = [
      'tool_arc_board',
      'tool_matrix',
      'tool_consistency',
      'tool_chekhov_guns',
      'tool_graph_web',
      'tool_timeline_inspector',
      ...(typeof __FEATURE_RAZRAB__ !== 'undefined' && __FEATURE_RAZRAB__ ? ['tool_surreal'] : [])
    ];
    for (const tid of toolIds) {
      qo.paletteCommands.value.find((c) => c.id === tid)?.action();
    }
    if (typeof __FEATURE_RAZRAB__ !== 'undefined' && __FEATURE_RAZRAB__) {
      expect(deps.setActivePanelTab).toHaveBeenCalledWith('surreal');
    } else {
      expect(qo.paletteCommands.value.find((c) => c.id === 'tool_surreal')).toBeUndefined();
    }

    // Error paths in updatePaletteCommands + missing setActivePanelTab
    const qoNoPanel = useShellQuickOpen({ ...deps, setActivePanelTab: undefined });
    mockGetChapters.mockRejectedValueOnce(new Error('ch err'));
    mockGetEntities.mockRejectedValueOnce(new Error('ent err')).mockRejectedValueOnce(new Error('ent err 2'));
    mockGetStoryArcs.mockRejectedValueOnce(new Error('arc err'));
    await qoNoPanel.updatePaletteCommands();
    expect(qoNoPanel.paletteCommands.value).toEqual([]);

    // Modal refs open helpers
    const openQO = vi.fn();
    const openTags = vi.fn();
    const openPalette = vi.fn();
    qo.quickOpenRef.value = { open: openQO };
    qo.tagsManagerRef.value = { open: openTags };
    qo.commandPaletteRef.value = { open: openPalette };

    qo.openQuickOpen();
    qo.openTagsManager();
    await qo.openCommandPalette();
    expect(openQO).toHaveBeenCalled();
    expect(openTags).toHaveBeenCalled();
    expect(openPalette).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
