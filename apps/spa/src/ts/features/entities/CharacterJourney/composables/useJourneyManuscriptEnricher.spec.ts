import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  enrichJourneyAppearances,
  enrichMultiJourneyScenes,
  enrichJourneyEvents,
} from './useJourneyManuscriptEnricher';
import { chapterService } from '@/services/chapter.service';
import { useChapterStore } from '@/stores/chapter.store';

vi.mock('@/services/chapter.service', () => ({
  chapterService: {
    get: vi.fn(),
  },
}));

describe('useJourneyManuscriptEnricher', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('enrichJourneyAppearances handles empty, promise quote matching, scene dedupe, and mention extraction', async () => {
    expect(await enrichJourneyAppearances('p1', [], 'e1', 'Герой')).toEqual([]);

    const store = useChapterStore();
    store.currentChapter = {
      id: 'chapters:c1',
      content: '<p data-block-id="b1">Герой вошёл в зал.</p><p data-block-id="b2">И увидел дракона.</p>',
    } as any;
    store.chapters = [
      { id: 'chapters:c2', content: '<p data-block-id="b3">Вторая глава с Герой в тексте.</p>', sort_order: 2, title: 'Глава 2' } as any,
    ];
    vi.mocked(chapterService.get).mockRejectedValueOnce(new Error('not found'));

    const promises: any[] = [
      { id: 'pr1', chapter_id: 'chapters:c1', quote: 'И увидел дракона.', paragraph_index: 1, block_id: '', kind: 'scene' },
    ];
    const appearances: any[] = [
      { chapter_id: '', source: 'mention' },
      { chapter_id: 'chapters:c1', source: 'scene', quote: 'И увидел дракона.', block_id: 'b2', paragraph_index: 2 },
      { chapter_id: 'chapters:c99', source: 'scene', quote: 'Другая сцена' },
      { chapter_id: 'chapters:c2', source: 'mention', quote: '...', paragraph_index: 0 },
      { chapter_id: 'chapters:c2', source: 'mention', quote: '...', paragraph_index: 0 }, // duplicate paragraph key
      { chapter_id: 'chapters:c3', source: 'mention', quote: '...' }, // chapterService.get fails -> ''
      { chapter_id: 'chapters:c2', source: 'mention', quote: 'Точная цитата', paragraph_index: 3 },
    ];

    const res = await enrichJourneyAppearances('p1', appearances, 'e1', 'Герой', ['ГГ'], promises);
    expect(res.some((a) => a.chapter_id === '')).toBe(true);
    expect(res.some((a) => a.chapter_id === 'chapters:c99')).toBe(true);
    expect(res.some((a) => a.chapter_id === 'chapters:c2' && a.block_id === 'b3')).toBe(true);
    expect(res.some((a) => a.chapter_id === 'chapters:c3')).toBe(true);
  });

  it('enrichMultiJourneyScenes handles empty, dedupe, and chapter mention enrichment', async () => {
    expect(await enrichMultiJourneyScenes('p1', [])).toEqual([]);

    const store = useChapterStore();
    store.chapters = [
      { id: 'chapters:c1', content: '<p data-block-id="b1">Алиса встретила Боба.</p>' } as any,
      { id: 'chapters:c2', content: '<p data-block-id="b2">Пустой абзац.</p>' } as any,
    ];

    const scenes: any[] = [
      { chapter_id: '' },
      { id: 's1', chapter_id: 'chapters:c1', quote: 'Готовая цитата', paragraph_index: 2 },
      { id: 's1', chapter_id: 'chapters:c1', quote: 'Дубликат', paragraph_index: 2 },
      {
        chapter_id: 'chapters:c1',
        paragraph_index: 1,
        sort_order: 1,
        quote: '...',
        present_entities: [{ entity_id: 'e1', entity_name: 'Алиса' }, { entity_id: 'e2', entity_name: 'Боб' }],
      },
      {
        chapter_id: 'chapters:c2',
        sort_order: 2,
        quote: '...',
        present_entities: [],
      },
      {
        chapter_id: 'chapters:c_missing',
        sort_order: 3,
        quote: '...',
      },
    ];
    vi.mocked(chapterService.get).mockResolvedValueOnce({ content: '' } as any);

    const res = await enrichMultiJourneyScenes('p1', scenes);
    expect(res).toHaveLength(4);
    expect(res[1].chapter_id).toBe('chapters:c1');
  });

  it('enrichJourneyEvents handles empty, loadChapters fallback + error, and existing chapter_id', async () => {
    expect(await enrichJourneyEvents('p1', [])).toEqual([]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = useChapterStore();
    store.chapters = [];
    store.loadChapters = vi.fn().mockRejectedValueOnce(new Error('load err'));

    const resErr = await enrichJourneyEvents('p1', [{ event_id: 'ev1', event_title: 'Битва' } as any]);
    expect(resErr).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();

    store.chapters = [
      { id: '' } as any,
      { id: 'chapters:empty', content: '' } as any,
      { id: 'chapters:c1', title: 'Битва у реки', sort_order: 3, content: '<p data-block-id="b9">Великая Битва началась.</p>' } as any,
    ];
    vi.mocked(chapterService.get).mockResolvedValueOnce({ content: '' } as any);

    const res = await enrichJourneyEvents('p1', [
      { event_id: 'ev1', event_title: 'Битва' } as any,
      { event_id: 'ev2', event_title: 'Событие', chapter_id: 'chapters:c1', quote: 'Готово', paragraph_index: 1, block_id: 'b1' } as any,
      { event_id: 'ev3', event_title: 'Битва', chapter_id: 'chapters:c1', quote: '...' } as any,
    ]);
    expect(res[0].chapter_title).toBe('Битва у реки');
    expect(res[0].chapter_order).toBe(3);
    expect(res[0].block_id).toBe('b9');
    expect(res[1].block_id).toBe('b1');
    expect(res[2].block_id).toBe('b9');
    warnSpy.mockRestore();
  });
});
