import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCreateEntityModal } from './useCreateEntityModal';
import * as api from '../../../services/api.client';

vi.mock('../../../services/api.client', () => ({
  getEntitySchemas: vi.fn(),
}));

vi.mock('../../../services/Entity/entity.api', () => ({
  entityApi: {
    getSchemas: vi.fn().mockResolvedValue({}),
  },
}));

describe('useCreateEntityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state when closed', () => {
    const props = { isOpen: false, projectName: 'test-project' };
    const emit = vi.fn();
    const modal = useCreateEntityModal(props, emit);

    expect(modal.entityName.value).toBe('');
    expect(modal.selectedEntityType.value).toBe('');
    expect(modal.availableTypes.value).toEqual([]);
    expect(modal.isLoading.value).toBe(false);
  });

  it('loads entity schemas dynamically when opened', async () => {
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([
      {
        id: '1',
        project_id: 'test',
        type_key: 'custom_creature',
        type_name: 'Существо',
        icon: '🐉',
        color: 'var(--accent)',
        fields_schema: [],
        full_schema: { description: 'Мифические существа' },
        created_at: null,
      },
      {
        id: '2',
        project_id: 'test',
        type_key: 'artifact',
        type_name: 'Артефакт',
        icon: '💍',
        color: 'var(--accent)',
        fields_schema: [],
        full_schema: null,
        created_at: null,
      },
    ]);

    const props = { isOpen: true, projectName: 'test-project', initialEntityType: 'artifact' };
    const emit = vi.fn();
    const modal = useCreateEntityModal(props, emit);

    await modal.loadEntityTypes();

    expect(modal.availableTypes.value.length).toBe(2);
    expect(modal.availableTypes.value[0].type).toBe('custom_creature');
    expect(modal.availableTypes.value[0].icon).toBe('🐉');
    // Selected initialEntityType
    expect(modal.selectedEntityType.value).toBe('artifact');
  });

  it('filters available types by search query', async () => {
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([
      {
        id: '1',
        project_id: 'test',
        type_key: 'mage',
        type_name: 'Маг',
        icon: '🧙',
        color: 'var(--accent)',
        fields_schema: [],
        full_schema: null,
        created_at: null,
      },
      {
        id: '2',
        project_id: 'test',
        type_key: 'spell',
        type_name: 'Заклинание',
        icon: '✨',
        color: 'var(--accent)',
        fields_schema: [],
        full_schema: null,
        created_at: null,
      },
    ]);

    const props = { isOpen: true, projectName: 'test-project' };
    const emit = vi.fn();
    const modal = useCreateEntityModal(props, emit);

    await modal.loadEntityTypes();

    modal.searchTypeQuery.value = 'заклинание';
    expect(modal.filteredTypes.value.length).toBe(1);
    expect(modal.filteredTypes.value[0].type).toBe('spell');
  });

  it('validates empty name on submit and sets error message', () => {
    const props = { isOpen: true, projectName: 'test-project' };
    const emit = vi.fn();
    const modal = useCreateEntityModal(props, emit);

    modal.entityName.value = '   ';
    modal.handleSubmit();

    expect(modal.errorMessage.value).toBe('Введите название сущности');
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits create event with entityType and trimmed name on valid submit', () => {
    const props = { isOpen: true, projectName: 'test-project' };
    const emit = vi.fn();
    const modal = useCreateEntityModal(props, emit);

    modal.selectedEntityType.value = 'character';
    modal.entityName.value = '  Мерлин  ';
    modal.handleSubmit();

    expect(modal.errorMessage.value).toBeNull();
    expect(emit).toHaveBeenCalledWith('create', {
      entityType: 'character',
      name: 'Мерлин',
    });
  });
});

