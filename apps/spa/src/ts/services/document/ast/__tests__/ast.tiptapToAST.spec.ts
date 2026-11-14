import { describe, it, expect } from 'vitest';
import {
  convertMark,
  convertTiptapInlinesToAST,
  convertTiptapBlockToAST,
  tiptapToSemanticAST,
} from '../ast.tiptapToAST';

describe('ast.tiptapToAST', () => {
  describe('convertMark', () => {
    it('converts all supported marks and handles unknown/empty marks', () => {
      expect(convertMark({ type: 'bold' })).toEqual({ type: 'bold' });
      expect(convertMark({ type: 'italic' })).toEqual({ type: 'italic' });
      expect(convertMark({ type: 'underline' })).toEqual({ type: 'underline' });
      expect(convertMark({ type: 'strike' })).toEqual({ type: 'strike' });
      expect(convertMark({ type: 'code' })).toEqual({ type: 'code' });
      expect(convertMark({ type: 'textStyle', attrs: { color: '#ff0000' } })).toEqual({
        type: 'color',
        color: '#ff0000',
      });
      expect(convertMark({ type: 'textStyle', attrs: { fontSize: '14pt' } })).toEqual({
        type: 'fontSize',
        sizePt: 14,
      });
      expect(convertMark({ type: 'textStyle', attrs: { fontSize: 'bad' } })).toEqual({
        type: 'fontSize',
        sizePt: 12,
      });
      expect(convertMark({ type: 'textStyle' })).toBeNull();
      expect(convertMark({ type: 'link', attrs: { href: 'https://a.b', title: 'T' } })).toEqual({
        type: 'link',
        href: 'https://a.b',
        title: 'T',
      });
      expect(convertMark({ type: 'unknown' })).toBeNull();
    });
  });

  describe('convertTiptapInlinesToAST', () => {
    it('converts text, math_inline, cross_reference, and footnote inlines', () => {
      const inlines = convertTiptapInlinesToAST([
        { type: 'text', text: 'Hi', marks: [{ type: 'bold' }, { type: 'unknown' }] },
        { type: 'text' },
        { type: 'math_inline', attrs: { latex: 'x+1' } },
        { type: 'cross_reference', attrs: { targetId: 't1', kind: 'table', displayMode: 'short' } },
        { type: 'footnote', attrs: { id: 'fn1' }, content: [{ type: 'text', text: 'Note' }] },
        { type: 'footnote_reference' },
      ]);

      expect(inlines[0]).toEqual({ type: 'text', text: 'Hi', marks: [{ type: 'bold' }] });
      expect(inlines[1]).toEqual({ type: 'text', text: '', marks: undefined });
      expect(inlines[2]).toEqual({ type: 'math_inline', latex: 'x+1' });
      expect(inlines[3]).toEqual({
        type: 'cross_reference',
        targetId: 't1',
        kind: 'table',
        displayMode: 'short',
      });
      expect(inlines[4]).toMatchObject({
        type: 'footnote_reference',
        id: 'fn1',
        content: [{ type: 'text', text: 'Note' }],
      });
      expect(inlines[5]).toMatchObject({ type: 'footnote_reference', content: [] });
    });
  });

  describe('convertTiptapBlockToAST', () => {
    it('converts heading, paragraph, figure/image, equation/math_display, blockquote, and lists', () => {
      expect(
        convertTiptapBlockToAST({
          type: 'heading',
          attrs: { id: 'h1', level: 9, numberingMode: 'none' },
          content: [{ type: 'text', text: 'Title' }],
        })
      ).toMatchObject({ type: 'heading', id: 'h1', level: 6, numberingMode: 'none' });

      expect(convertTiptapBlockToAST({ type: 'paragraph' })).toMatchObject({
        type: 'paragraph',
        content: [],
      });

      expect(
        convertTiptapBlockToAST({
          type: 'image',
          attrs: { src: '/img.png', alt: 'Alt', alignment: 'left', width: 200 },
        })
      ).toMatchObject({
        type: 'figure',
        mediaUrl: '/img.png',
        alignment: 'left',
        width: 200,
        captionContent: [{ type: 'text', text: 'Alt' }],
      });

      expect(
        convertTiptapBlockToAST({
          type: 'figure',
          attrs: { mediaUrl: '/fig.png' },
          content: [{ type: 'text', text: 'Rich' }],
        })
      ).toMatchObject({
        type: 'figure',
        mediaUrl: '/fig.png',
        captionContent: [{ type: 'text', text: 'Rich' }],
      });

      expect(
        convertTiptapBlockToAST({
          type: 'math_display',
          attrs: { content: 'a=b' },
        })
      ).toMatchObject({ type: 'equation', latex: 'a=b' });

      expect(
        convertTiptapBlockToAST({
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Q' }] }, { type: 'unknown' }],
        })
      ).toMatchObject({ type: 'quote', content: [{ type: 'paragraph' }] });

      expect(
        convertTiptapBlockToAST({
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph' }, { type: 'unknown' }],
            },
          ],
        })
      ).toMatchObject({ type: 'list', variant: 'ordered' });

      expect(convertTiptapBlockToAST({ type: 'bulletList' })).toMatchObject({
        type: 'list',
        variant: 'bullet',
        items: [],
      });

      expect(convertTiptapBlockToAST({ type: 'unknownNode' })).toBeNull();
    });

    it('converts table with header and body cells', () => {
      const table = convertTiptapBlockToAST({
        type: 'table',
        attrs: { caption: 'Cap', repeatHeaderOnPageBreak: false, keepWithCaption: false },
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                attrs: { colspan: 2, rowspan: 1 },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H' }] }, { type: 'unknown' }],
              },
            ],
          },
          { type: 'ignoredRow' },
        ],
      });

      expect(table).toMatchObject({
        type: 'table',
        repeatHeaderOnPageBreak: false,
        keepWithCaption: false,
      });
    });
  });

  describe('tiptapToSemanticAST', () => {
    it('wraps converted blocks into a normalized SemanticDocument', () => {
      const doc = tiptapToSemanticAST(
        {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
            { type: 'unknown' },
          ],
        },
        { id: 'doc-1' }
      );

      expect(doc.id).toBe('doc-1');
      expect(doc.blocks).toHaveLength(1);
      expect(doc.blocks[0].type).toBe('paragraph');
    });
  });
});

