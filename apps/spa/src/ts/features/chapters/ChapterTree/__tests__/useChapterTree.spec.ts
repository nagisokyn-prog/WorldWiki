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
});
