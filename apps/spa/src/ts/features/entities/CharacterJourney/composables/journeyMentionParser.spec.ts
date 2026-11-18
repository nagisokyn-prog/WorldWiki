import { describe, it, expect } from 'vitest';
import {
  isAbstractPlaceholder,
  findParagraphIndexByQuote,
  extractParagraphMentions,
  isMentionCoveredByPromise,
} from './journeyMentionParser';

describe('journeyMentionParser', () => {
  it('detects abstract placeholders and empty quotes', () => {
    expect(isAbstractPlaceholder()).toBe(true);
    expect(isAbstractPlaceholder('   ')).toBe(true);
    expect(isAbstractPlaceholder('Упоминание в тексте (Глава 1)')).toBe(true);
    expect(isAbstractPlaceholder('Глава «Пролог»')).toBe(true);
    expect(isAbstractPlaceholder('Событие «Битва»')).toBe(true);
    expect(isAbstractPlaceholder('Настоящая цитата из текста')).toBe(false);
  });

  it('findParagraphIndexByQuote handles empty inputs, div fallback, scene headers, and blockId fallbacks', () => {
    expect(findParagraphIndexByQuote('', 'q')).toBeNull();
    expect(findParagraphIndexByQuote('<p>abc</p>', '   ')).toBeNull();
    expect(findParagraphIndexByQuote('<p>abc</p>', '...')).toBeNull();

    const htmlWithDivs = `
      <div class="editor-scene-header">Заголовок сцены</div>
      <div data-id="blk_1">Первый блок текста <span class="entity-icon">★</span></div>
      <div>Второй блок текста</div>
    `;
    const r1 = findParagraphIndexByQuote(htmlWithDivs, 'Первый блок текста');
    expect(r1).toEqual({ paragraphIndex: 1, blockId: 'blk_1' });

    const r2 = findParagraphIndexByQuote(htmlWithDivs, 'Второй блок текста');
    expect(r2).toEqual({ paragraphIndex: 2, blockId: 'para-2' });
  });

  it('extractParagraphMentions handles empty, plain text, nested elements, id/alias/name matches', () => {
    expect(extractParagraphMentions('', 'e1', 'Герой')).toEqual([]);

    const plain = 'Первый абзац.\n\nЗдесь Герой идёт домой.\n\nТретий.';
    const plainRes = extractParagraphMentions(plain, 'e1', 'Герой');
    expect(plainRes).toHaveLength(1);
    expect(plainRes[0]).toEqual({ text: 'Здесь Герой идёт домой.', paragraphIndex: 2, blockId: 'para-2' });

    const html = `
      <p data-block-id="b1">Упоминание ((Странник)) в начале</p>
      <p data-id="b2">Ссылка на <span data-id="hero_1">персонажа</span></p>
      <p>Просто текст про Арагорн без тегов</p>
    `;
    const htmlRes = extractParagraphMentions(html, 'entities:hero_1', 'Арагорн', ['Странник']);
    expect(htmlRes).toHaveLength(3);
    expect(htmlRes[0].blockId).toBe('b1');
    expect(htmlRes[1].blockId).toBe('b2');
    expect(htmlRes[2].blockId).toBe('para-3');
  });

  it('isMentionCoveredByPromise covers empty, chapter mismatch, paragraph_index, block_id, para-range, block_ids, and quote', () => {
    const mention = { text: 'Длинная цитата героя в таверне у огня', paragraphIndex: 3, blockId: 'b3' };
    expect(isMentionCoveredByPromise(mention, 'chapters:1', [])).toBe(false);

    // Chapter mismatch -> false
    expect(isMentionCoveredByPromise(mention, 'chapters:1', [{ chapter_id: 'chapters:2', paragraph_index: 3 } as any])).toBe(false);

    // Match by paragraph_index
    expect(isMentionCoveredByPromise(mention, 'chapters:1', [{ chapter_id: 'chapters:1', paragraph_index: 3 } as any])).toBe(true);

    // Match by block_id suffix
    expect(isMentionCoveredByPromise(mention, '1', [{ chapter_id: '1', block_id: 'prefix_b3' } as any])).toBe(true);

    // Match by para-range in block_id
    expect(isMentionCoveredByPromise(mention, '1', [{ chapter_id: '1', block_id: 'para-2..para-4' } as any])).toBe(true);
    expect(isMentionCoveredByPromise(mention, '1', [{ chapter_id: '1', block_id: 'para-5..para-6' } as any])).toBe(false);

    // Match by block_ids array (direct & range)
    expect(isMentionCoveredByPromise(mention, '1', [{ chapter_id: '1', block_ids: ['b3'] } as any])).toBe(true);
    expect(isMentionCoveredByPromise(mention, '1', [{ chapter_id: '1', block_ids: ['para-1..para-5'] } as any])).toBe(true);

    // Match by quote
    expect(
      isMentionCoveredByPromise(mention, '1', [
        { chapter_id: '1', quote: 'Длинная цитата героя в таверне у огня и далее' } as any,
      ])
    ).toBe(true);
  });
});
