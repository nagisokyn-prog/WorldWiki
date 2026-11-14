import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isAbstractPlaceholder,
  extractParagraphMentions,
  isMentionCoveredByPromise,
  enrichJourneyAppearances,
  enrichMultiJourneyScenes,
  enrichJourneyEvents,
} from './useJourneyManuscriptEnricher';
import type { JourneyPromise } from '../CharacterJourney.model';
import { chapterService } from '@/services/chapter.service';

const mockChapterStore = {
  currentChapter: null as { id: string; content: string } | null,
  chapters: [] as Array<{ id: string; title?: string; sort_order?: number; content?: string }>,
  loadChapters: vi.fn(),
};

vi.mock('@/stores/chapter.store', () => ({
  useChapterStore: () => mockChapterStore,
}));

vi.mock('@/services/chapter.service', () => ({
  chapterService: {
    get: vi.fn(),
  },
}));

describe('useJourneyManuscriptEnricher', () => {
  describe('isAbstractPlaceholder', () => {
    it('detects abstract placeholder strings', () => {
      expect(isAbstractPlaceholder('Упоминание в тексте (Глава «Глава 1. Дом?»)')).toBe(true);
      expect(isAbstractPlaceholder('Сцена в Глава «Глава 1. Дом?»')).toBe(true);
      expect(isAbstractPlaceholder('Совместная сцена в главе...')).toBe(true);
      expect(isAbstractPlaceholder('')).toBe(true);
      expect(isAbstractPlaceholder(null)).toBe(true);
      expect(isAbstractPlaceholder(undefined)).toBe(true);
    });

    it('identifies real manuscript quotes as non-placeholder', () => {
      expect(
        isAbstractPlaceholder(
          'Палец вдавил кнопку звонка, и раздалась длинная трель. Вероника и Кира вытянулись чуть ли не по стойке «смирно».'
        )
      ).toBe(false);
    });
  });

  describe('extractParagraphMentions', () => {
    it('extracts paragraphs mentioning entity via ((Name)) syntax', () => {
      const html = `
        <p>Начало главы без персонажей.</p>
        <p data-block-id="para-2">Тут появилась ((Кира)) и улыбнулась.</p>
        <p>И пошли они дальше.</p>
      `;

      const mentions = extractParagraphMentions(html, 'entities:kira', 'Кира');
      expect(mentions).toHaveLength(1);
      expect(mentions[0].paragraphIndex).toBe(2);
      expect(mentions[0].blockId).toBe('para-2');
      expect(mentions[0].text).toContain('Тут появилась ((Кира)) и улыбнулась.');
    });

    it('extracts paragraphs with data-entity-id attribute', () => {
      const html = `
        <p>Параграф 1.</p>
        <p data-block-id="para-2"><span class="entity-mention" data-entity-id="entities:kira">((Кира))</span> вошла в комнату.</p>
      `;

      const mentions = extractParagraphMentions(html, 'entities:kira', 'Кира');
      expect(mentions).toHaveLength(1);
      expect(mentions[0].paragraphIndex).toBe(2);
      expect(mentions[0].blockId).toBe('para-2');
      expect(mentions[0].text).toContain('вошла в комнату');
    });

    it('extracts multiple mentions across multiple paragraphs', () => {
      const html = `
        <p data-block-id="para-1">Первое появление ((Кира)).</p>
        <p data-block-id="para-2">Пустой текст.</p>
        <p data-block-id="para-3">Второе появление ((Кира)).</p>
      `;

      const mentions = extractParagraphMentions(html, 'entities:kira', 'Кира');
      expect(mentions).toHaveLength(2);
      expect(mentions[0].paragraphIndex).toBe(1);
      expect(mentions[1].paragraphIndex).toBe(3);
    });

    it('returns empty array when character is not mentioned', () => {
      const html = `<p>Тут только Алексей и Вероника.</p>`;
      const mentions = extractParagraphMentions(html, 'entities:kira', 'Кира');
      expect(mentions).toEqual([]);
    });
  });

  describe('isMentionCoveredByPromise', () => {
    const promises: JourneyPromise[] = [
      {
        id: 'prom-1',
        chapter_id: 'chapters:ch1',
        paragraph_index: 13,
        block_id: 'para-13',
        quote: 'Палец вдавил кнопку звонка, и раздалась длинная трель. Вероника и Кира вытянулись...',
      },
    ];

    it('returns true when mention is in the exact paragraph of an existing scene', () => {
      const mention = {
        text: 'Палец вдавил кнопку звонка, и раздалась длинная трель. Вероника и Кира вытянулись...',
        paragraphIndex: 13,
        blockId: 'para-13',
      };
      expect(isMentionCoveredByPromise(mention, 'chapters:ch1', promises)).toBe(true);
    });

    it('returns false when mention is outside of any scene (standalone mention)', () => {
      const mention = {
        text: 'Ника и Кира слегка отошли и прислонились к забору...',
        paragraphIndex: 27,
        blockId: 'para-27',
      };
      expect(isMentionCoveredByPromise(mention, 'chapters:ch1', promises)).toBe(false);
    });

    it('returns false when chapter does not match', () => {
      const mention = {
        text: 'Палец вдавил кнопку звонка...',
        paragraphIndex: 13,
        blockId: 'para-13',
      };
      expect(isMentionCoveredByPromise(mention, 'chapters:ch2', promises)).toBe(false);
    });

    it('returns true when mention is within range block_id of scene', () => {
      const rangePromise: JourneyPromise[] = [
        {
          id: 'prom-range',
          chapter_id: 'chapters:ch1',
          block_id: 'para-3..para-7',
        },
      ];
      const mention = {
        text: '— Да-да, как скажешь, мамочка.',
        paragraphIndex: 5,
        blockId: 'para-5',
      };
      expect(isMentionCoveredByPromise(mention, 'chapters:ch1', rangePromise)).toBe(true);
    });

    it('correctly extracts individual paragraphs nested inside scene wrapper div', () => {
      const html = `
        <div class="narrative-frame">
          <p data-block-id="para-1">— Эй, Лёша, постучись.</p>
          <p data-block-id="para-2">— Успокойся, Ника.</p>
          <p data-block-id="para-3">— Да-да, как скажешь, <a href="/ui_editor.html?id=entities%3Akira">мамочка</a>.</p>
          <p data-block-id="para-4">— Так, <a href="/ui_editor.html?id=entities%3Akira">сестра</a>, хватит.</p>
        </div>
      `;

      const mentions = extractParagraphMentions(html, 'entities:kira', 'Кира');
      expect(mentions).toHaveLength(2);
      expect(mentions[0].paragraphIndex).toBe(3);
      expect(mentions[0].blockId).toBe('para-3');
      expect(mentions[0].text).toContain('мамочка');
      expect(mentions[1].paragraphIndex).toBe(4);
      expect(mentions[1].blockId).toBe('para-4');
      expect(mentions[1].text).toContain('сестра');
    });
  });

  describe('enrichJourneyAppearances, enrichMultiJourneyScenes & enrichJourneyEvents', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockChapterStore.currentChapter = null;
      mockChapterStore.chapters = [];
    });

    it('enrichJourneyAppearances handles empty, scene dedup, placeholder enrichment, and loader fallbacks', async () => {
      expect(await enrichJourneyAppearances('p1', [], 'e1', 'Кира')).toEqual([]);

      mockChapterStore.currentChapter = {
        id: 'chapters:c1',
        content: '<p data-block-id="b1">((Кира)) вошла в зал.</p><p data-block-id="b2">Второй абзац про ((Кира)).</p>',
      };
      mockChapterStore.chapters = [
        { id: 'chapters:c2', content: '<p>Просто текст без упоминаний</p>' },
      ];
      vi.mocked(chapterService.get).mockRejectedValue(new Error('net err'));

      const promises: JourneyPromise[] = [
        {
          id: 'pr1',
          chapter_id: 'chapters:c1',
          quote: '((Кира)) вошла в зал.',
          paragraph_index: 0,
        },
      ];

      const res = await enrichJourneyAppearances(
        'p1',
        [
          { id: 'a0', chapter_id: '', source: 'mention' } as never,
          { id: 'a1', chapter_id: 'chapters:c1', source: 'scene', quote: '((Кира)) вошла' } as never,
          { id: 'a2', chapter_id: 'chapters:c3', source: 'scene', quote: 'Сцена 3' } as never,
          { id: 'a3', chapter_id: 'chapters:c1', source: 'mention', quote: 'Упоминание в тексте', paragraph_index: 0 } as never,
          { id: 'a4', chapter_id: 'chapters:c2', source: 'mention', quote: 'Упоминание в тексте', paragraph_index: 0 } as never,
          { id: 'a5', chapter_id: 'chapters:c4', source: 'mention', quote: 'Упоминание в тексте', paragraph_index: 0 } as never,
          { id: 'a6', chapter_id: 'chapters:c1', source: 'mention', quote: 'Готовая цитата', paragraph_index: 9 } as never,
        ],
        'entities:kira',
        'Кира',
        [],
        promises
      );

      expect(promises[0].paragraph_index).toBe(1);
      expect(promises[0].block_id).toBe('b1');
      // a0, a2, mention from b2 (a3), a4, a5, a6
      expect(res.some((r) => r.id === 'a0')).toBe(true);
      expect(res.some((r) => r.id === 'a2')).toBe(true);
      expect(res.some((r) => r.quote === 'Второй абзац про ((Кира)).')).toBe(true);
      expect(res.some((r) => r.id === 'a6')).toBe(true);
    });

    it('enrichMultiJourneyScenes deduplicates and enriches scenes from manuscript', async () => {
      expect(await enrichMultiJourneyScenes('p1', [])).toEqual([]);

      vi.mocked(chapterService.get).mockResolvedValue({
        id: 'chapters:c1',
        content: '<p data-block-id="p1">((Алиса)) и Боб встретились.</p>',
      } as never);

      const scenes = await enrichMultiJourneyScenes('proj1', [
        { id: 's0', chapter_id: '' } as never,
        {
          id: 's1',
          chapter_id: 'chapters:c1',
          quote: 'Сцена',
          paragraph_index: 0,
          present_entities: [{ entity_id: 'e1', entity_name: 'Алиса' }],
        } as never,
        {
          id: 's1',
          chapter_id: 'chapters:c1',
          quote: 'Дубль',
          paragraph_index: 0,
          present_entities: [],
        } as never,
        {
          id: 's2',
          chapter_id: 'chapters:c2',
          quote: 'Готовый текст сцены',
          paragraph_index: 3,
          present_entities: [],
        } as never,
      ]);

      expect(scenes).toHaveLength(2);
      expect(scenes[0].quote).toBe('((Алиса)) и Боб встретились.');
      expect(scenes[1].id).toBe('s2');
    });

    it('enrichJourneyEvents resolves missing chapter_id via store and enriches existing chapter events', async () => {
      expect(await enrichJourneyEvents('p1', [])).toEqual([]);

      mockChapterStore.loadChapters.mockRejectedValueOnce(new Error('load err'));
      const noChaps = await enrichJourneyEvents('p1', [{ event_id: 'ev1', event_title: 'Битва' } as never]);
      expect(noChaps).toHaveLength(1);

      mockChapterStore.chapters = [
        { id: 'chapters:c1', title: 'Глава 1', sort_order: 1, content: '<p data-block-id="b9">((Битва)) началась.</p>' },
      ];
      const evs = await enrichJourneyEvents('p1', [
        { event_id: 'ev1', event_title: 'Битва' } as never,
        { event_id: 'ev2', event_title: 'Мир', chapter_id: 'chapters:c1', quote: 'Ок', paragraph_index: 2, block_id: 'b2' } as never,
        { event_id: 'ev3', event_title: 'Нету', chapter_id: 'chapters:c1' } as never,
      ]);

      expect(evs[0]).toMatchObject({ chapter_id: 'chapters:c1', chapter_title: 'Глава 1', quote: '((Битва)) началась.', paragraph_index: 1 });
      expect(evs[1].quote).toBe('Ок');
      expect(evs[2].chapter_id).toBe('chapters:c1');
    });
  });
});
