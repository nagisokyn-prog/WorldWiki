import { describe, it, expect } from 'vitest';
import { semanticASTToTiptap } from '../ast.astToTiptap';
import { normalizeSemanticDocument } from '../ASTNormalizer';
import { AcademicGOSTProfile } from '../../profiles/defaults';
import type { NumberingContext } from '../../numbering/types';

describe('ast.astToTiptap', () => {
  const ctx: NumberingContext = {
    headings: new Map([['h1', '1']]),
    figures: new Map([['fig1', '1']]),
    tables: new Map([['tbl1', '1']]),
    equations: new Map([['eq1', '1']]),
    footnotes: new Map([['fn1', 1]]),
  };

  it('converts all AST block and inline node types to Tiptap JSON', () => {
    const doc = normalizeSemanticDocument({
      blocks: [
        {
          id: 'h1',
          type: 'heading',
          level: 1,
          numberingMode: 'auto',
          content: [{ type: 'text', text: 'Введение' }],
        },
        {
          id: 'p1',
          type: 'paragraph',
          styleOverride: { alignment: 'justify', lineHeight: 1.5 },
          content: [
            {
              type: 'text',
              text: 'Форматированный',
              marks: [
                { type: 'bold' },
                { type: 'italic' },
                { type: 'underline' },
                { type: 'strike' },
                { type: 'code' },
                { type: 'subscript' },
                { type: 'superscript' },
                { type: 'fontFamily', font: 'Times New Roman' },
                { type: 'fontSize', sizePt: 14 },
                { type: 'color', color: '#ff0' },
                { type: 'link', href: 'https://example.com', title: 'Ex' },
              ],
            },
            { type: 'math_inline', latex: 'E=mc^2' },
            { type: 'cross_reference', targetId: 'fig1', kind: 'figure', displayMode: 'number_only' },
            { type: 'footnote_reference', id: 'fn1', content: [{ type: 'text', text: 'Сноска' }] },
          ],
        },
        {
          id: 'fig1',
          type: 'figure',
          mediaUrl: 'img.png',
          captionContent: [{ type: 'text', text: 'Схема' }],
          numberingMode: 'auto',
          alignment: 'center',
          width: '80%',
        },
        {
          id: 'tbl1',
          type: 'table',
          repeatHeaderOnPageBreak: true,
          keepWithCaption: true,
          rows: [
            {
              id: 'r1',
              isHeader: true,
              cells: [{ id: 'c1', colSpan: 2, rowSpan: 1, content: [] }],
            },
            {
              id: 'r2',
              isHeader: false,
              cells: [
                {
                  id: 'c2',
                  content: [{ id: 'cp', type: 'paragraph', content: [{ type: 'text', text: 'Cell' }] }],
                },
              ],
            },
          ],
        },
        { id: 'eq1', type: 'equation', latex: 'a^2+b^2=c^2', numberingMode: 'auto' },
        {
          id: 'q1',
          type: 'quote',
          content: [{ id: 'qp', type: 'paragraph', content: [{ type: 'text', text: 'Цитата' }] }],
        },
        {
          id: 'l1',
          type: 'list',
          variant: 'ordered',
          items: [
            { id: 'li1', content: [{ id: 'lp', type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }] },
            { id: 'li2', content: [] },
          ],
        },
        { id: 'unknown1', type: 'unknown_type' } as never,
      ],
    });

    const json = semanticASTToTiptap(doc, ctx, AcademicGOSTProfile.numbering);
    expect(json.type).toBe('doc');
    expect(json.content).toHaveLength(7); // unknown_type filtered out
    expect(json.content[0].type).toBe('heading');
    expect(json.content[1].content?.[0].marks).toHaveLength(11);
    expect(json.content[2].type).toBe('figure');
    expect(json.content[3].type).toBe('table');
    expect(json.content[4].type).toBe('equation');
    expect(json.content[5].type).toBe('blockquote');
    expect(json.content[6].type).toBe('orderedList');
  });
});
