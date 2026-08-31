import { describe, expect, it } from 'vitest';
import { NumberingEngine } from '../../numbering/NumberingEngine';
import { AcademicGOSTProfile } from '../../profiles/defaults';
import { ASTAdapter, type TiptapDocJson } from '../ASTAdapter';
import type { FigureNode, HeadingNode, SemanticDocument } from '../types';

describe('ASTAdapter', () => {
  it('converts Tiptap JSON with headings, figures and marks to Semantic AST', () => {
    const tiptapJson: TiptapDocJson = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { id: 'h-1', level: 1 },
          content: [{ type: 'text', text: 'Глава 1' }]
        },
        {
          type: 'paragraph',
          attrs: { id: 'p-1' },
          content: [
            {
              type: 'text',
              text: 'Жирный текст',
              marks: [{ type: 'bold' }]
            },
            {
              type: 'cross_reference',
              attrs: { targetId: 'fig-1', kind: 'figure', displayMode: 'full' }
            }
          ]
        },
        {
          type: 'figure',
          attrs: { id: 'fig-1', src: 'https://example.com/img.png', caption: 'Схема системы' }
        }
      ]
    };

    const doc = ASTAdapter.tiptapToSemanticAST(tiptapJson);
    expect(doc.blocks.length).toBe(3);

    const h1 = doc.blocks[0] as HeadingNode;
    expect(h1.type).toBe('heading');
    expect(h1.id).toBe('h-1');
    expect(h1.level).toBe(1);

    const fig = doc.blocks[2] as FigureNode;
    expect(fig.type).toBe('figure');
    expect(fig.id).toBe('fig-1');
    expect(fig.mediaUrl).toBe('https://example.com/img.png');
    expect(fig.captionContent[0].type).toBe('text');
  });

  it('converts Semantic AST to Tiptap JSON with computed numbers and resolved labels', () => {
    const rawDoc: Partial<SemanticDocument> = {
      id: 'doc-test-1',
      profileId: 'gost_academic',
      metadata: { title: 'Курсовая', authors: ['Студент'], createdAt: 1000, updatedAt: 1000 },
      blocks: [
        {
          type: 'heading',
          id: 'h-chap-1',
          level: 1,
          content: [{ type: 'text', text: 'Введение' }],
          numberingMode: 'auto'
        } as HeadingNode,
        {
          type: 'figure',
          id: 'fig-arch',
          mediaUrl: 'https://example.com/arch.png',
          captionContent: [{ type: 'text', text: 'Архитектура сервиса' }],
          numberingMode: 'global',
          alignment: 'center'
        } as FigureNode,
        {
          type: 'paragraph',
          id: 'p-ref',
          content: [
            { type: 'text', text: 'Как показано на ' },
            {
              type: 'cross_reference',
              targetId: 'fig-arch',
              kind: 'figure',
              displayMode: 'full'
            }
          ]
        }
      ]
    };

    const doc = ASTAdapter.tiptapToSemanticAST({ type: 'doc', content: [] }, rawDoc);
    const ctx = NumberingEngine.compute(doc, AcademicGOSTProfile.numbering);
    const tiptapJson = ASTAdapter.semanticASTToTiptap(doc, ctx, AcademicGOSTProfile.numbering);

    expect(tiptapJson.type).toBe('doc');
    expect(tiptapJson.content.length).toBe(3);

    // Heading has computed number '1'
    expect(tiptapJson.content[0].attrs?.computedNumber).toBe('1');

    // Figure has computed number '1'
    expect(tiptapJson.content[1].attrs?.computedNumber).toBe('1');

    // Cross-reference has resolved label 'Рисунок 1'
    const refNode = tiptapJson.content[2].content?.[1];
    expect(refNode?.attrs?.resolvedLabel).toBe('Рисунок 1');
    expect(refNode?.attrs?.isBroken).toBe(false);
  });
});
