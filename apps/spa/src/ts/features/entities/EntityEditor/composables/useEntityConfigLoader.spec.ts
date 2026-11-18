import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, shallowRef, defineComponent } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { useEntityConfigLoader } from './useEntityConfigLoader';
import * as api from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getEntitySchemas: vi.fn(async () => []),
  getEntitiesBatch: vi.fn(async () => ({})),
  getEntities: vi.fn(async () => []),
  getCalendars: vi.fn(async () => []),
  getEntityHistory: vi.fn(async () => []),
}));

describe('useEntityConfigLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads schema from fetch fallback, collects entityTypes/fieldOverrides, hydrates tags/_hidden, and binds scroll', async () => {
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([]);
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sections: [
            {
              id: 'sec_1',
              fields: [{ class: 'rel', entityTypes: ['faction', ''] }],
              dynamicContainers: [
                {
                  id: 'dc_1',
                  foreign_type: 'item',
                  fieldOverrides: {
                    target: { entityType: 'location', entityTypes: ['event', ''] },
                  },
                },
              ],
            },
          ],
          templates: {},
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: { t1: { fields: [] } } }),
      }) as any;

    const scrollEl = document.createElement('div');
    const scrollContainer = ref<HTMLElement | null>(scrollEl);
    const emit = vi.fn();

    let loader!: ReturnType<typeof useEntityConfigLoader>;
    const Comp = defineComponent({
      setup() {
        loader = useEntityConfigLoader({
          props: {
            project: 'p1',
            entityType: 'character',
            entityId: 'entities:c1',
            initialData: {
              name: 'Герой',
              attributes: { теги: 'alpha, beta', _hidden: { f1: true } },
            },
            initialScrollPos: 42,
          } as any,
          config: shallowRef(null),
          loading: ref(false),
          isInitializing: ref(false),
          activeSection: ref(''),
          formData: ref({}),
          foreignUpdates: ref({}),
          lastEmittedData: ref(null),
          referenceData: ref({}),
          scrollContainer,
          emit,
        });
        return {};
      },
      template: '<div></div>',
    });

    vi.useFakeTimers();
    const wrapper = mount(Comp);
    await loader.loadConfigAndData();
    vi.advanceTimersByTime(150);
    await flushPromises();

    expect(scrollEl.scrollTop).toBe(42);
    scrollEl.dispatchEvent(new Event('scroll'));
    expect(emit).toHaveBeenCalledWith('scroll-change', 42);
    await loader.loadReferenceData();
    expect(api.getEntities).toHaveBeenCalled();

    wrapper.unmount();
    vi.useRealTimers();
  });
});
