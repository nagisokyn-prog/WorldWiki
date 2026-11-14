import { describe, expect, it } from 'vitest';
import { normalizeSemanticDocument } from '../../ast/ASTNormalizer';
import type { CrossReferenceNode, FigureNode, HeadingNode } from '../../ast/types';
import { NumberingEngine } from '../../numbering/NumberingEngine';
import type { NumberingProfile } from '../../numbering/types';
import { CrossReferenceResolver } from '../CrossReferenceResolver';

const profile: NumberingProfile = {
  figureMode: 'global',
  tableMode: 'global',
  equationMode: 'global',
  footnoteRestartPerPage: false,
  headingNumberingEnabled: true,
  figurePrefix: 'Рисунок',
  tablePrefix: 'Таблица',
  equationFormat: 'parens'
};

describe('CrossReferenceResolver', () => {
  it('resolves valid figure cross references', () => {
    const doc = normalizeSemanticDocument({
      blocks: [
        {
          type: 'figure',
          id: 'fig-uuid-1',
          mediaUrl: '',
          captionContent: [{ type: 'text', text: 'Схема архитектуры' }],
          numberingMode: 'global',
          alignment: 'center'
        } as FigureNode
      ]
    });

    const ctx = NumberingEngine.compute(doc, profile);
    const refNode: CrossReferenceNode = {
      type: 'cross_reference',
      targetId: 'fig-uuid-1',
      kind: 'figure',
      displayMode: 'full'
    };

    const resolved = CrossReferenceResolver.resolve(refNode, doc, ctx, profile);
    expect(resolved.isBroken).toBe(false);
    expect(resolved.label).toBe('Рисунок 1');
    expect(resolved.targetTitle).toBe('Схема архитектуры');
  });

  it('formats short and number_only display modes', () => {
    const doc = normalizeSemanticDocument({
      blocks: [
        {
          type: 'figure',
          id: 'fig-1',
          mediaUrl: '',
          captionContent: [],
          numberingMode: 'global',
          alignment: 'center'
        } as FigureNode
      ]
    });

    const ctx = NumberingEngine.compute(doc, profile);

    const shortRef: CrossReferenceNode = {
      type: 'cross_reference',
      targetId: 'fig-1',
      kind: 'figure',
      displayMode: 'short'
    };
    expect(CrossReferenceResolver.resolve(shortRef, doc, ctx, profile).label).toBe('рис. 1');

    const numRef: CrossReferenceNode = {
      type: 'cross_reference',
      targetId: 'fig-1',
      kind: 'figure',
      displayMode: 'number_only'
    };
    expect(CrossReferenceResolver.resolve(numRef, doc, ctx, profile).label).toBe('1');
  });

  it('marks deleted targets as broken', () => {
    const doc = normalizeSemanticDocument({ blocks: [] });
    const ctx = NumberingEngine.compute(doc, profile);

    const brokenRef: CrossReferenceNode = {
      type: 'cross_reference',
      targetId: 'deleted-fig-id',
      kind: 'figure',
      displayMode: 'full'
    };

    const resolved = CrossReferenceResolver.resolve(brokenRef, doc, ctx, profile);
    expect(resolved.isBroken).toBe(true);
    expect(resolved.label).toContain('объект удален');
  });

  it('resolves heading references with section titles', () => {
    const doc = normalizeSemanticDocument({
      blocks: [
        {
          type: 'heading',
          id: 'h-sec-1',
          level: 1,
          content: [{ type: 'text', text: 'Глава 1. Теоретическая часть' }],
          numberingMode: 'auto'
        } as HeadingNode,
        {
          type: 'heading',
          id: 'h-sec-2',
          level: 2,
          content: [{ type: 'text', text: 'Архитектурный анализ' }],
          numberingMode: 'auto'
        } as HeadingNode
      ]
    });

    const ctx = NumberingEngine.compute(doc, profile);
    const ref: CrossReferenceNode = {
      type: 'cross_reference',
      targetId: 'h-sec-2',
      kind: 'heading',
      displayMode: 'full'
    };

    const resolved = CrossReferenceResolver.resolve(ref, doc, ctx, profile);
    expect(resolved.isBroken).toBe(false);
    expect(resolved.label).toBe('раздел 1.1');
    expect(resolved.targetTitle).toBe('Архитектурный анализ');
  });

  it('resolves table, equation, unnumbered targets, and quote/short/parens variants', () => {
    const doc = normalizeSemanticDocument({
      blocks: [
        {
          type: 'table',
          id: 'tbl-1',
          captionContent: [
            { type: 'text', text: 'Метрики ' },
            { type: 'math_inline', latex: 'x^2' },
          ],
          numberingMode: 'global',
          repeatHeaderOnPageBreak: true,
          keepWithCaption: true,
          rows: [
            {
              id: 'r1',
              isHeader: false,
              cells: [
                {
                  id: 'c1',
                  colSpan: 1,
                  rowSpan: 1,
                  content: [
                    {
                      type: 'paragraph',
                      id: 'p-in-cell',
                      content: [
                        {
                          type: 'cross_reference',
                          targetId: 'eq-1',
                          kind: 'equation',
                          displayMode: 'full',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'equation',
          id: 'eq-1',
          latex: 'E=mc^2',
          numberingMode: 'auto',
        },
        {
          type: 'equation',
          id: 'eq-unnumbered',
          latex: 'a+b',
          numberingMode: 'none',
        },
        {
          type: 'quote',
          id: 'q1',
          content: [
            {
              type: 'paragraph',
              id: 'p-in-quote',
              content: [
                {
                  type: 'footnote_reference',
                  id: 'fn-1',
                  content: [
                    {
                      type: 'cross_reference',
                      targetId: 'tbl-1',
                      kind: 'table',
                      displayMode: 'short',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const ctx = NumberingEngine.compute(doc, profile);
    const nodeMap = CrossReferenceResolver.buildNodeMap(doc);
    expect(nodeMap.has('p-in-cell')).toBe(true);
    expect(nodeMap.has('p-in-quote')).toBe(true);

    const tblFull = CrossReferenceResolver.resolve(
      { type: 'cross_reference', targetId: 'tbl-1', kind: 'table', displayMode: 'full' },
      doc,
      ctx,
      profile,
      nodeMap
    );
    expect(tblFull.label).toBe('Таблица 1');
    expect(tblFull.targetTitle).toBe('Метрики $x^2$');

    const unnumbered = CrossReferenceResolver.resolve(
      { type: 'cross_reference', targetId: 'eq-unnumbered', kind: 'equation', displayMode: 'full' },
      doc,
      ctx,
      profile,
      nodeMap
    );
    expect(unnumbered.isBroken).toBe(false);
    expect(unnumbered.label).toBe('[не пронумеровано]');

    const labelProfile: NumberingProfile = { ...profile, equationFormat: 'label' };
    const eqLabel = CrossReferenceResolver.resolve(
      { type: 'cross_reference', targetId: 'eq-1', kind: 'equation', displayMode: 'full' },
      doc,
      ctx,
      labelProfile
    );
    expect(eqLabel.label).toBe('формула 1');

    const all = CrossReferenceResolver.resolveAll(doc, ctx, profile);
    expect(all.get('eq-1')?.label).toBe('(1)');
    expect(all.get('tbl-1')?.label).toBe('табл. 1');
  });
});
