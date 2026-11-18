import { describe, it, expect } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useFloatingEntities } from '../useFloatingEntities';

describe('useFloatingEntities', () => {
  it('opens and closes floating editors', () => {
    const floating = useFloatingEntities('proj_1');

    expect(floating.floatingEditors.value.length).toBe(0);

    floating.handleOpenEntity({ type: 'character', id: 'char_1' });
    expect(floating.floatingEditors.value.length).toBe(1);
    expect(floating.floatingEditors.value[0].entityId).toBe('char_1');

    const id = floating.floatingEditors.value[0].id;
    floating.closeFloatingEditor(id);
    expect(floating.floatingEditors.value.length).toBe(0);

    // Closing non-existent editor (idx === -1)
    floating.closeFloatingEditor('non_existent_id');
    expect(floating.floatingEditors.value.length).toBe(0);

    // Exception handling in handleOpenEntity
    const badData = {
      get type(): string { throw new Error('Data access error'); },
      id: '1',
    };
    floating.handleOpenEntity(badData as any);
  });

  it('registers window listener on mount and handles ww:open-floating-entity events', () => {
    let api!: ReturnType<typeof useFloatingEntities>;
    const Comp = defineComponent({
      setup() {
        api = useFloatingEntities('proj_1');
        return {};
      },
      template: '<div />',
    });

    const wrapper = mount(Comp);

    window.dispatchEvent(new CustomEvent('ww:open-floating-entity', { detail: {} }));
    expect(api.floatingEditors.value.length).toBe(0);

    window.dispatchEvent(
      new CustomEvent('ww:open-floating-entity', { detail: { type: 'location', id: 'loc_1' } })
    );
    expect(api.floatingEditors.value.length).toBe(1);
    expect(api.floatingEditors.value[0].entityId).toBe('loc_1');

    wrapper.unmount();

    window.dispatchEvent(
      new CustomEvent('ww:open-floating-entity', { detail: { type: 'location', id: 'loc_2' } })
    );
    expect(api.floatingEditors.value.length).toBe(1);
  });
});

