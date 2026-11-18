import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useChapterTreeOps } from './useChapterTreeOps';
import * as api from '@/services/api.client';
import { appAlert, appConfirm } from '@worldwiki/components';
import { useCalendarStore } from '@/stores/calendar.store';

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
  appConfirm: vi.fn(),
}));

vi.mock('@/services/api.client', () => ({
  deleteEntitySchema: vi.fn(),
  createVolume: vi.fn(),
  updateVolume: vi.fn(),
}));

describe('useChapterTreeOps', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  function createOps() {
    const hierarchy = ref({
      volumes: [{ id: 'volumes:v1', title: 'Том 1' }],
      chapters: [{ id: 'chapters:c1', title: 'Глава 1', volume_id: 'volumes:v1' }],
    } as any);
    const entities = ref({
      character: [{ id: 'entities:e1', name: 'Герой' }],
    } as Record<string, Array<Record<string, unknown>>>);
    const nodes = new Map<string, any>([
      ['volumes:v1', { id: 'volumes:v1', data: { type: 'volume', original: hierarchy.value.volumes[0] } }],
      ['chapters:c1', { id: 'chapters:c1', data: { type: 'chapter', original: hierarchy.value.chapters[0] } }],
      ['planet:p1', { id: 'planet:p1', data: { type: 'planet', original: { id: 'p1', name: 'Terra' } } }],
      ['cal:1', { id: 'cal:1', data: { type: 'calendar', original: { id: 'cal:1', name: 'Greg', data: {} } } }],
      ['character:e1', { id: 'character:e1', data: { isEntity: true, type: 'character', original: { id: 'entities:e1' } } }],
      ['__new_volume__', { id: '__new_volume__' }],
    ]);
    const load = vi.fn().mockResolvedValue(undefined);
    const emit = vi.fn();
    const explorerTreeRef = ref({
      startRename: vi.fn(),
      expandNode: vi.fn(),
      startCreate: vi.fn(),
    });

    const ops = useChapterTreeOps({
      project: 'proj_1',
      hierarchy,
      entities,
      entityKey: (t, id) => `${t}:${id}`,
      findNodeById: (id) => nodes.get(id) || null,
      compareIds: (a, b) => String(a) === String(b),
      load,
      emit,
      explorerTreeRef,
    });

    return { ops, hierarchy, entities, load, emit, explorerTreeRef };
  }

  it('covers startRename, handleDeleteSection, handleCreate, and handleCreateInline', async () => {
    const { ops, emit, explorerTreeRef, load } = createOps();
    const closeCtx = vi.fn();
    ops.startRename({ id: 'chapters:c1' }, closeCtx);
    expect(closeCtx).toHaveBeenCalled();
    expect(explorerTreeRef.value?.startRename).toHaveBeenCalled();

    vi.mocked(appConfirm).mockResolvedValueOnce(false);
    await ops.handleDeleteSection('character');
    expect(api.deleteEntitySchema).not.toHaveBeenCalled();

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(appConfirm).mockResolvedValueOnce(true);
    vi.mocked(api.deleteEntitySchema).mockRejectedValueOnce(new Error('del err'));
    await ops.handleDeleteSection('character');
    expect(appAlert).toHaveBeenCalled();
    errSpy.mockRestore();

    await ops.handleCreate({ sectionId: 'manuscript' });
    await ops.handleCreate({ sectionId: 'manuscript', parentId: 'volumes:v1' });
    expect(emit).toHaveBeenCalledWith('create-chapter-in', { volumeId: 'volumes:v1' });

    const calStore = useCalendarStore();
    vi.spyOn(calStore, 'savePlanet').mockImplementation(() => {});
    vi.spyOn(calStore, 'getCalendars').mockResolvedValue([]);
    vi.spyOn(calStore, 'saveCalendar').mockResolvedValueOnce(false as any).mockResolvedValueOnce(true as any);

    await ops.handleCreate({ sectionId: 'calendars', name: 'Mars' });
    expect(load).toHaveBeenCalled();

    await ops.handleCreate({ sectionId: 'calendars', parentId: 'planet:p1' });
    expect(appAlert).toHaveBeenCalled();
    await ops.handleCreate({ sectionId: 'calendars', parentId: 'planet:p1', name: 'Cal1' });
    expect(emit).toHaveBeenCalledWith('open-entity', expect.objectContaining({ entityType: 'calendar' }));

    await ops.handleCreate({ sectionId: 'character', name: 'NPC' });
    expect(emit).toHaveBeenCalledWith('add-entity', 'character', 'NPC');

    await ops.handleCreateInline({ sectionId: 'manuscript' });
    await ops.handleCreateInline({ sectionId: 'calendars', parentId: 'planet:p1' });
    await ops.handleCreateInline({ sectionId: 'character' });
    expect(explorerTreeRef.value?.startCreate).toHaveBeenCalledWith('character');
  });

  it('covers handleRename, handleCancelRename, and handleDelete for all node types', async () => {
    const { ops, emit, load } = createOps();
    const calStore = useCalendarStore();
    vi.spyOn(calStore, 'savePlanet').mockImplementation(() => {});
    vi.spyOn(calStore, 'saveCalendar').mockResolvedValue(true as any);
    vi.spyOn(calStore, 'deletePlanet').mockImplementation(() => {});
    vi.spyOn(calStore, 'deleteCalendar').mockResolvedValue(undefined as any);

    await ops.handleRename({ id: 'x' }, '   ');
    await ops.handleRename({ id: '__new_volume__' }, 'Новый');
    expect(api.createVolume).toHaveBeenCalledWith('proj_1', 'Новый');

    await ops.handleRename({ id: 'v1', data: { type: 'volume', original: { id: 'volumes:v1' } } }, 'Том 1Б');
    await ops.handleRename({ id: 'c1', data: { type: 'chapter', original: { id: 'chapters:c1' } } }, 'Глава 1Б');
    await ops.handleRename({ id: 'p1', data: { type: 'planet', original: { id: 'p1', name: 'Terra' } } }, 'Terra 2');
    await ops.handleRename({ id: 'cal1', data: { type: 'calendar', original: { id: 'cal:1', data: {} } } }, 'Cal 2');
    await ops.handleRename({ id: 'e1', data: { isEntity: true, type: 'character', original: { id: 'entities:e1' } } }, 'Hero 2');

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.createVolume).mockRejectedValueOnce(new Error('rename err'));
    await ops.handleRename({ id: '__new_volume__' }, 'ErrVol');
    expect(load).toHaveBeenCalled();
    errSpy.mockRestore();

    await ops.handleCancelRename({ id: '__new_volume__' });
    await ops.handleCancelRename({ id: 'other' });

    vi.mocked(appConfirm).mockResolvedValue(true);
    await ops.handleDelete(['missing', 'volumes:v1', 'chapters:c1', 'planet:p1', 'cal:1', 'character:e1']);
    expect(emit).toHaveBeenCalledWith('delete-volume', expect.anything(), expect.anything(), true);
    expect(emit).toHaveBeenCalledWith('delete-chapter', expect.anything(), true);
    expect(emit).toHaveBeenCalledWith('delete-entity', 'character:entities:e1', 'character', true);
  });
});
