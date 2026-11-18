import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { useCharacterJourney } from './useCharacterJourney';
import { getEntities } from '@/services/api.client';
import { useCalendarStore } from '@/stores/calendar.store';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import * as journeyLoader from './composables/journeyLoader';

vi.mock('@/services/api.client', () => ({
  getEntities: vi.fn(async () => []),
}));

vi.mock('./composables/journeyLoader', () => ({
  fetchAndEnrichSingleJourney: vi.fn(async () => ({
    entity_id: 'entities:c1',
    entity_name: 'Герой',
    entity_type: 'character',
    attributes: {},
    appearances: [],
    events: [],
    relations: [],
    promises: [],
  })),
  fetchAndEnrichMultiJourney: vi.fn(async () => ({
    entities: [],
    scenes: [],
    appearances: [],
  })),
}));

describe('useCharacterJourney', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads calendars/entities, supports single & multi entity selection, toggle, add, remove, and filterMode', async () => {
    const calStore = useCalendarStore();
    const arcsStore = useStoryArcsStore();
    vi.spyOn(calStore, 'getCalendars').mockResolvedValue([{ id: 'c1', is_master: true, data: { название: 'М', месяцы: [], эпохи: [] } }] as any);
    arcsStore.loadArcs = vi.fn(async () => undefined) as any;

    vi.mocked(getEntities).mockResolvedValue([
      { id: 'entities:c1', name: 'Герой', entity_type: 'character' },
      { id: 'entities:c2', name: 'Друг', entity_type: 'character' },
    ] as any);

    let journey!: ReturnType<typeof useCharacterJourney>;
    const Comp = defineComponent({
      setup() {
        journey = useCharacterJourney('p1');
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    await flushPromises();

    expect(journey.currentEntityId.value).toBe('entities:c1');
    expect(journey.currentEntity.value?.name).toBe('Герой');

    journey.addEntity('entities:c2');
    await flushPromises();
    expect(journey.isMultiEntity.value).toBe(true);
    expect(journeyLoader.fetchAndEnrichMultiJourney).toHaveBeenCalled();

    await journey.setFilterMode('intersection');
    expect(journey.filterMode.value).toBe('intersection');

    journey.removeEntity('entities:c2');
    await flushPromises();
    expect(journey.isMultiEntity.value).toBe(false);

    journey.toggleEntity('entities:c2');
    await flushPromises();
    journey.selectEntity('entities:c1');
    await flushPromises();
    expect(journey.selectedEntityIds.value).toEqual(['entities:c1']);

    wrapper.unmount();
  });

  it('handles empty projectId and loader errors gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(journeyLoader.fetchAndEnrichSingleJourney).mockRejectedValueOnce(new Error('boom'));

    let journey!: ReturnType<typeof useCharacterJourney>;
    const Comp = defineComponent({
      setup() {
        journey = useCharacterJourney('', 'entities:c1');
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    await flushPromises();
    expect(journey.error.value).toBe('boom');
    wrapper.unmount();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});
