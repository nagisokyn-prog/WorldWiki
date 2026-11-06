import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useChapterTree } from '../useChapterTree';
import * as api from '@/services/api.client';
import { appAlert } from '@worldwiki/components';

let mockPush: any;

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/services/api.client', () => ({
  createVolume: vi.fn().mockResolvedValue({ id: 'vol_new' }),
  updateVolume: vi.fn().mockResolvedValue({}),
  updateChapter: vi.fn().mockResolvedValue({}),
  updateEntity: vi.fn().mockResolvedValue({}),
  deleteEntitySchema: vi.fn().mockResolvedValue({}),
}));

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
  appConfirm: vi.fn().mockResolvedValue(true),
}));

let mockHierarchy: any;
const mockLoadChapters = vi.fn().mockResolvedValue([]);
const mockLoadEntities = vi.fn().mockResolvedValue([]);

vi.mock('@/stores/chapter.store', () => ({
  useChapterStore: () => ({
    loadChapters: mockLoadChapters,
    hierarchy: mockHierarchy,
  }),
}));

vi.mock('@/stores/calendar.store', () => ({
  useCalendarStore: () => ({
    loadCalendars: vi.fn().mockResolvedValue([]),
    getCalendars: vi.fn().mockResolvedValue([]),
    getPlanets: vi.fn().mockReturnValue([]),
    calendars: ref([]),
  }),
}));

vi.mock('@/services/Entity/entity.tree', () => ({
  useEntityTree: () => ({
    entities: ref({ character: [{ id: 'char_1', name: 'Arthur' }] }),
    entitySections: ref([{ type: 'character', title: 'Персонажи', icon: 'user', emoji: '👤' }]),
    loadEntities: mockLoadEntities,
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
      chapters: [
        { id: 'ch_1', title: 'Chapter 1', volume_id: 'vol_1' },
        { id: 'ch_root', title: 'Root Chapter' },
      ],
    });

    props = {
      project: 'my-proj',
      activeEditorId: 'ch_1',
    };
  });

  it('computes explorer sections with volumes and root chapters and computes activeId', () => {
    const tree = useChapterTree(props, emit);

    expect(tree.activeId.value).toBe('ch_1');
    const msSection = tree.explorerSections.value.find((s: any) => s.id === 'manuscript');
    expect(msSection?.nodes.length).toBe(2); // volume, root chapter

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
    tree.explorerTreeRef.value = {
      startRename: vi.fn(),
      expandNode: vi.fn(),
      startCreate: vi.fn(),
    };
    tree.startRename({ id: '1' }, closeCtx);
    expect(closeCtx).toHaveBeenCalled();
    expect(tree.explorerTreeRef.value?.startRename).toHaveBeenCalled();
  });

  it('handles select and open for entities, chapters with ctrl/shift keys', () => {
    const tree = useChapterTree(props, emit);

    // Empty select
    tree.handleSelect([], {} as any);

    // Select chapter with ctrlKey (does not select-chapter)
    tree.handleSelect([{ id: 'ch_1', data: { type: 'chapter', original: { id: 'ch_1' } } }], { ctrlKey: true } as any);
    expect(emit).toHaveBeenCalledWith('select-node', expect.anything());
    expect(emit).not.toHaveBeenCalledWith('select-chapter', expect.anything());

    // Normal select chapter
    tree.handleSelect([{ id: 'ch_1', data: { type: 'chapter', original: { id: 'ch_1' } } }], {} as any);
    expect(emit).toHaveBeenCalledWith('select-chapter', { id: 'ch_1' });

    // Open chapter
    tree.handleOpen({ id: 'ch_1', data: { type: 'chapter', original: { id: 'ch_1' } } });
    expect(emit).toHaveBeenCalledWith('select-chapter', { id: 'ch_1' });
  });

  it('handles handleDeleteSection with cancel and confirm modal buttons', async () => {
    const { appConfirm } = await import('@worldwiki/components');
    const tree = useChapterTree(props, emit);

    // Cancel deletion
    vi.mocked(appConfirm).mockResolvedValueOnce(false);
    await tree.handleDeleteSection('char_type');
    expect(api.deleteEntitySchema).not.toHaveBeenCalled();

    // Confirm deletion
    vi.useFakeTimers();
    vi.mocked(appConfirm).mockResolvedValueOnce(true);
    const promise2 = tree.handleDeleteSection('char_type');
    await promise2;
    expect(api.deleteEntitySchema).toHaveBeenCalledWith('my-proj', 'char_type');
    vi.advanceTimersByTime(600);
    vi.useRealTimers();

    // Confirm deletion error
    vi.mocked(appConfirm).mockResolvedValueOnce(true);
    vi.mocked(api.deleteEntitySchema).mockRejectedValueOnce(new Error('Delete schema error'));
    await tree.handleDeleteSection('char_type');
    expect(appAlert).toHaveBeenCalled();
  });

  it('runs onMounted and onUnmounted lifecycle hooks in component wrapper', () => {
    const Comp = defineComponent({
      props: ['project'],
      setup(p, { emit: e }) {
        return { ...useChapterTree(p, e) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp, { props });
    document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
    document.dispatchEvent(new CustomEvent('ww:entity-renamed', {
      detail: { id: 'char_1', type: 'character', name: 'King Arthur II' }
    }));
    wrapper.unmount();
  });

  it('covers load catch error and volume with child chapters', async () => {
    // 1. Volume with chapters
    mockHierarchy.value = {
      volumes: [{ id: 'vol_1', title: 'Volume 1' }],
      chapters: [{ id: 'ch_in_vol', volume_id: 'vol_1', title: 'Child Ch' }],
    };
    const tree = useChapterTree(props, emit);
    const msSection = tree.explorerSections.value.find((s: any) => s.id === 'manuscript');
    expect(msSection?.nodes?.[0]?.children?.length).toBe(1);

    // 2. Load catch error
    const { useChapterStore } = await import('@/stores/chapter.store');
    const store = useChapterStore();
    vi.mocked(store.loadChapters).mockRejectedValueOnce(new Error('Load chapters error'));
    await tree.load();
  });

  it('handles handleRename guards and error handling', async () => {
    const tree = useChapterTree(props, emit);

    // Empty new name
    await tree.handleRename({ id: 'vol_1', data: { type: 'volume' } }, '   ');
    expect(api.updateVolume).not.toHaveBeenCalled();

    // API error during rename
    vi.mocked(api.updateVolume).mockRejectedValueOnce(new Error('Update failed'));
    await tree.handleRename({ id: 'vol_1', data: { type: 'volume', original: { id: 'vol_1' } } }, 'New Vol');

    // Cancel rename non-temp
    await tree.handleCancelRename({ id: 'vol_1' });
  });

  it('handles handleDelete with unknown nodes', async () => {
    const tree = useChapterTree(props, emit);
    await tree.handleDelete(['unknown_id_123', 'vol_1']);
    expect(emit).toHaveBeenCalledWith('delete-volume', expect.anything(), expect.anything(), true);
  });

  describe('Comprehensive branch test coverage for useChapterTree', () => {
    it('handles compareIds with complex object IDs and missing title fallbacks', () => {
      mockHierarchy.value = {
        volumes: [
          { id: { id: { String: 'vol_obj_id' } } }, // complex object id
        ],
        chapters: [
          { id: 'ch_in_vol', volume_id: { id: { String: 'vol_obj_id' } } },
        ],
      };

      const tree = useChapterTree(props, emit);
      const msSection = tree.explorerSections.value.find((s: any) => s.id === 'manuscript');
      expect(msSection?.nodes?.[0]?.children?.length).toBe(1);
    });

    it('handles untitled volumes and chapters', () => {
      mockHierarchy.value = {
        volumes: [{ id: 'vol_untitled' }], // no title
        chapters: [
          { id: 'ch_in_vol', volume_id: 'vol_untitled' }, // no title
          { id: 'ch_root_untitled' }, // no title
        ],
      };

      const tree = useChapterTree(props, emit);
      const msSection = tree.explorerSections.value.find((s: any) => s.id === 'manuscript');
      expect(msSection).toBeDefined();
      expect(msSection?.nodes?.[0]?.label).toBe('Без названия');
      expect(msSection?.nodes?.[0]?.children?.[0]?.label).toBe('Без названия');
    });


    it('handles handleSelect and handleOpen for entities, and node without data', () => {
      const tree = useChapterTree(props, emit);

      // Node without data
      tree.handleSelect([{ id: 'empty_node' }], {} as any);

      // Entity select
      const entNode = {
        id: 'entity:character:char_1',
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

    it('handles handleCreateInline branches: volume parent, non-manuscript, root', async () => {
      const tree = useChapterTree(props, emit);
      tree.explorerTreeRef.value = {
        startCreate: vi.fn(),
        expandNode: vi.fn(),
        startRename: vi.fn(),
      };

      // Non-manuscript
      await tree.handleCreateInline({ sectionId: 'character' });
      expect(tree.explorerTreeRef.value.startCreate).toHaveBeenCalledWith('character');

      // Manuscript with volume parent
      await tree.handleCreateInline({ sectionId: 'manuscript', parentId: 'vol_1' });
      expect(emit).toHaveBeenCalledWith('create-chapter-in', { volumeId: 'vol_1' });

      // Manuscript root
      await tree.handleCreateInline({ sectionId: 'manuscript' });
      expect(emit).toHaveBeenCalledWith('create-chapter-in', { volumeId: null });
    });

    it('handles handleCreate for manuscript section: new volume and new chapter in volume', async () => {
      const tree = useChapterTree(props, emit);
      tree.explorerTreeRef.value = {
        startRename: vi.fn(),
        expandNode: vi.fn(),
        startCreate: vi.fn(),
      };

      // 1. Create volume (no parentId)
      await tree.handleCreate({ sectionId: 'manuscript' });
      expect(tree.explorerTreeRef.value?.startRename).toHaveBeenCalled();

      // 2. Create chapter in volume (with parentId)
      await tree.handleCreate({ sectionId: 'manuscript', parentId: 'vol_1' });
      expect(emit).toHaveBeenCalledWith('create-chapter-in', { volumeId: 'vol_1' });
    });

    it('handles handleRename and handleCancelRename across all node types', async () => {
      const tree = useChapterTree(props, emit);

      // 1. __new_volume__
      await tree.handleRename({ id: '__new_volume__', data: {} }, 'Brand New Volume');
      expect(api.createVolume).toHaveBeenCalledWith('my-proj', 'Brand New Volume');

      // 2. Volume
      await tree.handleRename({ id: 'vol_1', data: { type: 'volume', original: { id: 'vol_1' } } }, 'Renamed Vol');
      expect(api.updateVolume).toHaveBeenCalledWith('my-proj', 'vol_1', 'Renamed Vol');

      // 3. Chapter
      await tree.handleRename({ id: 'ch_1', data: { type: 'chapter', original: { id: 'ch_1' } } }, 'Renamed Ch');
      expect(emit).toHaveBeenCalledWith('rename-chapter', { id: 'ch_1' }, 'Renamed Ch');

      // 4. Entity
      await tree.handleRename({
        id: 'entities:char_1',
        data: {
          isEntity: true,
          type: 'character',
          original: { id: 'entities:char_1' },
        },
      }, 'Renamed Hero');
      expect(emit).toHaveBeenCalledWith('rename-entity', 'character', 'char_1', 'Renamed Hero');

      // Cancel rename for temporary new volume
      await tree.handleCancelRename({ id: '__new_volume__' });
    });

    it('handles handleDelete for volume, chapter and entity node types', async () => {
      const tree = useChapterTree(props, emit);

      // Delete volume
      await tree.handleDelete(['vol_1']);
      expect(emit).toHaveBeenCalledWith('delete-volume', expect.anything(), expect.anything(), false);

      // Delete chapter
      await tree.handleDelete(['ch_root']);
      expect(emit).toHaveBeenCalledWith('delete-chapter', expect.anything(), false);

      // Delete entity
      await tree.handleDelete(['entity:character:char_1']);
      expect(emit).toHaveBeenCalledWith('delete-entity', 'entity:character:char_1', 'character', false);
    });

    it('handles load error in load() gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadChapters.mockRejectedValueOnce(new Error('Load failure'));

      const tree = useChapterTree(props, emit);
      await tree.load();
      expect(consoleSpy).toHaveBeenCalledWith('ChapterTree load error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});

