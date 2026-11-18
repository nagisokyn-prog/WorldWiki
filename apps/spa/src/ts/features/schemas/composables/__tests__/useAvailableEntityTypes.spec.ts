import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { useAvailableEntityTypes } from '../useAvailableEntityTypes';
import * as api from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getEntitySchemas: vi.fn(),
}));

describe('useAvailableEntityTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads custom schemas on mount, deduplicates builtin types, and handles errors', async () => {
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([
      { type_key: 'character', type_name: 'Dup' },
      { type_key: 'magic_system', type_name: 'Магия', icon: '✨' },
    ] as never);

    let hook!: ReturnType<typeof useAvailableEntityTypes>;
    const Comp = defineComponent({
      setup() {
        hook = useAvailableEntityTypes('proj-1');
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    await flushPromises();

    expect(hook.isLoading.value).toBe(false);
    expect(hook.availableTypes.value.some((t) => t.value === 'magic_system' && t.icon === '✨')).toBe(true);
    expect(hook.availableTypes.value.filter((t) => t.value === 'character')).toHaveLength(1);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(api.getEntitySchemas).mockRejectedValueOnce(new Error('fail'));
    await hook.loadTypes();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    wrapper.unmount();
  });
});
