import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCharacterJourney } from './useCharacterJourney';
import * as apiClient from '@/services/api.client';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api.client', () => ({
  getCharacterJourney: vi.fn(),
  getMultiCharacterJourney: vi.fn(),
  getEntities: vi.fn(),
  getStoryArcs: vi.fn(),
}));

describe('useCharacterJourney Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('aggregates appearances, events, relations, and promises into chronological stream and arc groups', async () => {
    vi.mocked(apiClient.getEntities).mockResolvedValueOnce([
      { id: 'ent:1', name: 'Сонечка', entity_type: 'character', project_id: 'test_proj', attributes: {}, tags: [] },
    ]);
    vi.mocked(apiClient.getStoryArcs).mockResolvedValueOnce([
      { id: 'arc:1', project_id: 'test_proj', title: 'Арка Искупления', description: null, arc_type: 'main', status: 'active', color: 'var(--color-accent)' },
    ]);
    vi.mocked(apiClient.getCharacterJourney).mockResolvedValueOnce({
      entity_id: 'ent:1',
      entity_name: 'Сонечка',
      entity_type: 'character',
      appearances: [
        { chapter_id: 'ch:1', chapter_title: 'Глава 1: Знакомство', chapter_order: 1, source: 'scene' },
        { chapter_id: 'ch:5', chapter_title: 'Глава 5: Исповедь', chapter_order: 5, source: 'scene' },
      ],
      events: [
        { event_id: 'ev:1', event_title: 'Трагедия на Сенной', m_abs: 1200, role: 'Свидетель' },
        { event_id: 'ev:2', event_title: 'Флэшбек: Воспоминание детства', m_abs: 100, role: 'Участник' },
      ],
      relations: [
        { id: 'rel:1', target_name: 'Раскольников', rel_type: 'сострадание', strength: 90, start_order: 1 },
      ],
      promises: [
        {
          id: 'prom:1',
          kind: 'scene',
          quote: 'Чтение Евангелия',
          status: 'planted',
          planted_order: 4,
          arc_id: 'arc:1',
          arc_title: 'Арка Искупления',
          arc_phase: 'climax',
        },
        {
          id: 'prom:2',
          kind: 'gun',
          quote: 'Желтый билет на столе',
          status: 'planted',
          planted_order: 2,
          arc_id: 'arc:1',
          arc_phase: 'setup',
        },
      ],
    });

    const { timelineItems, arcGroups, viewMode, filterType, refresh } = useCharacterJourney('test_proj', 'ent:1');
    await refresh();

    // 1. Total items check (2 events + 1 relation + 2 promises + 2 appearances = 7 items)
    expect(timelineItems.value.length).toBe(7);

    // 2. Arc Grouping check
    expect(arcGroups.value.length).toBeGreaterThan(0);
    const redemptionArc = arcGroups.value.find((g) => g.arcId === 'arc:1');
    expect(redemptionArc).toBeDefined();
    expect(redemptionArc?.items.some((i) => i.id === 'prom-prom:1')).toBe(true);

    // 3. Filter by scenes
    filterType.value = 'scenes';
    expect(timelineItems.value.length).toBe(3);

    // 4. Filter by promises (guns)
    filterType.value = 'promises';
    expect(timelineItems.value.length).toBe(1);
    expect(timelineItems.value[0].kind).toBe('gun');

    // 5. Reset filter and switch to Chronology mode
    filterType.value = 'all';
    viewMode.value = 'CHRONOLOGY';
    expect(timelineItems.value.length).toBe(7);
    // 6. Check fullText preservation and phase labels
    const promiseItem = timelineItems.value.find((i) => i.id === 'prom-prom:1');
    expect(promiseItem?.fullText).toBe('Чтение Евангелия');
    expect(promiseItem?.phaseLabel).toBe('🔥 Кульминация');
  });

  it('correctly handles scenes assigned to multiple story arcs simultaneously', async () => {
    vi.mocked(apiClient.getEntities).mockResolvedValueOnce([
      { id: 'ent:1', name: 'Сонечка', entity_type: 'character', project_id: 'test_proj', attributes: {}, tags: [] },
    ]);
    vi.mocked(apiClient.getStoryArcs).mockResolvedValueOnce([
      { id: 'arc:1', project_id: 'test_proj', title: 'Арка Греха', description: null, arc_type: 'main', status: 'active', color: 'var(--color-danger)' },
      { id: 'arc:2', project_id: 'test_proj', title: 'Арка Спасения', description: null, arc_type: 'main', status: 'active', color: 'var(--color-success)' },
    ]);
    vi.mocked(apiClient.getCharacterJourney).mockResolvedValueOnce({
      entity_id: 'ent:1',
      entity_name: 'Сонечка',
      entity_type: 'character',
      appearances: [],
      events: [],
      relations: [],
      promises: [
        {
          id: 'prom:multi',
          kind: 'scene',
          quote: 'Встреча в каморке: диалог о жертве и вере',
          status: 'planted',
          planted_order: 3,
          arcs: [
            { arc_id: 'arc:1', arc_phase: 'climax' },
            { arc_id: 'arc:2', arc_phase: 'setup' },
          ],
        },
      ],
    });

    const { timelineItems, arcGroups, selectedArcFilter, refresh } = useCharacterJourney('test_proj', 'ent:1');
    await refresh();

    // 1. Check multi-arc parsed structure
    expect(timelineItems.value.length).toBe(1);
    const sceneItem = timelineItems.value[0];
    expect(sceneItem.boundArcs).toHaveLength(2);
    expect(sceneItem.allArcIds).toEqual(['arc:1', 'arc:2']);
    expect(sceneItem.arc_title).toBe('Арка Греха & Арка Спасения');
    expect(sceneItem.boundArcs?.[0].phaseLabel).toBe('🔥 Кульминация');
    expect(sceneItem.boundArcs?.[1].phaseLabel).toBe('🌱 Завязка');

    // 2. Check scene presence in BOTH arc groups in tree
    const arc1Group = arcGroups.value.find((g) => g.arcId === 'arc:1');
    const arc2Group = arcGroups.value.find((g) => g.arcId === 'arc:2');
    expect(arc1Group?.items.some((i) => i.id === 'prom-prom:multi')).toBe(true);
    expect(arc2Group?.items.some((i) => i.id === 'prom-prom:multi')).toBe(true);

    // 3. Filter by Arc 1 -> item should still be visible
    selectedArcFilter.value = 'arc:1';
    expect(timelineItems.value.length).toBe(1);

    // 4. Filter by Arc 2 -> item should still be visible
    selectedArcFilter.value = 'arc:2';
    expect(timelineItems.value.length).toBe(1);

    // 5. Filter by UNASSIGNED -> item should NOT be visible
    selectedArcFilter.value = 'UNASSIGNED';
    expect(timelineItems.value.length).toBe(0);
  });

  it('calculates dynamic age for scenes and detects before-birth events', async () => {
    vi.mocked(apiClient.getEntities).mockResolvedValueOnce([
      {
        id: 'ent:hero',
        name: 'Главный Герой',
        entity_type: 'character',
        project_id: 'test_proj',
        attributes: {
          дата_рождения: { era_index: 0, year: 1, month: 0, day: 1 },
        },
        tags: [],
      },
    ]);
    vi.mocked(apiClient.getStoryArcs).mockResolvedValueOnce([]);
    vi.mocked(apiClient.getCharacterJourney).mockResolvedValueOnce({
      entity_id: 'ent:hero',
      entity_name: 'Главный Герой',
      entity_type: 'character',
      attributes: {
        дата_рождения: { era_index: 0, year: 1, month: 0, day: 1 },
      },
      appearances: [],
      events: [
        {
          event_id: 'ev:prehistory',
          event_title: 'Древняя Война',
          m_abs: -500000, // strictly before birth
        },
      ],
      relations: [],
      promises: [
        {
          id: 'prom:future',
          kind: 'scene',
          quote: 'Взрослая битва',
          status: 'planted',
          planted_order: 1,
          date_fields: { era_index: 0, year: 26, month: 0, day: 1 }, // exactly 25 years after year 1
        },
      ],
    });

    const { timelineItems, refresh } = useCharacterJourney('test_proj', 'ent:hero');
    await refresh();

    expect(timelineItems.value).toHaveLength(2);

    const preEvent = timelineItems.value.find((i) => i.id === 'ev-ev:prehistory');
    expect(preEvent?.isBeforeBirth).toBe(true);
    expect(preEvent?.ageLabel).toContain('До рождения');

    const futureScene = timelineItems.value.find((i) => i.id === 'prom-prom:future');
    expect(futureScene?.isBeforeBirth).toBe(false);
    expect(futureScene?.ageLabel).toBe('25 лет');
  });

  it('preserves real paragraph quote, block_id, and paragraph_index in timeline items for editor jumping', async () => {
    vi.mocked(apiClient.getEntities).mockResolvedValue([
      { id: 'ent:1', name: 'Алексей', entity_type: 'character', project_id: 'test_proj', attributes: {}, tags: [] },
    ]);
    vi.mocked(apiClient.getStoryArcs).mockResolvedValue([]);
    vi.mocked(apiClient.getCharacterJourney).mockResolvedValue({
      entity_id: 'ent:1',
      entity_name: 'Алексей',
      entity_type: 'character',
      appearances: [
        {
          chapter_id: 'ch:1',
          chapter_title: 'Глава 1. Дом?',
          chapter_order: 1,
          source: 'mention',
          quote: 'Я достал из внутреннего кармана кителя своё слегка потрёпанное удостоверение...',
          block_id: 'para-13',
          paragraph_index: 13,
        },
      ],
      events: [],
      relations: [],
      promises: [],
    });

    const journey = useCharacterJourney('test_proj', 'ent:1');
    await journey.refresh();

    expect(journey.timelineItems.value).toHaveLength(1);
    const item = journey.timelineItems.value[0];
    expect(item.fullText).toBe('Я достал из внутреннего кармана кителя своё слегка потрёпанное удостоверение...');
    expect(item.paragraph_index).toBe(13);
    expect(item.block_id).toBe('para-13');
  });

  it('covers selectEntity, toggleEntity, addEntity, removeEntity, setFilterMode, error handling, and onMounted', async () => {
    const { defineComponent } = await import('vue');
    const { mount, flushPromises } = await import('@vue/test-utils');

    vi.mocked(apiClient.getEntities).mockReset();
    vi.mocked(apiClient.getStoryArcs).mockReset();
    vi.mocked(apiClient.getCharacterJourney).mockReset();
    vi.mocked(apiClient.getEntities).mockResolvedValue([
      { id: 'entities:e1', name: 'Герой 1', entity_type: 'character', project_id: 'test_proj', attributes: {}, tags: [] },
      { id: 'entities:e2', name: 'Герой 2', entity_type: 'character', project_id: 'test_proj', attributes: {}, tags: [] },
    ]);
    vi.mocked(apiClient.getStoryArcs).mockResolvedValue([]);
    vi.mocked(apiClient.getCharacterJourney).mockResolvedValue({
      entity_id: 'entities:e1',
      entity_name: 'Герой 1',
      entity_type: 'character',
      appearances: [],
      events: [],
      relations: [],
      promises: [],
    });

    let journey!: ReturnType<typeof useCharacterJourney>;
    const Comp = defineComponent({
      setup() {
        journey = useCharacterJourney('test_proj', 'entities:e1');
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    await flushPromises();

    expect(journey.currentEntity.value?.name).toBe('Герой 1');

    journey.addEntity('entities:e2');
    journey.addEntity('entities:e2'); // duplicate guard
    expect(journey.selectedEntityIds.value).toEqual(['entities:e1', 'entities:e2']);
    expect(journey.selectedEntities.value).toHaveLength(2);

    await journey.setFilterMode('only_together');
    expect(journey.filterMode.value).toBe('only_together');

    journey.toggleEntity('entities:e2'); // removes e2
    expect(journey.selectedEntityIds.value).toEqual(['entities:e1']);
    journey.toggleEntity('entities:e1'); // cannot remove last entity
    expect(journey.selectedEntityIds.value).toEqual(['entities:e1']);

    journey.toggleEntity('entities:e2'); // adds e2 back
    journey.removeEntity('entities:e2');
    expect(journey.selectedEntityIds.value).toEqual(['entities:e1']);

    journey.selectEntity('entities:e2');
    expect(journey.selectedEntityIds.value).toEqual(['entities:e2']);

    // Error branch in loadJourney
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.getCharacterJourney).mockRejectedValueOnce('raw journey fail');
    await journey.refresh();
    expect(journey.error.value).toBe('raw journey fail');
    errSpy.mockRestore();

    // currentEntityId setter, removeEntity <=1 guard, setFilterMode same/single, selectEntity('')
    journey.currentEntityId.value = 'entities:e1';
    expect(journey.currentEntityId.value).toBe('entities:e1');
    journey.removeEntity('entities:e1');
    expect(journey.selectedEntityIds.value).toEqual(['entities:e1']);
    await journey.setFilterMode('only_together'); // same mode
    await journey.setFilterMode('union'); // single entity -> no loadJourney
    journey.currentEntityId.value = '';
    expect(journey.selectedEntityIds.value).toEqual([]);
    journey.selectEntity('');
    expect(journey.data.value).toBeNull();

    wrapper.unmount();

    // Empty projectId & getEntities failure & auto-select first entity
    const emptyProj = useCharacterJourney('');
    await emptyProj.refresh();
    expect(emptyProj.data.value).toBeNull();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(apiClient.getEntities).mockRejectedValueOnce(new Error('ent fail'));
    const { useCalendarStore } = await import('@/stores/calendar.store');
    const calStore = useCalendarStore();
    vi.spyOn(calStore, 'getCalendars').mockRejectedValueOnce(new Error('cal fail'));

    const CompNoInit = defineComponent({
      setup() {
        journey = useCharacterJourney('test_proj');
        return {};
      },
      template: '<div></div>',
    });
    const w2 = mount(CompNoInit);
    await flushPromises();
    w2.unmount();
    warnSpy.mockRestore();
  });
});


