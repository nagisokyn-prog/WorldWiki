import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCrossReferenceMatrix } from './useCrossReferenceMatrix';
import { useAnalyticsStore } from '@/stores/analytics.store';

vi.mock('@/services/api.client', () => ({
  getCrossReferenceMatrix: vi.fn(),
  auditManuscriptConsistency: vi.fn(),
  getManuscriptStatistics: vi.fn(),
}));

describe('useCrossReferenceMatrix Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('computes rows, total appearances, and gap warnings correctly', () => {
    const store = useAnalyticsStore();
    store.matrixData = {
      chapters: [
        { id: 'ch:1', title: 'Глава 1', sort_order: 1, word_count: 1000 },
        { id: 'ch:2', title: 'Глава 2', sort_order: 2, word_count: 1200 },
        { id: 'ch:3', title: 'Глава 3', sort_order: 3, word_count: 800 },
        { id: 'ch:4', title: 'Глава 4', sort_order: 4, word_count: 1500 },
        { id: 'ch:5', title: 'Глава 5', sort_order: 5, word_count: 1100 },
      ],
      entities: [
        {
          id: 'ent:rudeus',
          name: 'Рудеус',
          entity_type: 'character',
          appearances: [
            { chapter_id: 'ch:1', source: 'scene' },
            { chapter_id: 'ch:5', source: 'mention' },
          ],
        },
        {
          id: 'ent:eris',
          name: 'Эрис',
          entity_type: 'character',
          appearances: [
            { chapter_id: 'ch:1', source: 'scene' },
            { chapter_id: 'ch:2', source: 'scene' },
          ],
        },
      ],
    };

    const { rows, chapters, availableEntityTypes } = useCrossReferenceMatrix('test_proj');

    expect(chapters.value).toHaveLength(5);
    expect(availableEntityTypes.value).toEqual(['character']);
    expect(rows.value).toHaveLength(2);

    const rudeusRow = rows.value.find(r => r.entity.name === 'Рудеус');
    expect(rudeusRow).toBeDefined();
    expect(rudeusRow?.totalAppearances).toBe(2);
    // Gap from ch:1 to ch:5 is 3 chapters (ch:2, ch:3, ch:4) -> gap warning should be true!
    expect(rudeusRow?.hasGapWarning).toBe(true);

    const erisRow = rows.value.find(r => r.entity.name === 'Эрис');
    expect(erisRow?.totalAppearances).toBe(2);
    expect(erisRow?.hasGapWarning).toBe(false);
  });

  it('filters rows by entity type and search query', () => {
    const store = useAnalyticsStore();
    store.matrixData = {
      chapters: [{ id: 'ch:1', title: 'Глава 1', sort_order: 1, word_count: 1000 }],
      entities: [
        { id: 'ent:1', name: 'Рудеус', entity_type: 'character', appearances: [] },
        { id: 'ent:2', name: 'Северный Замок', entity_type: 'location', appearances: [] },
      ],
    };

    const { rows, filters } = useCrossReferenceMatrix('test_proj');

    expect(rows.value).toHaveLength(2);

    filters.value.selectedEntityType = 'location';
    expect(rows.value).toHaveLength(1);
    expect(rows.value[0].entity.name).toBe('Северный Замок');

    filters.value.selectedEntityType = 'all';
    filters.value.searchQuery = 'руд';
    expect(rows.value).toHaveLength(1);
    expect(rows.value[0].entity.name).toBe('Рудеус');
  });

  it('supports appearances_by_chapter format returned by Rust backend DTO', () => {
    const store = useAnalyticsStore();
    store.matrixData = {
      chapters: [
        { id: 'chapters:1', title: 'Глава 1', sort_order: 1, word_count: 1000 },
        { id: 'chapters:2', title: 'Глава 2', sort_order: 2, word_count: 1200 },
      ],
      entities: [
        {
          id: 'entities:veronika',
          name: 'Вероника',
          entity_type: 'character',
          appearances_by_chapter: [
            { chapter_id: 'chapters:1', kind: 'mention' },
            { chapter_id: 'chapters:2', kind: 'none' },
          ],
        },
      ],
    };

    const { rows, formatWordCount } = useCrossReferenceMatrix('test_proj');
    expect(rows.value).toHaveLength(1);
    expect(rows.value[0].totalAppearances).toBe(1);
    expect(rows.value[0].cells.get('chapters:1')?.status).toBe('mention');
    expect(rows.value[0].cells.get('chapters:2')?.status).toBe('absent');

    expect(formatWordCount(1450)).toBe('1.5k сл.');
    expect(formatWordCount(450)).toBe('450 сл.');
    expect(formatWordCount(0)).toBe('0 сл.');
  });
});
