import { describe, it, expect } from 'vitest';
import {
  isAbstractPlaceholder,
  extractParagraphMentions,
  isMentionCoveredByPromise,
} from './useJourneyManuscriptEnricher';
import type { JourneyPromise } from '../CharacterJourney.model';

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
});
