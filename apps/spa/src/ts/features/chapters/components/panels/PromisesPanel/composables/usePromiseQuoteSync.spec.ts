import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { createPromiseQuoteSync } from './usePromiseQuoteSync';
import type { RichPlotPromise } from './PromiseActions.model';
import type { PromisesPanelProps } from '../PromisesPanel.model';

describe('usePromiseQuoteSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeSync = (html: string | null, initial: RichPlotPromise[], project = 'proj_1') => {
    const promises = ref<RichPlotPromise[]>(initial);
    const onUpdatePromise = vi.fn().mockResolvedValue(undefined);
    const props = {
      project,
      chapterId: 'chapters:c1',
      chapterData: html === null ? null : { content: html },
    } as unknown as PromisesPanelProps;

    const { syncQuotesWithManuscript, cleanup } = createPromiseQuoteSync({
      props,
      promises,
      onUpdatePromise,
    });
    return { promises, onUpdatePromise, syncQuotesWithManuscript, cleanup };
  };

  it('skips when chapterData/content is empty or has no paragraphs', () => {
    const s1 = makeSync(null, []);
    s1.syncQuotesWithManuscript();
    const s2 = makeSync('<div>no paragraphs</div>', []);
    s2.syncQuotesWithManuscript();
    expect(s1.onUpdatePromise).not.toHaveBeenCalled();
  });

  it('syncs multi-block block_ids, single block_id, and schedules debounced backend sync', async () => {
    const html = `
      <p data-block-id="blk_1_a">Новый первый блок</p>
      <p data-block-id="blk_1_b">Новый второй блок</p>
      <p data-block-id="single-id">Обновлённый одиночный блок</p>
    `;
    const initial: RichPlotPromise[] = [
      {
        id: 'p_other',
        chapter_id: 'chapters:c2',
        quote: 'Другая глава',
      } as RichPlotPromise,
      {
        id: 'p_multi',
        chapter_id: 'chapters:c1',
        block_ids: ['text_blocks:blk_1_a', 'blk_1_b'],
        quote: 'Старая цитата',
        title: 'Старая цитата',
        is_orphaned: true,
      } as RichPlotPromise,
      {
        id: 'p_single',
        chapter_id: 'chapters:c1',
        block_id: 'blocks:single-id',
        quote: 'Старый текст',
        is_orphaned: true,
      } as RichPlotPromise,
    ];

    const { promises, onUpdatePromise, syncQuotesWithManuscript, cleanup } = makeSync(html, initial);
    syncQuotesWithManuscript(true);

    expect(promises.value[1].quote).toBe('Новый первый блок\nНовый второй блок');
    expect(promises.value[1].is_orphaned).toBe(false);
    expect(promises.value[2].quote).toBe('Обновлённый одиночный блок');
    expect(promises.value[2].is_orphaned).toBe(false);
    expect(localStorage.getItem('ww_plot_promises_proj_1')).toBeTruthy();

    await vi.advanceTimersByTimeAsync(1200);
    expect(onUpdatePromise).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it('syncs via Path 1.5 direct paragraph search and fullDocText', () => {
    const html = `
      <p>Вступление к главе.</p>
      <p>Герой открыл древнюю дверь и шагнул во тьму.</p>
      <div><span>Текст вне параграфа целиком</span></div>
    `;
    const initial: RichPlotPromise[] = [
      {
        id: 'p_direct',
        chapter_id: 'chapters:c1',
        quote: 'Герой открыл древнюю дверь',
        is_orphaned: true,
      } as RichPlotPromise,
      {
        id: 'p_full',
        chapter_id: 'chapters:c1',
        quote: 'Текст вне параграфа целиком',
        is_orphaned: true,
      } as RichPlotPromise,
    ];

    const { promises, syncQuotesWithManuscript } = makeSync(html, initial);
    syncQuotesWithManuscript();

    expect(promises.value[0].paragraph_index).toBe(2);
    expect(promises.value[0].is_orphaned).toBe(false);
    expect(promises.value[1].is_orphaned).toBe(false);
  });

  it('reconstructs multi-paragraph quote via Path 2 boundary matching and marks unmatched as orphaned', () => {
    const html = `
      <p>Начало великой сцены у ворот.</p>
      <p>Середина сцены была изменена.</p>
      <p>Конец великой сцены на закате.</p>
    `;
    const initial: RichPlotPromise[] = [
      {
        id: 'p_bound',
        chapter_id: 'chapters:c1',
        block_ids: ['para-1', 'para-3'],
        quote: 'Начало великой сцены у ворот.\nСтарая середина\nКонец великой сцены на закате.',
        title: 'Начало великой сцены у ворот.\nСтарая середина\nКонец великой сцены на закате.',
        milestones: [{ quote: 'old', order_index: 1, block_id: 'para-1' }],
      } as unknown as RichPlotPromise,
      {
        id: 'p_orphan',
        chapter_id: 'chapters:c1',
        quote: 'Абсолютно отсутствующая\nмногострочная цитата',
      } as RichPlotPromise,
    ];

    const { promises, syncQuotesWithManuscript, cleanup } = makeSync(html, initial);
    syncQuotesWithManuscript(true);

    expect(promises.value[0].quote).toBe(
      'Начало великой сцены у ворот.\nСередина сцены была изменена.\nКонец великой сцены на закате.'
    );
    expect(promises.value[0].block_ids).toEqual(['para-1', 'para-2', 'para-3']);
    expect(promises.value[0].milestones?.[0].order_index).toBe(1);
    expect(promises.value[1].is_orphaned).toBe(true);

    // Cancel pending timer via cleanup
    cleanup();
    vi.advanceTimersByTime(1500);
  });

  it('covers empty html, skipped promises, orphaned recovery, and block_id single-paragraph match', () => {
    const emptySync = makeSync('', [{ id: 'p1', chapter_id: 'chapters:c1', quote: 'x' } as any]);
    emptySync.syncQuotesWithManuscript(false);

    const html = `
      <p data-block-id="para-1">Точная цитата сцены.</p>
      <p data-block-id="para-2">Второй абзац длинной сцены здесь.</p>
    `;
    const list: RichPlotPromise[] = [
      { id: '', chapter_id: 'chapters:c1', quote: 'skip' } as any,
      { id: 'p_empty', chapter_id: 'chapters:c1', quote: '   ', block_ids: [] } as any,
      {
        id: 'p_recover',
        chapter_id: 'chapters:c1',
        quote: 'Точная цитата сцены.',
        block_id: 'para-1',
        is_orphaned: true,
      } as any,
      {
        id: 'p_update_single',
        chapter_id: 'chapters:c1',
        quote: 'Старая цитата',
        block_id: 'para-2',
        is_orphaned: true,
      } as any,
    ];

    const { promises, syncQuotesWithManuscript } = makeSync(html, list);
    syncQuotesWithManuscript(false);
    expect(promises.value[2].is_orphaned).toBe(false);
    expect(promises.value[3].quote).toBe('Второй абзац длинной сцены здесь.');
    expect(promises.value[3].is_orphaned).toBe(false);
  });

  it('covers fullDocText match, minParaIdx/expectedSpan fallbacks, ratio guard, and storage/DOM errors', () => {
    const html = `
      <p data-block-id="para-1">Первый абзац — с тире в конце строки.</p>
      <p data-block-id="para-2">Второй абзац длинного фрагмента текста.</p>
      <p data-block-id="para-3">Третий абзац завершает сцену красиво.</p>
    `;
    const list: RichPlotPromise[] = [
      {
        id: 'p_fulltext',
        chapter_id: 'chapters:c1',
        quote: 'тире в конце строки Второй абзац',
        is_orphaned: true,
      } as any,
      {
        id: 'p_span_fallback',
        chapter_id: 'chapters:c1',
        quote: 'Первый абзац — неизвестный финал',
        paragraph_index: 1,
        block_ids: ['para-1', 'para-2'],
      } as any,
      {
        id: 'p_ratio_skip',
        chapter_id: 'chapters:c1',
        quote: 'Первый абзац — Третий абзац завершает сцену красиво.' + 'x'.repeat(2000),
      } as any,
    ];

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { promises, syncQuotesWithManuscript } = makeSync(html, list);
    syncQuotesWithManuscript(true);
    expect(promises.value[0].is_orphaned).toBe(false);
    expect(warnSpy).toHaveBeenCalled();

    // DOMParser error branch
    const OrigDOMParser = globalThis.DOMParser;
    vi.stubGlobal('DOMParser', class { parseFromString() { throw new Error('parse fail'); } });
    syncQuotesWithManuscript(false);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    vi.stubGlobal('DOMParser', OrigDOMParser);

    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

