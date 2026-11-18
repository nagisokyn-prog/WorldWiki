import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useShellPersistence } from './shell.persistence';
import * as api from '@/services/api.client';
import { entityApi } from '@/services/Entity/entity.api';

vi.mock('@/services/api.client', () => ({
  getPlanetCalendarBundle: vi.fn(),
  getChapter: vi.fn(),
}));

vi.mock('@/services/Entity/entity.api', () => ({
  entityApi: {
    getEntity: vi.fn(),
  },
}));

describe('useShellPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  function createDeps() {
    const group = { id: 'g1', tabs: [] as any[], activeTabId: null as string | null };
    return {
      projectName: ref('proj_1'),
      activeView: ref('entity'),
      currentSidebarTab: ref<string | null>(null),
      activePanelTab: ref(''),
      activeTreeNode: ref(null),
      eg: {
        groups: ref([group]),
        activeGroupId: ref('g1'),
        serializeState: vi.fn(() => [group]),
        restoreState: vi.fn(),
        closeAll: vi.fn(),
      } as any,
      schema: {
        loadSchema: vi.fn().mockResolvedValue({}),
      } as any,
    };
  }

  it('saves state, debounces save, and returns false when no saved state exists', async () => {
    vi.useFakeTimers();
    const deps = createDeps();
    const persistence = useShellPersistence(deps);

    expect(await persistence.restoreState()).toBe(false);
    expect(deps.eg.closeAll).toHaveBeenCalledWith(true);

    persistence.debouncedSaveState(100);
    persistence.debouncedSaveState(100);
    vi.advanceTimersByTime(150);
    expect(localStorage.getItem('worldwiki-state-proj_1')).not.toBeNull();
    vi.useRealTimers();
  });

  it('restores entity, planet, calendar, chapter, and schema-editor tabs from editorGroups', async () => {
    const deps = createDeps();
    const persistence = useShellPersistence(deps);

    localStorage.setItem(
      'worldwiki-state-proj_1',
      JSON.stringify({
        activeView: 'chapter',
        currentSidebarTab: 'character',
        activePanelTab: 'planning',
        editorGroups: [
          {
            id: 'g1',
            tabs: [
              { id: 't_planet', tabType: 'entity', entityType: 'planet', rawId: 'p1', title: 'Earth' },
              { id: 't_cal', tabType: 'entity', entityType: 'calendar', rawId: 'c1', title: 'Gregorian' },
              { id: 't_ent', tabType: 'entity', entityType: 'character', rawId: 'e1', title: 'Hero' },
              { id: 't_ent', tabType: 'entity', entityType: 'character', rawId: 'e1', title: 'Dup' },
              { id: 't_ch', tabType: 'chapter', rawId: 'ch1', title: 'Ch1' },
              { id: 't_sch', tabType: 'schema-editor', rawId: 's1', title: 'Schema' },
            ],
          },
        ],
      })
    );

    vi.mocked(api.getPlanetCalendarBundle).mockResolvedValueOnce({
      planets: [{ id: 'planets:p1', name: 'Earth' }],
      calendars: [{ id: 'c1', name: 'Gregorian' }],
    } as any);
    vi.mocked(entityApi.getEntity).mockResolvedValueOnce({ id: 'entities:e1', name: 'Hero' } as any);
    vi.mocked(api.getChapter).mockResolvedValueOnce({ id: 'chapters:ch1', title: 'Ch1' } as any);

    expect(await persistence.restoreState()).toBe(true);
    expect(deps.eg.restoreState).toHaveBeenCalled();
  });

  it('restores legacy openTabs format and handles tab/JSON errors', async () => {
    const deps = createDeps();
    const persistence = useShellPersistence(deps);

    localStorage.setItem(
      'worldwiki-state-proj_1',
      JSON.stringify({
        openTabs: [{ id: 't_ch', tabType: 'chapter', rawId: 'ch1', title: 'Ch1' }],
        activeEditorId: 't_ch',
      })
    );
    vi.mocked(api.getChapter).mockResolvedValueOnce({ id: 'chapters:ch1', title: 'Ch1' } as any);
    expect(await persistence.restoreState()).toBe(true);
    expect(deps.eg.groups.value[0].activeTabId).toBe('t_ch');

    // Corrupt JSON
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('worldwiki-state-proj_1', '{bad');
    expect(await persistence.restoreState()).toBe(false);
    errSpy.mockRestore();
  });
});
