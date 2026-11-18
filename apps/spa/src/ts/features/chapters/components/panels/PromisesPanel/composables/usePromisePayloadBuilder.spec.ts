import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  preparePromisePayload,
  createNewPromiseRecord,
  syncPromisesToLocalStorage,
} from './usePromisePayloadBuilder';
import type { RichPlotPromise } from './PromiseActions.model';

describe('usePromisePayloadBuilder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('preparePromisePayload sanitizes block ids, parent_id, arcs, and defaults', () => {
    const payload = preparePromisePayload(
      {
        id: 'plot_promises:1',
        project_id: 'p1',
        parent_id: 'plot_promises:`p0`',
        kind: '',
        title: '  ',
        quote: 'Цитата',
        block_id: 'text_blocks:blk_abc_para-3',
        block_ids: ['blocks:para-3', 'NONE'],
        arc_id: 'story_arcs:a1',
        is_flashback: true,
      } as unknown as RichPlotPromise,
      'chapters:fallback'
    );

    expect(payload.parent_id).toBe('plot_promises:p0');
    expect(payload.block_id).toBe('para-3');
    expect(payload.block_ids).toEqual(['para-3']);
    expect(payload.arcs).toEqual([{ arc_id: 'story_arcs:a1', arc_phase: 'setup' }]);
    expect(payload.chapter_id).toBe('chapters:fallback');
    expect(payload.title).toBe('Цитата');
    expect(payload.kind).toBe('gun');
    expect(payload.is_flashback).toBe(true);
  });

  it('createNewPromiseRecord builds a full promise record with defaults and arc fields', () => {
    const rec = createNewPromiseRecord('p1', 'chapters:1', {
      kind: 'foreshadowing',
      quote: '  Намек  ',
      paragraph_index: 4,
      block_id: 'para-4',
      arcs: [{ arc_id: 'arcs:1', arc_phase: 'escalation' }],
    });

    expect(rec.id).toMatch(/^plot_promises:/);
    expect(rec.title).toBe('Намек');
    expect(rec.arc_id).toBe('arcs:1');
    expect(rec.arc_phase).toBe('escalation');
    expect(rec.block_ids).toEqual(['para-4']);
  });

  it('syncPromisesToLocalStorage writes and handles storage errors', () => {
    syncPromisesToLocalStorage('', []);
    syncPromisesToLocalStorage('p1', [{ id: '1' } as RichPlotPromise]);
    expect(localStorage.getItem('ww_plot_promises_p1')).toContain('"id":"1"');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota');
    });
    syncPromisesToLocalStorage('p1', []);
    expect(warnSpy).toHaveBeenCalled();
    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
