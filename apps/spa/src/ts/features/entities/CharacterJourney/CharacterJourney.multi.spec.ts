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

describe('useCharacterJourney Multi-Entity Mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
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

    await journey.setFilterMode('intersection');
    expect(journey.filterMode.value).toBe('intersection');
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

    expect(journey.timelineItems.value).toHaveLength(3);
    const para13Item = journey.timelineItems.value.find((i) => i.paragraph_index === 13);
    expect(para13Item).toBeDefined();
    expect(para13Item?.subtitle).toContain('Кира & Дмитрий');

    const para27Item = journey.timelineItems.value.find((i) => i.paragraph_index === 27);
    expect(para27Item).toBeDefined();
    expect(para27Item?.subtitle).toContain('Кира');

    journey.setFilterMode('intersection');
    await journey.refresh();
    const para27InIntersection = journey.timelineItems.value.find((i) => i.paragraph_index === 27);
    expect(para27InIntersection).toBeUndefined();
  });
});

