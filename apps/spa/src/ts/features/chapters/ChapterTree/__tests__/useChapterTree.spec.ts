import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useChapterTree } from '../useChapterTree';
import * as api from '../../../../services/api.client';
import { appAlert } from '@worldwiki/components';

let mockPush: any;

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
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

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
}));

let mockHierarchy: any;

vi.mock('../../../../stores/chapter.store', () => ({
  useChapterStore: () => ({
    loadChapters: vi.fn().mockResolvedValue([]),
    hierarchy: mockHierarchy,
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
    mockPush = vi.fn();
    emit = vi.fn();
    mockHierarchy = ref({
      volumes: [{ id: 'vol_1', title: 'Volume 1' }],
      arcs: [
        { id: 'arc_1', title: 'Arc 1', volume_id: 'vol_1' },
        { id: 'arc_root', title: 'Root Arc' },
      ],
      chapters: [
        { id: 'ch_1', title: 'Chapter 1', arc_id: 'arc_1' },
        { id: 'ch_root', title: 'Root Chapter' },
      ],
    });

    props = {
      project: 'my-proj',
      activeEditorId: 'ch_1',
    };
  });

  it('computes explorer sections with root arcs and root chapters and computes activeId', () => {
    const tree = useChapterTree(props, emit);

    expect(tree.activeId.value).toBe('ch_1');
    expect(tree.explorerSections.value[0].nodes.length).toBe(3); // volume, root arc, root chapter

    // Fallback activeId to activeNode
    props.activeEditorId = null;
    props.activeNode = { node: { id: 'node_99' } };
    const tree2 = useChapterTree(props, emit);
    expect(tree2.activeId.value).toBe('node_99');

    // No active ID
    props.activeNode = null;
    const tree3 = useChapterTree(props, emit);
    expect(tree3.activeId.value).toBeUndefined();
  });

  it('handles goBack and startRename', () => {
    const tree = useChapterTree(props, emit);

    tree.goBack();
    expect(mockPush).toHaveBeenCalledWith('/launcher');

    const closeCtx = vi.fn();
    tree.explorerTreeRef.value = { startRename: vi.fn() };
    tree.startRename({ id: '1' }, closeCtx);
    expect(closeCtx).toHaveBeenCalled();
    expect(tree.explorerTreeRef.value.startRename).toHaveBeenCalled();
  });

  it('handles select and open for entities, chapters with ctrl/shift keys', () => {
    const tree = useChapterTree(props, emit);

    // Empty select
    tree.handleSelect([], {} as any);

    // Select chapter with ctrlKey (does not select-chapter)
    tree.handleSelect([{ data: { type: 'chapter', original: { id: 'ch_1' } } }], { ctrlKey: true } as any);
    expect(emit).toHaveBeenCalledWith('select-node', expect.anything());
    expect(emit).not.toHaveBeenCalledWith('select-chapter', expect.anything());

    // Normal select chapter
    tree.handleSelect([{ data: { type: 'chapter', original: { id: 'ch_1' } } }], {} as any);
    expect(emit).toHaveBeenCalledWith('select-chapter', { id: 'ch_1' });

    // Open chapter
    tree.handleOpen({ data: { type: 'chapter', original: { id: 'ch_1' } } });
    expect(emit).toHaveBeenCalledWith('select-chapter', { id: 'ch_1' });
  });

  it('handles handleDeleteSection with cancel and confirm modal buttons', async () => {
    const tree = useChapterTree(props, emit);

    // Cancel deletion
    const promise1 = tree.handleDeleteSection('char_type');
    const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
    cancelBtn.click();
    await promise1;
    expect(api.deleteEntitySchema).not.toHaveBeenCalled();

    // Confirm deletion
    const promise2 = tree.handleDeleteSection('char_type');
    const confirmBtn = document.getElementById('confirm-btn') as HTMLButtonElement;
    confirmBtn.click();
    await promise2;
    expect(api.deleteEntitySchema).toHaveBeenCalledWith('my-proj', 'char_type');

    // Confirm deletion error
    vi.mocked(api.deleteEntitySchema).mockRejectedValueOnce(new Error('Delete schema error'));
    const promise3 = tree.handleDeleteSection('char_type');
    const confirmBtn3 = document.getElementById('confirm-btn') as HTMLButtonElement;
    confirmBtn3.click();
    await promise3;
    expect(appAlert).toHaveBeenCalled();
  });

  it('handles handleRename guards and error handling', async () => {
    const tree = useChapterTree(props, emit);

    // Empty new name
    await tree.handleRename({ data: { type: 'volume' } }, '   ');
    expect(api.updateVolume).not.toHaveBeenCalled();

    // API error during rename
    vi.mocked(api.updateVolume).mockRejectedValueOnce(new Error('Update failed'));
    await tree.handleRename({ data: { type: 'volume', original: { id: 'vol_1' } } }, 'New Vol');

    // Cancel rename non-temp
    await tree.handleCancelRename({ id: 'vol_1' });
  });

  it('handles handleDelete with unknown nodes', async () => {
    const tree = useChapterTree(props, emit);
    await tree.handleDelete(['unknown_id_123', 'vol_1']);
    expect(emit).toHaveBeenCalledWith('delete-volume', expect.anything(), expect.anything(), expect.anything(), true);
  });

  describe('Comprehensive branch test coverage for useChapterTree', () => {
    it('handles compareIds with complex object IDs and missing title fallbacks', () => {
      mockHierarchy.value = {
        volumes: [
          { id: { id: { String: 'vol_obj_id' } } }, // complex object id
        ],
        arcs: [
          { id: 'arc_in_vol', volume_id: { id: { String: 'vol_obj_id' } } }, // match via String
          { id: 'arc_json_id', volume_id: { other: 'prop' } }, // match via JSON.stringify
        ],
        chapters: [
          { id: 'ch_in_arc', arc_id: 'arc_in_vol' },
        ],
      };

      const tree = useChapterTree(props, emit);
      const msSection = tree.explorerSections.value.find((s: any) => s.id === 'manuscript');
      expect(msSection.nodes[0].children.length).toBe(1);
    });

    it('handles untitled volumes, arcs, chapters and deep grandchild hierarchy', () => {
      mockHierarchy.value = {
        volumes: [{ id: 'vol_untitled' }], // no title
        arcs: [
          { id: 'arc_in_vol', volume_id: 'vol_untitled' }, // no title
          { id: 'arc_root_untitled' }, // no title
        ],
        chapters: [
          { id: 'ch_in_arc', arc_id: 'arc_in_vol' }, // no title
          { id: 'ch_root_untitled' }, // no title
        ],
      };

      const tree = useChapterTree(props, emit);
      const msSection = tree.explorerSections.value.find((s: any) => s.id === 'manuscript');
      expect(msSection).toBeDefined();
      expect(msSection.nodes[0].label).toBe('Без названия');
      expect(msSection.nodes[0].children[0].label).toBe('Без названия');
      expect(msSection.nodes[0].children[0].children[0].label).toBe('Без названия');
    });


    it('handles handleSelect and handleOpen for entities, and node without data', () => {
      const tree = useChapterTree(props, emit);

      // Node without data
      tree.handleSelect([{}], {} as any);

      // Entity select
      const entNode = {
        data: {
          isEntity: true,
          type: 'character',
          original: { id: 'char_1', name: 'Arthur' },
        },
      };
      tree.handleSelect([entNode], {} as any);
      expect(emit).toHaveBeenCalledWith('open-entity', expect.objectContaining({ entityType: 'character', id: 'char_1' }));

      // Entity open
      tree.handleOpen(entNode);
      expect(emit).toHaveBeenCalledWith('open-entity', expect.objectContaining({ entityType: 'character', id: 'char_1' }));
    });

    it('handles entity-renamed CustomEvent matching and non-matching types', () => {
      useChapterTree(props, emit);

      // Non-matching type event
      document.dispatchEvent(new CustomEvent('ww:entity-renamed', {
        detail: { id: 'char_1', type: 'location', name: 'Camelot' },
      }));

      // Matching type event
      document.dispatchEvent(new CustomEvent('ww:entity-renamed', {
        detail: { id: 'char_1', type: 'character', name: 'King Arthur' },
      }));
    });

    it('handles handleCreate for non-manuscript sections with and without name', async () => {
      const tree = useChapterTree(props, emit);

      // With name
      await tree.handleCreate({ sectionId: 'character', name: 'Merlin' });
      expect(emit).toHaveBeenCalledWith('add-entity', 'character', 'Merlin');

      // Without name (no emit)
      emit.mockClear();
      await tree.handleCreate({ sectionId: 'character' });
      expect(emit).not.toHaveBeenCalled();
    });

    it('handles handleCreateInline branches: arc parent, volume parent, unknown parent, non-manuscript', async () => {
      const tree = useChapterTree(props, emit);
      tree.explorerTreeRef.value = { startCreate: vi.fn() };

      // Non-manuscript
      await tree.handleCreateInline({ sectionId: 'character' });
      expect(tree.explorerTreeRef.value.startCreate).toHaveBeenCalledWith('character');

      // Manuscript with arc parent
      await tree.handleCreateInline({ sectionId: 'manuscript', parentId: 'arc_1' });
      expect(emit).toHaveBeenCalledWith('create-chapter-in', { arcId: 'arc_1', volumeId: 'vol_1' });

      // Manuscript with volume parent -> triggers handleCreate (add arc)
      await tree.handleCreateInline({ sectionId: 'manuscript', parentId: 'vol_1' });

      // Manuscript with unknown parent fallback
      await tree.handleCreateInline({ sectionId: 'manuscript', parentId: 'unknown_parent_999' });
      expect(emit).toHaveBeenCalledWith('create-chapter-in', { arcId: null, volumeId: 'unknown_parent_999' });

      // Manuscript root
      await tree.handleCreateInline({ sectionId: 'manuscript' });
      expect(emit).toHaveBeenCalledWith('create-chapter-in', { arcId: null, volumeId: null });
    });

    it('handles handleCreate for manuscript section: new volume and new arc', async () => {
      const tree = useChapterTree(props, emit);
      tree.explorerTreeRef.value = {
        startRename: vi.fn(),
        expandNode: vi.fn(),
      };

      // 1. Create volume (no parentId)
      await tree.handleCreate({ sectionId: 'manuscript' });
      expect(tree.explorerTreeRef.value.startRename).toHaveBeenCalled();

      // 2. Create arc in volume (with parentId)
      await tree.handleCreate({ sectionId: 'manuscript', parentId: 'vol_1' });
      expect(tree.explorerTreeRef.value.expandNode).toHaveBeenCalledWith('vol_1');
      expect(tree.explorerTreeRef.value.startRename).toHaveBeenCalled();
    });

    it('handles handleRename and handleCancelRename across all node types', async () => {
      const tree = useChapterTree(props, emit);

      // 1. __new_volume__
      await tree.handleRename({ id: '__new_volume__', data: {} }, 'Brand New Volume');
      expect(api.createVolume).toHaveBeenCalledWith('my-proj', 'Brand New Volume');

      // 2. __new_arc__
      await tree.handleRename({ id: '__new_arc__123', data: { original: { volumeId: 'vol_1' } } }, 'New Arc');
      expect(api.createArc).toHaveBeenCalledWith('my-proj', 'New Arc', 'vol_1');

      // 3. Volume
      await tree.handleRename({ data: { type: 'volume', original: { id: 'vol_1' } } }, 'Renamed Vol');
      expect(api.updateVolume).toHaveBeenCalledWith('my-proj', 'vol_1', 'Renamed Vol');

      // 4. Arc
      await tree.handleRename({ data: { type: 'arc', original: { id: 'arc_1' } } }, 'Renamed Arc');
      expect(api.updateArc).toHaveBeenCalledWith('my-proj', 'arc_1', 'Renamed Arc', null);

      // 5. Chapter
      await tree.handleRename({ data: { type: 'chapter', original: { id: 'ch_1' } } }, 'Renamed Ch');
      expect(emit).toHaveBeenCalledWith('rename-chapter', { id: 'ch_1' }, 'Renamed Ch');

      // 6. Entity
      await tree.handleRename({
        data: {
          isEntity: true,
          type: 'character',
          original: { id: 'entities:char_1' },
        },
      }, 'Renamed Hero');
      expect(emit).toHaveBeenCalledWith('rename-entity', 'character', 'char_1', 'Renamed Hero');

      // Cancel rename for temporary new volume and new arc
      await tree.handleCancelRename({ id: '__new_volume__' });
      await tree.handleCancelRename({ id: '__new_arc__temp' });
    });

    it('handles handleDelete for arc, chapter and entity node types', async () => {
      const tree = useChapterTree(props, emit);

      // Delete arc
      await tree.handleDelete(['arc_root']);
      expect(emit).toHaveBeenCalledWith('delete-arc', expect.anything(), expect.anything(), false);

      // Delete chapter
      await tree.handleDelete(['ch_root']);
      expect(emit).toHaveBeenCalledWith('delete-chapter', expect.anything(), false);

      // Delete entity
      await tree.handleDelete(['entity:character:char_1']);
      expect(emit).toHaveBeenCalledWith('delete-entity', 'entity:character:char_1', 'character', false);
    });
  });
});

