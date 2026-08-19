import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEntityTree } from '../entity.tree';
import { entityApi } from '../entity.api';
import * as api from '../../api.client';

vi.mock('../entity.api', () => ({
  entityApi: {
    getSchemas: vi.fn(),
  },
}));

vi.mock('../../api.client', () => ({
  getEntitiesBatch: vi.fn(),
}));

vi.mock('@worldwiki/components', () => ({
  useTreeSelection: vi.fn((opts) => ({
    selected: { value: new Set() },
    hasSelection: { value: false },
    selectedCount: { value: 0 },
    handleClick: vi.fn(),
    isSelected: vi.fn(() => false),
    deleteSelected: vi.fn(),
    onDelete: opts?.onDelete,
  })),
  appConfirm: vi.fn(() => Promise.resolve(true)),
}));

describe('useEntityTree', () => {
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
  });

  it('loads schemas and entities batch on loadEntities', async () => {
    vi.mocked(entityApi.getSchemas).mockResolvedValueOnce({
      character: { name: 'Characters', icon: '👤', titleField: 'custom_name' },
      location: { name: 'Locations', iconEmoji: '🏰' },
    } as any);

    vi.mocked(api.getEntitiesBatch).mockResolvedValueOnce({
      character: [{ id: 'c1', custom_name: 'Arthur' }],
      location: [{ id: 'l1', name: 'Camelot' }],
    } as any);

    const tree = useEntityTree('my-proj', emit);
    await tree.loadEntities();

    expect(tree.entitySections.value).toEqual([
      { type: 'character', title: 'Characters', emoji: '👤' },
      { type: 'location', title: 'Locations', emoji: '🏰' },
    ]);
    expect(tree.entities.value.character.length).toBe(1);
    expect(tree.getEntityName({ custom_name: 'Arthur' }, 'character')).toBe('Arthur');
    expect(tree.getEntityName({ name: 'Camelot' }, 'location')).toBe('Camelot');
  });

  it('toggles sections expansion', () => {
    const tree = useEntityTree('my-proj', emit);

    expect(tree.expandedSections.value.has('character')).toBe(false);
    tree.toggleSection('character');
    expect(tree.expandedSections.value.has('character')).toBe(true);
    tree.toggleSection('character');
    expect(tree.expandedSections.value.has('character')).toBe(false);
  });

  it('handles entity click and opens entity', () => {
    const tree = useEntityTree('my-proj', emit);
    const mockEvent = new MouseEvent('click');

    tree.handleEntityClick(mockEvent, 'character', { id: 'c1', name: 'Arthur' }, {});

    expect(emit).toHaveBeenCalledWith('open-entity', {
      id: 'c1',
      name: 'Arthur',
      entityType: 'character',
    });
  });

  it('opens and deletes entity from context menu', async () => {
    const tree = useEntityTree('my-proj', emit);
    tree.entities.value = {
      character: [{ id: 'c1', name: 'Arthur' }],
    };

    const mockEvent = { clientX: 100, clientY: 150 } as MouseEvent;
    tree.openEntityCtx(mockEvent, 'character', { id: 'c1', name: 'Arthur' }, {});

    expect(tree.entityCtx.value).toBeDefined();
    expect(tree.entityCtxStyle.value.top).toBeDefined();

    await tree.deleteEntityCtxNode();

    expect(emit).toHaveBeenCalledWith('delete-entity', 'entity:character:c1', 'character', true);
    expect(tree.entities.value.character).toEqual([]);
  });
});
