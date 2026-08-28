import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEntityTree } from '../entity.tree';
import { entityApi } from '../entity.api';
import * as api from '../../api.client';
import { appConfirm } from '@worldwiki/components';
import { setCache } from '../../../utils/requestCache';

vi.mock('../entity.api', () => ({
  entityApi: {
    getSchemas: vi.fn(),
  },
}));

vi.mock('../../api.client', () => ({
  getEntitiesBatch: vi.fn(),
}));

vi.mock('@worldwiki/components', () => {
  return {
    useTreeSelection: vi.fn((opts) => {
      const selectedSet = { value: new Set() };
      return {
        selected: selectedSet,
        hasSelection: { value: false },
        selectedCount: { value: 0 },
        handleClick: vi.fn(),
        isSelected: vi.fn((k) => selectedSet.value.has(k)),
        deleteSelected: vi.fn(),
        onDelete: opts?.onDelete,
      };
    }),
    appConfirm: vi.fn(() => Promise.resolve(true)),
  };
});

describe('useEntityTree', () => {
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
  });

  it('loads schemas from cache or API and handles edge case icon / names', async () => {
    vi.mocked(entityApi.getSchemas).mockResolvedValueOnce({
      custom_type: {}, // no name, no icon
      character: { name: 'Characters', icon: '👤', titleField: 'profile.full_name' },
    } as any);

    vi.mocked(api.getEntitiesBatch).mockResolvedValueOnce({
      custom_type: [],
      character: [{ id: 'c1', profile: { full_name: 'King Arthur' } }],
    } as any);

    const tree = useEntityTree('my-proj', emit);
    await tree.loadEntities();

    expect(tree.entitySections.value[0].emoji).toBe('');
    expect(tree.entitySections.value[0].title).toBe('custom_type');
    expect(tree.getEntityName({ profile: { full_name: 'King Arthur' } }, 'character')).toBe('King Arthur');
    expect(tree.getEntityName({}, 'custom_type')).toBe('Без названия');

    // Test cached load
    setCache('schemas:cached-proj', { char: { name: 'Cached' } });
    vi.mocked(api.getEntitiesBatch).mockResolvedValueOnce({ char: [] } as any);
    const cachedTree = useEntityTree('cached-proj', emit);
    await cachedTree.loadEntities();
    expect(cachedTree.entitySections.value[0].title).toBe('Cached');

    // Test error handling
    vi.mocked(api.getEntitiesBatch).mockRejectedValueOnce(new Error('Batch error'));
    await cachedTree.loadEntities();
  });

  it('computes context menu style positioning near right and bottom boundaries', () => {
    const tree = useEntityTree('my-proj', emit);

    // Context menu null
    expect(tree.entityCtxStyle.value).toEqual({});

    // Context menu near bottom-right edge
    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });

    tree.entityCtx.value = { x: 900, y: 750, entityType: 'char', entity: { id: 1 } };
    expect(tree.entityCtxStyle.value).toEqual({
      left: '680px', // 900 - 220
      top: '630px',  // 750 - 120
    });
  });

  it('computes flatEntityItems only for expanded sections and checks section selection', () => {
    const tree = useEntityTree('my-proj', emit);
    tree.entitySections.value = [{ type: 'character' }, { type: 'location' }];
    tree.entities.value = {
      character: [{ id: 'c1' }],
      location: [{ id: 'l1' }],
    };

    tree.expandedSections.value = new Set(['character']);
    expect(tree.flatEntityItems.value.length).toBe(1);
    expect(tree.flatEntityItems.value[0].id).toBe('entity:character:c1');

    tree.entitySelection.selected.value = new Set(['entity:character:c1']);
    expect(tree.entitySelectedInSection('character')).toBe(true);
    expect(tree.entitySelectedInSection('location')).toBe(false);
  });

  it('handles multi-delete in treeSelection.onDelete', async () => {
    const tree = useEntityTree('my-proj', emit);
    tree.entitySections.value = [{ type: 'character' }];
    tree.entities.value = { character: [{ id: 'c1' }, { id: 'c2' }] };
    tree.expandedSections.value = new Set(['character']);

    const onDelete = (tree.entitySelection as any).onDelete;

    // Empty keys
    await onDelete([]);

    // Cancel deletion
    vi.mocked(appConfirm).mockResolvedValueOnce(false);
    await onDelete(['entity:character:c1']);
    expect(emit).not.toHaveBeenCalled();

    // Confirm deletion
    vi.mocked(appConfirm).mockResolvedValueOnce(true);
    await onDelete(['entity:character:c1']);
    expect(emit).toHaveBeenCalledWith('delete-entity', 'entity:character:c1', 'character', true);
    expect(tree.entities.value.character.length).toBe(1);
  });

  it('handles handleEntityClick with modifiers (Ctrl, Shift, Meta)', () => {
    const tree = useEntityTree('my-proj', emit);

    // Ctrl click -> does not open entity
    tree.handleEntityClick({ ctrlKey: true } as any, 'character', { id: 'c1' }, {});
    expect(emit).not.toHaveBeenCalled();

    // Normal click -> opens entity
    tree.handleEntityClick({} as any, 'character', { id: 'c1' }, {});
    expect(emit).toHaveBeenCalledWith('open-entity', expect.objectContaining({ id: 'c1' }));
  });

  it('toggles sections and cleans up selected items if collapsing', () => {
    const tree = useEntityTree('my-proj', emit);
    tree.entitySelection.selected.value = new Set(['entity:character:c1']);

    tree.toggleSection('character');
    expect(tree.expandedSections.value.has('character')).toBe(true);

    tree.toggleSection('character');
    expect(tree.expandedSections.value.has('character')).toBe(false);
    expect(tree.entitySelection.selected.value.size).toBe(0);
  });

  it('handles deleteEntityCtxNode with multi-selection active and single confirm', async () => {
    const tree = useEntityTree('my-proj', emit);
    tree.entities.value = { character: [{ id: 'c1', name: 'Arthur' }] };

    // Null context
    await tree.deleteEntityCtxNode();

    // Multi-selection active
    tree.entityCtx.value = { entityType: 'character', entity: { id: 'c1' } };
    tree.entitySelection.hasSelection.value = true;
    (tree.entitySelection.isSelected as any).mockReturnValue(true);
    tree.entitySelection.selectedCount.value = 3;

    await tree.deleteEntityCtxNode();
    expect(tree.entitySelection.deleteSelected).toHaveBeenCalled();

    // Single confirm cancel
    tree.entityCtx.value = { entityType: 'character', entity: { id: 'c1' } };
    tree.entitySelection.hasSelection.value = false;
    vi.mocked(appConfirm).mockResolvedValueOnce(false);
    await tree.deleteEntityCtxNode();
    expect(emit).not.toHaveBeenCalledWith('delete-entity', expect.anything(), expect.anything(), true);

    // Single confirm success
    tree.entityCtx.value = { entityType: 'character', entity: { id: 'c1', name: 'Arthur' } };
    tree.entitySelection.hasSelection.value = false;
    vi.mocked(appConfirm).mockResolvedValueOnce(true);
    await tree.deleteEntityCtxNode();
    expect(emit).toHaveBeenCalledWith('delete-entity', 'entity:character:c1', 'character', true);
    expect(tree.entities.value.character.length).toBe(0);
  });

  it('handles openEntityCtx when item is selected vs not selected', () => {
    const tree = useEntityTree('my-proj', emit);
    const mockEvent = { clientX: 100, clientY: 200 } as MouseEvent;

    // 1. Not selected -> triggers handleClick
    (tree.entitySelection.isSelected as any).mockReturnValue(false);
    tree.openEntityCtx(mockEvent, 'character', { id: 'c1' }, { type: 'character' });
    expect(tree.entitySelection.handleClick).toHaveBeenCalled();
    expect(tree.entityCtx.value).toEqual({
      x: 100,
      y: 200,
      entityType: 'character',
      entity: { id: 'c1' },
      sect: { type: 'character' },
    });

    // 2. Already selected -> does not trigger handleClick
    (tree.entitySelection.handleClick as any).mockClear();
    (tree.entitySelection.isSelected as any).mockReturnValue(true);
    tree.openEntityCtx(mockEvent, 'character', { id: 'c1' }, { type: 'character' });
    expect(tree.entitySelection.handleClick).not.toHaveBeenCalled();
  });

  it('handles concurrent loadEntities skip and schema iconEmoji', async () => {
    vi.mocked(entityApi.getSchemas).mockResolvedValueOnce({
      item: { name: 'Item', iconEmoji: '⚔️' },
    } as any);
    vi.mocked(api.getEntitiesBatch).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { item: [] };
    });

    const tree = useEntityTree('concurrent-proj', emit);
    const p1 = tree.loadEntities();
    const p2 = tree.loadEntities(); // should be skipped
    await Promise.all([p1, p2]);

    expect(tree.entitySections.value[0].emoji).toBe('⚔️');
  });
});
