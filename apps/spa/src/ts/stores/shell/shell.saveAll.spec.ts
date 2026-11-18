import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { executeSaveAll, type SaveAllDeps } from './shell.saveAll';
import type { EditorTab } from './shell.types';

const mockSaveEntityWithRelations = vi.fn();
const mockGetEntity = vi.fn();
const mockFormatEntityPayload = vi.fn((project: string, type: string, data: Record<string, unknown>, id: string, name: string) => ({
  id,
  project_id: project,
  entity_type: type,
  name,
  data
}));
const mockSaveCalendar = vi.fn();
const mockTauriEmit = vi.fn();

vi.mock('@/services/api.client', () => ({
  saveEntityWithRelations: (...args: unknown[]) => mockSaveEntityWithRelations(...args)
}));

vi.mock('@/services/Entity/entity.api', () => ({
  entityApi: {
    getEntity: (...args: unknown[]) => mockGetEntity(...args),
    formatEntityPayload: (...args: unknown[]) => mockFormatEntityPayload(...args)
  }
}));

vi.mock('../calendar.store', () => ({
  useCalendarStore: () => ({
    saveCalendar: (...args: unknown[]) => mockSaveCalendar(...args)
  })
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: (...args: unknown[]) => mockTauriEmit(...args)
}));

describe('shell.saveAll', () => {
  let deps: SaveAllDeps;
  let treeLoad: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    treeLoad = vi.fn(async () => {});
    deps = {
      projectName: ref('my-proj'),
      openEditors: ref<EditorTab[]>([]),
      chapterTreeRef: ref({ load: treeLoad }),
      currentSidebarTab: ref<string | null>('character'),
      addLog: vi.fn(),
      addToast: vi.fn(),
      markSaved: vi.fn(),
      loadEntityList: vi.fn(async () => {}),
      getEntityDisplayName: vi.fn((data) => String(data.name || 'Entity'))
    };
  });

  it('handles clean tabs, chapter, schema-editor, planet, and calendar tabs (including calendar error)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const events: string[] = [];
    const onChapter = () => events.push('chapter');
    const onSchema = () => events.push('schema');
    const onCal = () => events.push('calendar');
    const onPlanet = () => events.push('planet');
    document.addEventListener('ww:trigger-chapter-save', onChapter);
    document.addEventListener('ww:trigger-schema-save', onSchema);
    document.addEventListener('ww:trigger-calendar-save', onCal);
    document.addEventListener('ww:trigger-planet-save', onPlanet);

    deps.openEditors.value = [
      { id: 't0', tabType: 'entity', entityType: 'character', rawId: 'c0', title: 'Clean', unsaved: false } as EditorTab,
      { id: 't1', tabType: 'chapter', entityType: 'chapter', rawId: 'ch1', title: 'Ch1', unsaved: true } as EditorTab,
      { id: 't2', tabType: 'schema-editor', entityType: 'character', rawId: 's1', title: 'Schema', unsaved: true } as EditorTab,
      { id: 't3', tabType: 'entity', entityType: 'planet', rawId: 'pl1', title: 'Planet', unsaved: true } as EditorTab,
      { id: 't4', tabType: 'entity', entityType: 'calendar', rawId: 'cal1', title: 'Cal1', unsaved: true, data: {} } as EditorTab,
      { id: 't5', tabType: 'entity', entityType: 'calendar', rawId: 'cal2', title: 'Cal2', unsaved: true, data: {} } as EditorTab
    ];

    mockSaveCalendar
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('cal fail'));

    await executeSaveAll(deps);

    expect(events).toEqual(['chapter', 'schema', 'planet', 'calendar', 'calendar']);
    expect(deps.markSaved).toHaveBeenCalledWith('t2');
    expect(deps.markSaved).toHaveBeenCalledWith('t3');
    expect(deps.markSaved).toHaveBeenCalledWith('t4');
    expect(deps.addToast).toHaveBeenCalledWith('Успешно сохранено: 2', 'success');

    document.removeEventListener('ww:trigger-chapter-save', onChapter);
    document.removeEventListener('ww:trigger-schema-save', onSchema);
    document.removeEventListener('ww:trigger-calendar-save', onCal);
    document.removeEventListener('ww:trigger-planet-save', onPlanet);
    errSpy.mockRestore();
  });

  it('saves entity with bidirectional foreign updates (add, update, delete) and handles errors', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        sections: [
          {
            dynamicContainers: [
              {
                id: 'rels',
                dataPath: 'rels',
                template: 'bidi',
              }
            ]
          }
        ],
        templates: {
          bidi: {
            isBidirectional: true,
            bidirectionalLinkClass: 'target_id',
            fields: [{ class: 'target_id', entityType: 'character' }]
          }
        }
      })
    } as unknown as Response);

    const targetOpenTab = {
      id: 'tab-foreign',
      tabType: 'entity',
      entityType: 'character',
      rawId: 'c2',
      title: 'Боб',
      unsaved: false,
      data: { rels: [] }
    } as unknown as EditorTab;

    const mainTab = {
      id: 'tab-main',
      tabType: 'entity',
      entityType: 'character',
      rawId: 'c1',
      title: 'Old Title',
      unsaved: true,
      data: {
        name: 'Алиса',
        rels: [{ target_id: 'c2' }]
      },
      _foreignUpdates: {
        'character:c2': {
          entityType: 'character',
          entityId: 'c2',
          dataPath: 'rels',
          linkClass: 'target_id',
          item: { role: 'friend' }
        },
        invalid: null
      }
    } as unknown as EditorTab;

    deps.openEditors.value = [mainTab, targetOpenTab];

    mockGetEntity.mockImplementation(async (_p: string, _t: string, id: string) => {
      if (id === 'c1') {
        return {
          rels: [{ target_id: 'c2' }, { target_id: 'c3' }]
        };
      }
      if (id === 'c2') {
        return { name: 'Боб', rels: [{ target_id: 'entities:c1', role: 'old' }] };
      }
      if (id === 'c3') {
        return { name: 'Удаляемый', rels: [{ target_id: 'entities:c1' }, { target_id: 'entities:other' }] };
      }
      return null;
    });

    mockSaveEntityWithRelations.mockResolvedValueOnce({ id: 'entities:c1' });
    mockTauriEmit.mockResolvedValue(undefined);

    await executeSaveAll(deps);

    expect(mockSaveEntityWithRelations).toHaveBeenCalledTimes(1);
    const foreignSaved = mockSaveEntityWithRelations.mock.calls[0][2] as Array<{ id: string }>;
    expect(foreignSaved.map((f) => f.id)).toEqual(['entities:c2']);
    expect(mainTab.unsaved).toBe(false);
    expect(mainTab.title).toBe('Алиса');
    expect(treeLoad).toHaveBeenCalled();
    expect(deps.loadEntityList).toHaveBeenCalledWith('character');

    // Outer error path on saveEntityWithRelations
    mainTab.unsaved = true;
    mockSaveEntityWithRelations.mockRejectedValueOnce(new Error('tx failed'));
    await executeSaveAll(deps);
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining('Save -> Error:'), 'error');

    fetchSpy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('covers calendar empty data/title, missing oldState, missing foreign target, __deleted, and openTab fallbacks', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        sections: [{}, { dynamicContainers: [{ id: 'dc_plain', template: 'nonbidi' }, { id: 'dc_bidi', template: 'bidi_nofields' }] }],
        templates: {
          nonbidi: { isBidirectional: false },
          bidi_nofields: { isBidirectional: true, bidirectionalLinkClass: '' },
        },
      }),
    } as unknown as Response);

    const calEmpty = {
      id: 'tab-cal-empty',
      tabType: 'entity',
      entityType: 'calendar',
      rawId: 'cal_empty',
      title: '',
      unsaved: true,
      data: undefined,
    } as unknown as EditorTab;

    const entityNoId = {
      id: 'tab-ent-noid',
      tabType: 'entity',
      entityType: 'character',
      rawId: 'entities:c10',
      title: 'entities:c10',
      unsaved: true,
      data: { rels: [] },
      _foreignUpdates: {
        missingType: { entityId: 'x' },
        missingTarget: { entityType: 'character', entityId: 'missing_1', dataPath: 'rels', linkClass: 't' },
        noLinkClass: { entityType: 'character', entityId: 'c11', dataPath: 'rels', linkClass: '' },
        deletedItem: { entityType: 'character', entityId: 'c12', dataPath: 'rels', linkClass: 'target_id', __deleted: true },
        pushNewItem: { entityType: 'character', entityId: 'c13', dataPath: 'rels', linkClass: 'target_id', data: { role: 'ally' } },
      },
    } as unknown as EditorTab;

    const openNoDataTab = {
      id: 'tab-open-nodata',
      tabType: 'entity',
      entityType: 'character',
      rawId: 'c13',
      title: 'C13',
      unsaved: false,
      data: undefined,
    } as unknown as EditorTab;

    deps.openEditors.value = [calEmpty, entityNoId, openNoDataTab];
    mockGetEntity.mockImplementation(async (_p: string, _t: string, id: string) => {
      if (id === 'c10') return null;
      if (id === 'missing_1') return null;
      if (id === 'c11') return { name: 'C11', rels: [] };
      if (id === 'c12') return { rels: [{ target_id: 'c10' }, { target_id: 'other' }] };
      if (id === 'c13') return { rels: [{ target_id: 'other' }] };
      return null;
    });
    mockSaveEntityWithRelations.mockResolvedValueOnce({ id: 'entities:c10' });
    mockTauriEmit.mockResolvedValue(undefined);

    await executeSaveAll(deps);
    expect(mockSaveCalendar).toHaveBeenCalledWith(
      'my-proj',
      expect.objectContaining({ название: 'Календарь' })
    );
    expect(mockSaveEntityWithRelations).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
