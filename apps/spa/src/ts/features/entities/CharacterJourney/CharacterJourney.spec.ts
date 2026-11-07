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

  it('supports multi-character journey with union/intersection mode and meeting gaps', async () => {
    vi.mocked(apiClient.getEntities).mockResolvedValue([
      { id: 'ent:vladimir', name: 'Владимир', entity_type: 'character', project_id: 'test_proj', attributes: {}, tags: [] },
      { id: 'ent:sonya', name: 'Соня', entity_type: 'character', project_id: 'test_proj', attributes: {}, tags: [] },
    ]);
    vi.mocked(apiClient.getStoryArcs).mockResolvedValue([
      { id: 'arc:rebellion', project_id: 'test_proj', title: 'Арка Бунта', description: null, arc_type: 'main', status: 'active', color: 'var(--color-accent)' },
    ]);
    vi.mocked(apiClient.getMultiCharacterJourney).mockResolvedValue({
      total_scenes: 2,
      filter_mode: 'union',
      requested_entity_ids: ['ent:vladimir', 'ent:sonya'],
      scenes: [
        {
          id: 'scene_1',
          item_type: 'scene',
          chapter_id: 'ch_1',
          chapter_title: 'Глава 1. Первая встреча',
          volume_title: 'Том I',
          sort_order: 1,
          scene_m_abs: 1000,
          scene_date_formatted: '1 день 1 года',
          present_entities: [
            {
              entity_id: 'ent:vladimir',
              entity_name: 'Владимир',
              role_in_story: 'Протагонист',
              status_category: 'Жив',
              age_label: '20 лет',
              is_before_birth: false,
              is_deceased: false,
              arcs: [{ arc_id: 'arc:rebellion', arc_title: 'Арка Бунта', arc_phase: 'setup', color: 'var(--color-accent)' }],
            },
            {
              entity_id: 'ent:sonya',
              entity_name: 'Соня',
              role_in_story: 'Спутница',
              status_category: 'Жива',
              age_label: '18 лет',
              is_before_birth: false,
              is_deceased: false,
              arcs: [],
            },
          ],
          meeting_gap: null,
        },
        {
          id: 'scene_5',
          item_type: 'scene',
          chapter_id: 'ch_5',
          chapter_title: 'Глава 5. Встреча после бури',
          volume_title: 'Том I',
          sort_order: 5,
          scene_m_abs: 5000,
          scene_date_formatted: '5 день 1 года',
          present_entities: [
            {
              entity_id: 'ent:vladimir',
              entity_name: 'Владимир',
              role_in_story: 'Протагонист',
              status_category: 'Жив',
              age_label: '20 лет',
              is_before_birth: false,
              is_deceased: false,
              arcs: [{ arc_id: 'arc:rebellion', arc_title: 'Арка Бунта', arc_phase: 'climax', color: 'var(--color-accent)' }],
            },
            {
              entity_id: 'ent:sonya',
              entity_name: 'Соня',
              role_in_story: 'Спутница',
              status_category: 'Жива',
              age_label: '18 лет',
              is_before_birth: false,
              is_deceased: false,
              arcs: [],
            },
          ],
          meeting_gap: {
            chapters_count: 3,
            minutes_delta: 4000,
            formatted_label: '⏳ Не виделись 3 главы',
          },
        },
      ],
    });

    const journey = useCharacterJourney('test_proj', 'ent:vladimir');
    // Add second entity
    journey.addEntity('ent:sonya');
    expect(journey.selectedEntityIds.value).toEqual(['ent:vladimir', 'ent:sonya']);
    expect(journey.isMultiEntity.value).toBe(true);

    await journey.refresh();

    expect(apiClient.getMultiCharacterJourney).toHaveBeenCalledWith(
      'test_proj',
      ['ent:vladimir', 'ent:sonya'],
      'union'
    );

    expect(journey.timelineItems.value).toHaveLength(2);
    expect(journey.timelineItems.value[0].participants).toHaveLength(2);
    expect(journey.timelineItems.value[1].meetingGap?.formatted_label).toBe('⏳ Не виделись 3 главы');
    expect(journey.timelineItems.value[0].boundArcs?.[0].arcTitle).toBe('Арка Бунта');

    // Test filter mode change
    journey.setFilterMode('intersection');
    expect(journey.filterMode.value).toBe('intersection');
  });

  it('preserves real paragraph quote, block_id, and paragraph_index in timeline items for editor jumping', async () => {
    vi.mocked(apiClient.getEntities).mockResolvedValueOnce([
      { id: 'ent:1', name: 'Алексей', entity_type: 'character', project_id: 'test_proj', attributes: {}, tags: [] },
    ]);
    vi.mocked(apiClient.getStoryArcs).mockResolvedValueOnce([]);
    vi.mocked(apiClient.getCharacterJourney).mockResolvedValueOnce({
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

  it('includes manuscript mentions for all characters in multi-journey union mode and filters in intersection mode', async () => {
    vi.mocked(apiClient.getEntities).mockResolvedValue([
      { id: 'ent:kira', name: 'Кира', entity_type: 'character', project_id: 'test_proj', attributes: {}, tags: [] },
      { id: 'ent:dmitry', name: 'Дмитрий', entity_type: 'character', project_id: 'test_proj', attributes: {}, tags: [] },
    ]);
    vi.mocked(apiClient.getStoryArcs).mockResolvedValue([]);
    vi.mocked(apiClient.getMultiCharacterJourney).mockResolvedValue({
      total_scenes: 1,
      filter_mode: 'union',
      requested_entity_ids: ['ent:kira', 'ent:dmitry'],
      entities: [
        { id: 'ent:kira', name: 'Кира' },
        { id: 'ent:dmitry', name: 'Дмитрий' },
      ],
      scenes: [
        {
          id: 'scene_return',
          item_type: 'scene',
          chapter_id: 'ch_1',
          chapter_title: 'Глава 1. Дом?',
          sort_order: 1,
          present_entities: [
            { entity_id: 'ent:kira', entity_name: 'Кира' },
            { entity_id: 'ent:dmitry', entity_name: 'Дмитрий' },
          ],
        },
      ],
    });

    vi.mocked(apiClient.getCharacterJourney).mockImplementation(async (_proj, entId) => {
      if (entId === 'ent:kira') {
        return {
          entity_id: 'ent:kira',
          entity_name: 'Кира',
          appearances: [
            {
              chapter_id: 'ch_1',
              chapter_title: 'Глава 1. Дом?',
              source: 'mention',
              quote: 'Палец вдавил кнопку звонка, и раздалась длинная трель...',
              paragraph_index: 13,
              block_id: 'para-13',
            },
            {
              chapter_id: 'ch_1',
              chapter_title: 'Глава 1. Дом?',
              source: 'mention',
              quote: 'Ника и Кира слегка отошли...',
              paragraph_index: 27,
              block_id: 'para-27',
            },
          ],
          events: [],
          relations: [],
          promises: [],
        };
      }
      return {
        entity_id: 'ent:dmitry',
        entity_name: 'Дмитрий',
        appearances: [
          {
            chapter_id: 'ch_1',
            chapter_title: 'Глава 1. Дом?',
            source: 'mention',
            quote: 'Палец вдавил кнопку звонка, и раздалась длинная трель...',
            paragraph_index: 13,
            block_id: 'para-13',
          },
        ],
        events: [],
        relations: [],
        promises: [],
      };
    });

    const journey = useCharacterJourney('test_proj', 'ent:kira');
    journey.addEntity('ent:dmitry');
    await journey.refresh();

    // In union mode: 1 scene + 2 unique mentions (para 13 merged for Кира & Дмитрий, and para 27 for Кира) = 3 items
    expect(journey.timelineItems.value).toHaveLength(3);
    const para13Item = journey.timelineItems.value.find((i) => i.paragraph_index === 13);
    expect(para13Item).toBeDefined();
    expect(para13Item?.subtitle).toContain('Кира & Дмитрий');

    const para27Item = journey.timelineItems.value.find((i) => i.paragraph_index === 27);
    expect(para27Item).toBeDefined();
    expect(para27Item?.subtitle).toContain('Кира');

    // In intersection mode: para 27 is excluded (only Кира), para 13 is kept (both Кира & Дмитрий)
    journey.setFilterMode('intersection');
    await journey.refresh();
    const para27InIntersection = journey.timelineItems.value.find((i) => i.paragraph_index === 27);
    expect(para27InIntersection).toBeUndefined();
  });
});


