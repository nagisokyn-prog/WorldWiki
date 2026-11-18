import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeSemanticDocument } from '@/services/document/ast/ASTNormalizer';
import type { FigureNode, HeadingNode } from '@/services/document/ast/types';
import { NumberingEngine } from '@/services/document/numbering/NumberingEngine';
import { AcademicGOSTProfile } from '@/services/document/profiles/defaults';
import { useAcademicInspector } from '../useAcademicInspector';

describe('useAcademicInspector', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('builds reactive lists of headings and figures from AST', () => {
    const doc = normalizeSemanticDocument({
      blocks: [
        {
          type: 'heading',
          id: 'h-1',
          level: 1,
          content: [{ type: 'text', text: 'Введение' }],
          numberingMode: 'auto'
        } as HeadingNode,
        {
          type: 'figure',
          id: 'fig-1',
          mediaUrl: '',
          captionContent: [{ type: 'text', text: 'Схема БД' }],
          numberingMode: 'global',
          alignment: 'center'
        } as FigureNode
      ]
    });

    const ctx = NumberingEngine.compute(doc, AcademicGOSTProfile.numbering);

    const { headingsList, figuresList, activeTab } = useAcademicInspector({
      editor: null,
      document: doc,
      numberingContext: ctx
    });

    expect(activeTab.value).toBe('toc');
    expect(headingsList.value.length).toBe(1);
    expect(headingsList.value[0].title).toBe('Введение');
    expect(headingsList.value[0].number).toBe('1');

    expect(figuresList.value.length).toBe(1);
    expect(figuresList.value[0].title).toBe('Схема БД');
    expect(figuresList.value[0].number).toBe('1');
  });

  it('inserts cross-reference into editor when requested', () => {
    const doc = normalizeSemanticDocument({
      blocks: [
        {
          type: 'figure',
          id: 'fig-1',
          mediaUrl: '',
          captionContent: [{ type: 'text', text: 'Диаграмма' }],
          numberingMode: 'global',
          alignment: 'center'
        } as FigureNode
      ]
    });

    const ctx = NumberingEngine.compute(doc, AcademicGOSTProfile.numbering);

    const insertContentMock = vi.fn().mockReturnThis();
    const runMock = vi.fn();
    const mockEditor = {
      chain: () => ({
        focus: () => ({
          insertContent: insertContentMock,
          run: runMock
        })
      })
    };

    const { insertReference } = useAcademicInspector({
      editor: mockEditor as unknown as Parameters<typeof useAcademicInspector>[0]['editor'],
      document: doc,
      numberingContext: ctx
    });

    insertReference({
      id: 'fig-1',
      kind: 'figure',
      number: '1',
      title: 'Диаграмма'
    });

    expect(insertContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cross_reference',
        attrs: expect.objectContaining({
          targetId: 'fig-1',
          kind: 'figure',
          resolvedLabel: 'Рисунок 1'
        })
      })
    );
  });

  it('builds tablesList and equationsList, jumps to node with highlight timer, and switches profile', () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    const classList = { add: vi.fn(), remove: vi.fn() };
    const qsSpy = vi.spyOn(document, 'querySelector').mockReturnValue({
      scrollIntoView,
      classList,
    } as unknown as HTMLElement);

    const doc = normalizeSemanticDocument({
      blocks: [
        { type: 'table', id: 'tbl-1', rows: [] } as never,
        { type: 'equation', id: 'eq-1', latex: 'x^2', numberingMode: 'auto' } as never,
      ],
    });
    const ctx = NumberingEngine.compute(doc, AcademicGOSTProfile.numbering);
    const insertContentMock = vi.fn().mockReturnThis();
    const runMock = vi.fn();
    const mockEditor = {
      chain: () => ({ focus: () => ({ insertContent: insertContentMock, run: runMock }) }),
    };

    const insp = useAcademicInspector({
      editor: mockEditor as never,
      document: doc,
      numberingContext: ctx,
    });

    expect(insp.tablesList.value).toHaveLength(1);
    expect(insp.equationsList.value).toHaveLength(1);

    insp.jumpToNode('tbl-1');
    expect(scrollIntoView).toHaveBeenCalled();
    expect(classList.add).toHaveBeenCalledWith('ww-target-highlight');
    vi.advanceTimersByTime(1600);
    expect(classList.remove).toHaveBeenCalledWith('ww-target-highlight');

    insp.insertReference({ id: 'tbl-1', kind: 'table', number: '1', title: 'Таблица' });
    insp.insertReference({ id: 'h-1', kind: 'heading', number: '1', title: 'Раздел' });
    expect(insertContentMock).toHaveBeenCalledTimes(2);

    insp.switchProfile(insp.activeProfileId.value);
    expect(insp.allProfiles.value.length).toBeGreaterThan(0);

    qsSpy.mockRestore();
    vi.useRealTimers();
  });
});
