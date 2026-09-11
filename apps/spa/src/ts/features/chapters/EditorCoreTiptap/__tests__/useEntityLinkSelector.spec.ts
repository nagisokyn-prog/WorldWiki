import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useEntityLinkSelector } from '../useEntityLinkSelector';
import * as api from '../../../../services/api.client';

vi.mock('../../../../services/api.client', () => ({
  getEntitySchemas: vi.fn(),
  getEntities: vi.fn(),
  saveEntity: vi.fn()
}));

describe('useEntityLinkSelector', () => {
  const mockSchemas = [
    { type_key: 'character', type_name: 'Персонаж', icon: '🧙‍♂️' },
    { type_key: 'location', type_name: 'Локация', icon: '🏰' },
    { type_key: 'faction', type_name: 'Фракция', icon: '⚔️' }
  ];

  const mockEntities = [
    { id: 'entities:reyn', name: 'Рейн', entity_type: 'character', tags: ['маг', 'север'] },
    { id: 'entities:castle', name: 'Рейнский замок', entity_type: 'location', tags: ['крепость', 'север'] },
    { id: 'entities:rangers', name: 'Рейнджеры Севера', entity_type: 'faction', tags: ['армия'] },
    { id: 'entities:valen', name: 'Валентин', entity_type: 'character', tags: ['рыцарь'] }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getEntitySchemas).mockResolvedValue(mockSchemas as never);
    vi.mocked(api.getEntities).mockResolvedValue(mockEntities as never);
    vi.mocked(api.saveEntity).mockImplementation(async (_project, entity) => ({
      id: 'entities:new_created',
      ...(entity as object)
    } as never));
  });

  it('loads schemas and all entities when opened', async () => {
    const emit = vi.fn();
    const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true }, emit);

    await flushPromises();

    expect(api.getEntitySchemas).toHaveBeenCalledWith('test_prj');
    expect(api.getEntities).toHaveBeenCalledWith('test_prj', null);
    expect(selector.entityTypes.value.length).toBe(3);
    expect(selector.filteredEntities.value.length).toBe(4);
  });

  it('filters entities by name query across all types', async () => {
    const emit = vi.fn();
    const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true }, emit);

    await flushPromises();

    selector.searchQuery.value = 'Рейн';
    expect(selector.filteredEntities.value.map(e => e.name)).toEqual([
      'Рейн',
      'Рейнский замок',
      'Рейнджеры Севера'
    ]);
  });

  it('filters entities by #tag search', async () => {
    const emit = vi.fn();
    const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true }, emit);

    await flushPromises();

    selector.searchQuery.value = '#север';
    expect(selector.filteredEntities.value.map(e => e.name)).toEqual([
      'Рейн',
      'Рейнский замок'
    ]);
  });

  it('filters entities by selected type tab', async () => {
    const emit = vi.fn();
    const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true }, emit);

    await flushPromises();

    selector.setTypeFilter('character');
    expect(selector.filteredEntities.value.map(e => e.name)).toEqual([
      'Рейн',
      'Валентин'
    ]);
  });

  it('supports quick creating entity on the fly and emitting insert event', async () => {
    const emit = vi.fn();
    const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true }, emit);

    await flushPromises();

    selector.searchQuery.value = 'Новый герой';
    expect(selector.showQuickCreate.value).toBe(true);

    await selector.quickCreateEntity('character');

    expect(api.saveEntity).toHaveBeenCalledWith('test_prj', expect.objectContaining({
      name: 'Новый герой',
      entity_type: 'character'
    }));

    expect(emit).toHaveBeenCalledWith('insert', {
      type: 'character',
      id: 'entities:new_created',
      name: 'Новый герой'
    });
    expect(emit).toHaveBeenCalledWith('close');
  });

  it('handles keyboard navigation and selection', async () => {
    const emit = vi.fn();
    const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true }, emit);

    await flushPromises();

    expect(selector.selectedIndex.value).toBe(0);
    selector.moveSelection(1);
    expect(selector.selectedIndex.value).toBe(1);

    selector.selectCurrent();
    expect(emit).toHaveBeenCalledWith('insert', {
      type: 'location',
      id: 'entities:castle',
      name: 'Рейнский замок'
    });
  });
});
