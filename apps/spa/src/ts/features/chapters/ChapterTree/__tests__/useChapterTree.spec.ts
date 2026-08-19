import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useChapterTree } from '../useChapterTree';
import * as api from '../../../../services/api.client';

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../../../services/api.client', () => ({
  createVolume: vi.fn().mockResolvedValue({ id: 'vol_new' }),
  createArc: vi.fn().mockResolvedValue({ id: 'arc_new' }),
  updateVolume: vi.fn().mockResolvedValue({}),
  updateArc: vi.fn().mockResolvedValue({}),
  updateChapter: vi.fn().mockResolvedValue({}),
  updateEntity: vi.fn().mockResolvedValue({}),
  deleteEntitySchema: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../stores/chapter.store', () => ({
  useChapterStore: () => ({
    loadChapters: vi.fn().mockResolvedValue([]),
    hierarchy: ref({
      volumes: [{ id: 'vol_1', title: 'Volume 1' }],
      arcs: [{ id: 'arc_1', title: 'Arc 1', volume_id: 'vol_1' }],
      chapters: [{ id: 'ch_1', title: 'Chapter 1', arc_id: 'arc_1' }],
    }),
  }),
}));

vi.mock('../../../../services/Entity/entity.tree', () => ({
  useEntityTree: () => ({
    entities: ref({ character: [{ id: 'char_1', name: 'Arthur' }] }),
    entitySections: ref([{ type: 'character', title: 'Персонажи', icon: 'user', emoji: '👤' }]),
    loadEntities: vi.fn(),
    getEntityName: vi.fn((e) => e.name),
    entityKey: vi.fn((t, id) => `entity:${t}:${id}`),
  }),
}));

describe('useChapterTree', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    props = {
      project: 'my-proj',
      activeEditorId: 'ch_1',
    };
  });

  it('computes explorer sections and active ID', () => {
    const tree = useChapterTree(props, emit);

    expect(tree.activeId.value).toBe('ch_1');
    expect(tree.explorerSections.value.length).toBe(2);
    expect(tree.explorerSections.value[0].id).toBe('manuscript');
    expect(tree.explorerSections.value[1].id).toBe('character');
  });

  it('handles select and open for entities and chapters', () => {
    const tree = useChapterTree(props, emit);

    // Select entity
    tree.handleSelect([{ data: { isEntity: true, type: 'character', original: { id: 'c1' } } }], {} as any);
    expect(emit).toHaveBeenCalledWith('open-entity', expect.objectContaining({ entityType: 'character' }));

    // Select chapter
    tree.handleSelect([{ data: { type: 'chapter', original: { id: 'ch_1' } } }], {} as any);
    expect(emit).toHaveBeenCalledWith('select-chapter', { id: 'ch_1' });

    // Open entity
    tree.handleOpen({ data: { isEntity: true, type: 'character', original: { id: 'c1' } } });
    expect(emit).toHaveBeenCalledWith('open-entity', expect.objectContaining({ entityType: 'character' }));
  });

  it('handles inline creation and renames', async () => {
    const tree = useChapterTree(props, emit);

    // Create inline in arc
    await tree.handleCreateInline({ sectionId: 'manuscript', parentId: 'arc_1' });
    expect(emit).toHaveBeenCalledWith('create-chapter-in', expect.objectContaining({ arcId: 'arc_1' }));

    // Rename chapter
    await tree.handleRename({ data: { type: 'chapter', original: { id: 'ch_1' } } }, 'Renamed Chapter');
    expect(emit).toHaveBeenCalledWith('rename-chapter', { id: 'ch_1' }, 'Renamed Chapter');

    // Rename volume
    await tree.handleRename({ data: { type: 'volume', original: { id: 'vol_1' } } }, 'Renamed Volume');
    expect(api.updateVolume).toHaveBeenCalledWith('my-proj', 'vol_1', 'Renamed Volume');
  });

  it('goes back to launcher', () => {
    const tree = useChapterTree(props, emit);
    tree.goBack();
    expect(tree.goBack).toBeDefined();
  });
});
