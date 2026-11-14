import { describe, it, expect } from 'vitest';
import { buildMultiJourneyTimelineItems } from './useMultiJourneyItemsBuilder';
import type { MultiJourneyResponse } from '../CharacterJourney.model';
import type { StoryArc } from '@/types/generated/StoryArc';

describe('useMultiJourneyItemsBuilder', () => {
  const storyArcs: StoryArc[] = [
    { id: 'story_arcs:a1', title: 'Главная арка', color: '#ff0000' } as unknown as StoryArc,
    { id: 'a2', title: 'Вторая арка', color: '#00ff00' } as unknown as StoryArc,
  ];

  it('returns empty array for null response', () => {
    expect(buildMultiJourneyTimelineItems(null, storyArcs)).toEqual([]);
  });

  it('builds scene items with aggregated arcs and fallback titles/quotes', () => {
    const response: MultiJourneyResponse = {
      entities: [{ id: 'e1', name: 'Алиса' }, { id: 'e2', name: 'Боб' }],
      scenes: [
        {
          id: 'sc1',
          chapter_id: 'chapters:c1',
          chapter_title: 'Пролог',
          volume_title: 'Том 1',
          sort_order: 1,
          paragraph_index: 3,
          block_id: 'b1',
          scene_m_abs: 100,
          scene_date_formatted: '1 января',
          quote: '',
          present_entities: [
            {
              entity_id: 'e1',
              entity_name: 'Алиса',
              arcs: [
                { arc_id: 'story_arcs:a1', arc_phase: 'climax' },
                { arc_id: '', arc_phase: 'setup' },
              ],
            },
            {
              entity_id: 'e2',
              entity_name: 'Боб',
              arcs: [
                { arc_id: 'a1', arc_phase: 'setup' },
                { arc_id: 'a3', arc_title: 'Кастом', color: '#123456' },
              ],
            },
          ],
        },
        {
          id: 'sc2',
          sort_order: 2,
          quote: 'Прямая цитата',
          present_entities: [{ entity_id: 'e1', entity_name: 'Алиса' }],
        },
      ],
      appearances: [],
    } as unknown as MultiJourneyResponse;

    const items = buildMultiJourneyTimelineItems(response, storyArcs, 'union');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'scene-sc1',
      title: 'Пролог',
      subtitle: 'Том 1 • Алиса, Боб',
      arc_id: 'story_arcs:a1',
      arc_title: 'Главная арка & Кастом',
      allArcIds: ['story_arcs:a1', 'a3'],
      badge: '2 перс.',
      badgeType: 'accent',
      description: 'Том: Том 1',
    });
    expect(items[0].fullText).toContain('Совместная сцена в главе «Пролог»');

    expect(items[1]).toMatchObject({
      id: 'scene-sc2',
      title: 'Глава #2',
      fullText: 'Прямая цитата',
      badge: '1 перс.',
      badgeType: 'muted',
      phaseLabel: '🌱 Сцена',
    });
  });

  it('deduplicates appearances, filters by intersection mode, and resolves string/object/fallback arcs', () => {
    const response = {
      entities: [{ id: 'e1', name: 'Алиса' }, { id: 'e2', name: 'Боб' }],
      scenes: [
        {
          id: 'sc1',
          chapter_id: 'chapters:c1',
          paragraph_index: 5,
          block_id: 'blk-scene',
          present_entities: [],
        },
      ],
      appearances: [
        // Covered by scene -> skipped
        {
          source: 'scene',
          chapter_id: 'chapters:c1',
          paragraph_index: 5,
          block_id: 'blk-scene',
          quote: 'Covered',
        },
        // Shared paragraph for both entities (intersection passes)
        {
          source: 'mention',
          chapter_id: 'chapters:c2',
          chapter_title: 'Встреча',
          paragraph_index: 2,
          quote: 'Вместе у костра',
          entity_name: 'Алиса',
          arcs: ['story_arcs:a1', { arc_id: 'a2', arc_phase: 'resolution' }, null],
        },
        {
          source: 'mention',
          chapter_id: 'chapters:c2',
          chapter_title: 'Встреча',
          paragraph_index: 2,
          quote: 'Вместе у костра',
          entity_name: 'Боб',
        },
        // Single entity mention (skipped in intersection, included in union)
        {
          source: 'scene',
          chapter_id: 'chapters:c3',
          chapter_order: 4,
          paragraph_index: 9,
          role: 'Наблюдатель',
          entity_name: 'Алиса',
          arc_id: 'story_arcs:a2',
        },
        {
          source: 'mention',
          chapter_id: 'chapters:c4',
          paragraph_index: 1,
          arc_id: 'custom-arc',
          arc_title: 'Арка 4',
          arc_color: '#abcdef',
        },
      ],
    } as unknown as MultiJourneyResponse;

    const intersection = buildMultiJourneyTimelineItems(response, storyArcs, 'intersection');
    expect(intersection).toHaveLength(2);
    expect(intersection[1]).toMatchObject({
      subtitle: 'Алиса & Боб • Упоминание в рукописи',
      arc_title: 'Главная арка & Вторая арка',
      allArcIds: ['story_arcs:a1', 'a2'],
    });

    const union = buildMultiJourneyTimelineItems(response, storyArcs, 'union');
    expect(union).toHaveLength(4);
    expect(union[2]).toMatchObject({
      fullText: 'Роль: Наблюдатель',
      badge: 'Сцена',
      arc_id: 'a2',
    });
    expect(union[3]).toMatchObject({
      title: 'Глава #?',
      arc_id: 'custom-arc',
      arc_title: 'Арка 4',
      arc_color: '#abcdef',
    });
  });
});

