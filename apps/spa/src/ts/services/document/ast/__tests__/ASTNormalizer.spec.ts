import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_SCHEMA_VERSION,
  generateNodeId,
  normalizeBlockNode,
  normalizeInlineNode,
  normalizeSemanticDocument,
  normalizeVersionedDocument
} from '../ASTNormalizer';
import type { FigureNode, FootnoteReferenceNode, HeadingNode, TableNode } from '../types';

describe('ASTNormalizer', () => {
  it('generates valid UUID strings', () => {
    const id1 = generateNodeId();
    const id2 = generateNodeId();
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(10);
  });

  it('assigns IDs to nodes lacking an ID', () => {
    const rawHeading = {
      type: 'heading',
      level: 2,
      content: [{ type: 'text', text: 'Глава 1' }]
    } as unknown as HeadingNode;

    const normalized = normalizeBlockNode(rawHeading) as HeadingNode;
    expect(normalized.id).toBeDefined();
    expect(normalized.id.trim()).not.toBe('');
    expect(normalized.numberingMode).toBe('auto');
  });

  it('preserves existing stable IDs', () => {
    const existingId = 'stable-custom-uuid-123';
    const figure: FigureNode = {
      type: 'figure',
      id: existingId,
      mediaUrl: 'https://example.com/img.png',
      captionContent: [{ type: 'text', text: 'Схема' }],
      numberingMode: 'global',
      alignment: 'center'
    };

    const normalized = normalizeBlockNode(figure) as FigureNode;
    expect(normalized.id).toBe(existingId);
  });

  it('recursively normalizes nested tables and cells', () => {
    const tableWithoutIds = {
      type: 'table',
      rows: [
        {
          cells: [
            {
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Cell' }]
                }
              ]
            }
          ]
        }
      ]
    } as unknown as TableNode;

    const normalized = normalizeBlockNode(tableWithoutIds) as TableNode;
    expect(normalized.id).toBeDefined();
    expect(normalized.rows[0].id).toBeDefined();
    expect(normalized.rows[0].cells[0].id).toBeDefined();
    expect(normalized.rows[0].cells[0].content[0].id).toBeDefined();
  });

  it('normalizes footnotes with unique IDs inside inline content', () => {
    const inlineFootnote: FootnoteReferenceNode = {
      type: 'footnote_reference',
      id: '',
      content: [{ type: 'text', text: 'Сноска' }]
    };

    const normalized = normalizeInlineNode(inlineFootnote) as FootnoteReferenceNode;
    expect(normalized.id).toBeDefined();
    expect(normalized.id.trim()).not.toBe('');
  });

  it('normalizes versioned document container', () => {
    const doc = normalizeVersionedDocument({
      document: {
        id: 'doc-1',
        profileId: 'gost_academic',
        metadata: {
          title: 'Курсовая работа',
          authors: ['Иванов И.И.'],
          createdAt: 1000,
          updatedAt: 1000
        },
        blocks: []
      }
    });

    expect(doc.schemaVersion).toBe(CURRENT_DOCUMENT_SCHEMA_VERSION);
    expect(doc.document.id).toBe('doc-1');
    expect(doc.document.metadata.title).toBe('Курсовая работа');
    expect(doc.document.profileId).toBe('gost_academic');
  });

  it('normalizes standalone semantic document with defaults', () => {
    const doc = normalizeSemanticDocument({});
    expect(doc.id).toBeDefined();
    expect(doc.metadata.title).toBe('Без названия');
    expect(doc.profileId).toBe('gost_academic');
    expect(doc.blocks).toEqual([]);
  });
});
