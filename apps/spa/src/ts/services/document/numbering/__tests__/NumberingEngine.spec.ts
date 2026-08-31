import { describe, expect, it } from 'vitest';
import { normalizeSemanticDocument } from '../../ast/ASTNormalizer';
import type { FigureNode, HeadingNode } from '../../ast/types';
import { NumberingEngine } from '../NumberingEngine';
import type { NumberingProfile } from '../types';

const defaultProfile: NumberingProfile = {
  figureMode: 'global',
  tableMode: 'global',
  equationMode: 'global',
  footnoteRestartPerPage: false,
  headingNumberingEnabled: true,
  figurePrefix: 'Рисунок',
  tablePrefix: 'Таблица',
  equationFormat: 'parens'
};

describe('NumberingEngine', () => {
  it('computes hierarchical heading numbers correctly', () => {
    const doc = normalizeSemanticDocument({
      blocks: [
        { type: 'heading', id: 'h1', level: 1, content: [], numberingMode: 'auto' } as HeadingNode,
        { type: 'heading', id: 'h1_1', level: 2, content: [], numberingMode: 'auto' } as HeadingNode,
        { type: 'heading', id: 'h1_2', level: 2, content: [], numberingMode: 'auto' } as HeadingNode,
        { type: 'heading', id: 'h1_2_1', level: 3, content: [], numberingMode: 'auto' } as HeadingNode,
        { type: 'heading', id: 'h2', level: 1, content: [], numberingMode: 'auto' } as HeadingNode,
        { type: 'heading', id: 'h2_1', level: 2, content: [], numberingMode: 'auto' } as HeadingNode
      ]
    });

    const context = NumberingEngine.compute(doc, defaultProfile);

    expect(context.headings.get('h1')).toBe('1');
    expect(context.headings.get('h1_1')).toBe('1.1');
    expect(context.headings.get('h1_2')).toBe('1.2');
    expect(context.headings.get('h1_2_1')).toBe('1.2.1');
    expect(context.headings.get('h2')).toBe('2');
    expect(context.headings.get('h2_1')).toBe('2.1');
  });

  it('skips numbering for headings with numberingMode: none', () => {
    const doc = normalizeSemanticDocument({
      blocks: [
        { type: 'heading', id: 'intro', level: 1, content: [], numberingMode: 'none' } as HeadingNode,
        { type: 'heading', id: 'chap1', level: 1, content: [], numberingMode: 'auto' } as HeadingNode
      ]
    });

    const context = NumberingEngine.compute(doc, defaultProfile);

    expect(context.headings.has('intro')).toBe(false);
    expect(context.headings.get('chap1')).toBe('1');
  });

  it('computes global numbering for figures and tables', () => {
    const doc = normalizeSemanticDocument({
      blocks: [
        { type: 'figure', id: 'fig-1', mediaUrl: '', captionContent: [], numberingMode: 'global', alignment: 'center' } as FigureNode,
        { type: 'figure', id: 'fig-2', mediaUrl: '', captionContent: [], numberingMode: 'global', alignment: 'center' } as FigureNode
      ]
    });

    const context = NumberingEngine.compute(doc, defaultProfile);

    expect(context.figures.get('fig-1')).toBe('1');
    expect(context.figures.get('fig-2')).toBe('2');
  });

  it('computes by-chapter numbering when configured', () => {
    const byChapterProfile: NumberingProfile = {
      ...defaultProfile,
      figureMode: 'by_chapter',
      tableMode: 'by_chapter'
    };

    const doc = normalizeSemanticDocument({
      blocks: [
        { type: 'heading', id: 'h1', level: 1, content: [], numberingMode: 'auto' } as HeadingNode,
        { type: 'figure', id: 'fig-1', mediaUrl: '', captionContent: [], numberingMode: 'global', alignment: 'center' } as FigureNode,
        { type: 'figure', id: 'fig-2', mediaUrl: '', captionContent: [], numberingMode: 'global', alignment: 'center' } as FigureNode,
        { type: 'heading', id: 'h2', level: 1, content: [], numberingMode: 'auto' } as HeadingNode,
        { type: 'figure', id: 'fig-3', mediaUrl: '', captionContent: [], numberingMode: 'global', alignment: 'center' } as FigureNode
      ]
    });

    const context = NumberingEngine.compute(doc, byChapterProfile);

    expect(context.figures.get('fig-1')).toBe('1.1');
    expect(context.figures.get('fig-2')).toBe('1.2');
    expect(context.figures.get('fig-3')).toBe('2.1');
  });

  it('demonstrates dynamic shifting when a new figure is inserted', () => {
    const initialDoc = normalizeSemanticDocument({
      blocks: [
        { type: 'figure', id: 'fig-a', mediaUrl: '', captionContent: [], numberingMode: 'global', alignment: 'center' } as FigureNode,
        { type: 'figure', id: 'fig-c', mediaUrl: '', captionContent: [], numberingMode: 'global', alignment: 'center' } as FigureNode
      ]
    });

    const initialCtx = NumberingEngine.compute(initialDoc, defaultProfile);
    expect(initialCtx.figures.get('fig-a')).toBe('1');
    expect(initialCtx.figures.get('fig-c')).toBe('2');

    // Insert fig-b between fig-a and fig-c
    const updatedDoc = normalizeSemanticDocument({
      blocks: [
        initialDoc.blocks[0],
        { type: 'figure', id: 'fig-b', mediaUrl: '', captionContent: [], numberingMode: 'global', alignment: 'center' } as FigureNode,
        initialDoc.blocks[1]
      ]
    });

    const updatedCtx = NumberingEngine.compute(updatedDoc, defaultProfile);
    expect(updatedCtx.figures.get('fig-a')).toBe('1');
    expect(updatedCtx.figures.get('fig-b')).toBe('2');
    expect(updatedCtx.figures.get('fig-c')).toBe('3'); // Dynamically shifted to 3 without mutating fig-c node!
  });

  it('numbers footnotes recursively across blocks', () => {
    const doc = normalizeSemanticDocument({
      blocks: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Текст с сноской' },
            { type: 'footnote_reference', id: 'fn-1', content: [] }
          ]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Вторая сноска' },
            { type: 'footnote_reference', id: 'fn-2', content: [] }
          ]
        }
      ]
    });

    const context = NumberingEngine.compute(doc, defaultProfile);
    expect(context.footnotes.get('fn-1')).toBe(1);
    expect(context.footnotes.get('fn-2')).toBe(2);
  });
});
