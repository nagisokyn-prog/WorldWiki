import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useEntityLinkSelector } from '../useEntityLinkSelector';
import * as api from '@/services/api.client';

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
      entity_type: 'character',
      attributes: expect.objectContaining({
        'название': 'Новый герой'
      })
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

  describe('4 Mandatory Use-Cases', () => {
    it('Case 1: User types ((абв)) and character A with tag "абв" is offered', async () => {
      vi.mocked(api.getEntities).mockResolvedValueOnce([
        { id: 'entities:char_a', name: 'Персонаж А', entity_type: 'character', tags: ['абв'] }
      ] as never);

      const emit = vi.fn();
      const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true, initialQuery: '((абв))' }, emit);
      await flushPromises();

      expect(selector.filteredEntities.value.map(e => e.name)).toContain('Персонаж А');
    });

    it('Case 2: Character A does not have tag "абв"; user selects A and "абв" is added to tags', async () => {
      const charA = { id: 'entities:char_a', name: 'Персонаж А', entity_type: 'character', tags: ['другой_тег'] };
      vi.mocked(api.getEntities).mockResolvedValueOnce([charA] as never);

      const emit = vi.fn();
      const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true, initialQuery: '((абв))' }, emit);
      await flushPromises();

      selector.selectEntity(selector.filteredEntities.value[0]);

      expect(api.saveEntity).toHaveBeenCalledWith('test_prj', expect.objectContaining({
        id: 'entities:char_a',
        tags: expect.arrayContaining(['другой_тег', 'абв'])
      }));
      expect(emit).toHaveBeenCalledWith('insert', {
        type: 'character',
        id: 'entities:char_a',
        name: 'Персонаж А'
      });
    });

    it('Case 3: Character "Лёха" exists; user types ((Лёша)) -> approximate search suggests Лёха, and selection adds Лёша to tags', async () => {
      const charLyoha = { id: 'entities:lyoha', name: 'Лёха', entity_type: 'character', tags: ['друг'] };
      vi.mocked(api.getEntities).mockResolvedValueOnce([charLyoha] as never);

      const emit = vi.fn();
      const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true, initialQuery: '((Лёша))' }, emit);
      await flushPromises();

      expect(selector.filteredEntities.value.map(e => e.name)).toContain('Лёха');

      const foundLyoha = selector.filteredEntities.value.find(e => e.name === 'Лёха');
      expect(foundLyoha).toBeDefined();
      selector.selectEntity(foundLyoha!);

      expect(api.saveEntity).toHaveBeenCalledWith('test_prj', expect.objectContaining({
        id: 'entities:lyoha',
        tags: expect.arrayContaining(['друг', 'Лёша'])
      }));
      expect(emit).toHaveBeenCalledWith('insert', {
        type: 'character',
        id: 'entities:lyoha',
        name: 'Лёха'
      });
    });

    it('Case 4: User types ((Кира)) -> entity does not exist -> chooses type (location) and new entity is created', async () => {
      vi.mocked(api.getEntities).mockResolvedValueOnce([
        { id: 'entities:other', name: 'Другой', entity_type: 'character', tags: [] }
      ] as never);

      const emit = vi.fn();
      const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true, initialQuery: '((Кира))' }, emit);
      await flushPromises();

      expect(selector.showQuickCreate.value).toBe(true);
      expect(selector.cleanSearchQuery.value).toBe('Кира');
      expect(selector.availableCreationTypes.value.some(t => t.id === 'location')).toBe(true);

      await selector.quickCreateEntity('location');

      expect(api.saveEntity).toHaveBeenCalledWith('test_prj', expect.objectContaining({
        name: 'Кира',
        entity_type: 'location'
      }));
      expect(emit).toHaveBeenCalledWith('insert', {
        type: 'location',
        id: 'entities:new_created',
        name: 'Кира'
      });
      expect(emit).toHaveBeenCalledWith('close');
    });
  });

  describe('Source Mention and Decoupled Search', () => {
    it('extracts and preserves sourceMention even when search input is cleared', async () => {
      const emit = vi.fn();
      const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true, initialQuery: '((Мелкая))' }, emit);
      await flushPromises();

      expect(selector.sourceMention.value).toBe('Мелкая');
      expect(selector.searchQuery.value).toBe('Мелкая');
      expect(selector.saveAsTag.value).toBe(true);

      // Clearing search query
      selector.searchQuery.value = '';
      expect(selector.sourceMention.value).toBe('Мелкая');
      expect(selector.cleanSearchQuery.value).toBe('');
    });

    it('attaches sourceMention to selected entity even after search query was erased or changed', async () => {
      const katya = { id: 'entities:katya', name: 'Катя', entity_type: 'character', tags: ['девочка'] };
      vi.mocked(api.getEntities).mockResolvedValueOnce([katya] as never);

      const emit = vi.fn();
      const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true, initialQuery: '((Мелкая))' }, emit);
      await flushPromises();

      // Пользователь стёр поле поиска, чтобы найти Катю
      selector.searchQuery.value = '';
      expect(selector.cleanSearchQuery.value).toBe('');

      selector.selectEntity(selector.filteredEntities.value[0]);

      expect(api.saveEntity).toHaveBeenCalledWith('test_prj', expect.objectContaining({
        id: 'entities:katya',
        tags: expect.arrayContaining(['девочка', 'Мелкая']),
        attributes: expect.objectContaining({
          aliases: expect.arrayContaining(['Мелкая'])
        })
      }));
    });

    it('does not attach mention when saveAsTag toggle is unchecked', async () => {
      const katya = { id: 'entities:katya', name: 'Катя', entity_type: 'character', tags: ['девочка'] };
      vi.mocked(api.getEntities).mockResolvedValueOnce([katya] as never);

      const emit = vi.fn();
      const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true, initialQuery: '((Мелкая))' }, emit);
      await flushPromises();

      selector.saveAsTag.value = false;
      selector.searchQuery.value = '';

      selector.selectEntity(katya);

      expect(api.saveEntity).not.toHaveBeenCalled();
      expect(emit).toHaveBeenCalledWith('insert', {
        type: 'character',
        id: 'entities:katya',
        name: 'Катя'
      });
    });

    it('computes otherEntities for entities not matched by active search query', async () => {
      const emit = vi.fn();
      const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true }, emit);
      await flushPromises();

      selector.searchQuery.value = 'Рейн';
      expect(selector.filteredEntities.value.map(e => e.name)).toEqual([
        'Рейн',
        'Рейнский замок',
        'Рейнджеры Севера'
      ]);
      expect(selector.otherEntities.value.map(e => e.name)).toEqual(['Валентин']);
    });

    it('quick-creates entity with sourceMention added to tags when name differs', async () => {
      const emit = vi.fn();
      const selector = useEntityLinkSelector({ project: 'test_prj', isOpen: true, initialQuery: '((Мелкая))' }, emit);
      await flushPromises();

      // Пользователь ввел новое имя "Екатерина" вместо "Мелкая"
      selector.searchQuery.value = 'Екатерина';
      await selector.quickCreateEntity('character');

      expect(api.saveEntity).toHaveBeenCalledWith('test_prj', expect.objectContaining({
        name: 'Екатерина',
        tags: expect.arrayContaining(['Мелкая']),
        attributes: expect.objectContaining({
          'название': 'Екатерина',
          tags: expect.arrayContaining(['Мелкая']),
          aliases: expect.arrayContaining(['Мелкая'])
        })
      }));
    });
  });
});

