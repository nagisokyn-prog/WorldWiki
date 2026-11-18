import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useFloatingEntityEditor } from './useFloatingEntityEditor';
import * as api from '@/services/api.client';
import { entityApi } from '@/services/Entity/entity.api';

vi.mock('@/services/api.client', () => ({
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

  it('covers windowTitle, entityIcon variants, handleSave, close, mount/unmount, and error catch', async () => {
    const { defineComponent } = await import('vue');
    const { mount } = await import('@vue/test-utils');
    const emit = vi.fn();

    let ed!: ReturnType<typeof useFloatingEntityEditor>;
    const Comp = defineComponent({
      setup() {
        ed = useFloatingEntityEditor(
          { project: 'p1', entityType: 'location', entityId: 'loc1', isOpen: true },
          emit
        );
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    await flushPromises();

    expect(ed.windowTitle.value).toBe('Редактор: Location');
    expect(ed.entityIcon.value).toBe('fas fa-map-marker-alt');
    ed.handleSave();
    expect(emit).toHaveBeenCalledWith('saved');
    ed.close();
    expect(emit).toHaveBeenCalledWith('close');
    wrapper.unmount();

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.getEntitySchemas).mockRejectedValueOnce(new Error('schema fail'));
    const itemEd = useFloatingEntityEditor(
      { project: 'p1', entityType: 'item', entityId: 'i1', isOpen: true },
      emit
    );
    await flushPromises();
    expect(itemEd.entityIcon.value).toBe('fas fa-box-open');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();

    const otherEd = useFloatingEntityEditor(
      { project: 'p1', entityType: 'custom', entityId: 'c1', isOpen: false },
      emit
    );
    expect(otherEd.entityIcon.value).toBe('fas fa-edit');

    // Reactive watch & character icon & event edge cases
    const { reactive } = await import('vue');
    const rProps = reactive({ project: 'p1', entityType: 'character', entityId: 'c1', isOpen: false });
    const rEd = useFloatingEntityEditor(rProps, emit);
    expect(rEd.entityIcon.value).toBe('fas fa-user-edit');

    rProps.isOpen = true;
    await flushPromises();
    expect(entityApi.getEntity).toHaveBeenCalledWith('p1', 'character', 'c1');

    document.dispatchEvent(new CustomEvent('ww:tags-updated', { detail: null }));
    document.dispatchEvent(new CustomEvent('ww:tags-updated', { detail: { id: 'other' } }));
  });
});
