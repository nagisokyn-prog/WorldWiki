import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useFloatingEntityEditor } from './useFloatingEntityEditor';
import * as api from '@/services/api.client';
import { entityApi } from '@/services/Entity/entity.api';

vi.mock('../../../services/api.client', () => ({
  getEntitySchemas: vi.fn()
}));

vi.mock('@/services/Entity/entity.api', () => ({
  entityApi: {
    getEntity: vi.fn()
  }
}));

describe('useFloatingEntityEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getEntitySchemas).mockResolvedValue([
      { type_key: 'character', type_name: 'Персонаж', full_schema: { sections: [] } }
    ] as never);
    vi.mocked(entityApi.getEntity).mockResolvedValue({
      id: 'entities:katya',
      name: 'Катя',
      tags: ['девочка', 'Мелкая']
    });
  });

  it('loads entity data on mount', async () => {
    const emit = vi.fn();
    const editor = useFloatingEntityEditor({
      project: 'p1',
      entityType: 'character',
      entityId: 'entities:katya',
      isOpen: true
    }, emit);

    await flushPromises();

    expect(entityApi.getEntity).toHaveBeenCalledWith('p1', 'character', 'entities:katya');
    expect(editor.entityData.value?.name).toBe('Катя');
  });

  it('reloads data when ww:tags-updated event is dispatched for this entity', async () => {
    const emit = vi.fn();
    useFloatingEntityEditor({
      project: 'p1',
      entityType: 'character',
      entityId: 'entities:katya',
      isOpen: true
    }, emit);

    await flushPromises();
    expect(entityApi.getEntity).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new CustomEvent('ww:tags-updated', {
      detail: { project: 'p1', entityId: 'entities:katya', tags: ['девочка', 'Мелкая', 'новая'] }
    }));
    await flushPromises();

    expect(entityApi.getEntity).toHaveBeenCalledTimes(2);
  });
});
