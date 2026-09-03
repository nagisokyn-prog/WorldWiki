import { describe, it, expect } from 'vitest';
import { semanticASTToV2Doc } from '../src/converter/ASTToV2Converter';
import { v2DocToSemanticAST } from '../src/converter/V2ToASTConverter';
import type { WordDocumentDTO } from '../src/types/dto';

describe('Semantic AST ↔ Tiptap v2 Bidirectional Converters', () => {
  it('1. Конвертирует параграфы со стилями и текстовыми марками (bold, italic, color, link)', () => {
    const ast: WordDocumentDTO = {
      id: 'doc-1',
      metadata: { title: 'Тестовый документ' },
      profileId: 'gost',
      blocks: [
        {
          type: 'paragraph',
          id: 'p-1',
          styleOverride: {
            alignment: 'justify',
            firstLineIndentMm: 12.5,
            lineHeight: 1.5,
          },
          content: [
            { type: 'text', text: 'Обычный текст. ' },
            { type: 'text', text: 'Жирный и курсив. ', marks: [{ type: 'bold' }, { type: 'italic' }] },
            { type: 'text', text: 'Цветной текст. ', marks: [{ type: 'color', color: '#ff0000' }] },
            { type: 'text', text: 'Ссылка', marks: [{ type: 'link', href: 'https://example.com' }] },
          ],
        },
      ],
    };

    const v2Doc = semanticASTToV2Doc(ast);
    expect(v2Doc.type).toBe('doc');
    expect(v2Doc.content).toHaveLength(1);

    const pNode = v2Doc.content![0];
    expect(pNode.type).toBe('paragraph');
    expect(pNode.attrs?.textAlign).toBe('justify');
    expect(pNode.attrs?.firstLineIndent).toBe('1.250cm');
    expect(pNode.attrs?.lineHeight).toBe('1.5');
    expect(pNode.content).toHaveLength(4);

    // Обратная конвертация
    const restoredAST = v2DocToSemanticAST(v2Doc, ast.metadata, ast.profileId, ast.id);
    expect(restoredAST.blocks).toHaveLength(1);
    const restoredP = restoredAST.blocks[0] as any;
    expect(restoredP.styleOverride?.alignment).toBe('justify');
    expect(restoredP.styleOverride?.firstLineIndentMm).toBe(12.5);
    expect(restoredP.styleOverride?.lineHeight).toBe(1.5);
    expect(restoredP.content[1].marks).toEqual([{ type: 'bold' }, { type: 'italic' }]);
    expect(restoredP.content[2].marks).toEqual([{ type: 'color', color: '#ff0000' }]);
    expect(restoredP.content[3].marks).toEqual([{ type: 'link', href: 'https://example.com' }]);
  });

  it('2. Конвертирует заголовки, списки, цитаты, формулы и разрывы страниц', () => {
    const ast: WordDocumentDTO = {
      id: 'doc-2',
      metadata: { title: 'Сложные структуры' },
      profileId: 'default',
      blocks: [
        {
          type: 'heading',
          id: 'h-1',
          level: 2,
          content: [{ type: 'text', text: 'Раздел 2. Архитектура' }],
          numberingMode: 'auto',
        },
        {
          type: 'list',
          id: 'list-1',
          variant: 'bullet',
          items: [
            {
              id: 'li-1',
              content: [{ type: 'paragraph', id: 'p-li-1', content: [{ type: 'text', text: 'Пункт 1' }] }],
            },
          ],
        },
        {
          type: 'quote',
          id: 'q-1',
          citationAuthor: 'А.С. Пушкин',
          content: [{ type: 'paragraph', id: 'p-q-1', content: [{ type: 'text', text: 'Цитата' }] }],
        },
        {
          type: 'equation',
          id: 'eq-1',
          latex: 'E = mc^2',
        },
        {
          type: 'page_break',
          id: 'pb-1',
        },
      ],
    };

    const v2Doc = semanticASTToV2Doc(ast);
    expect(v2Doc.content).toHaveLength(5);
    expect(v2Doc.content![0].type).toBe('heading');
    expect(v2Doc.content![1].type).toBe('bulletList');
    expect(v2Doc.content![2].type).toBe('blockquote');
    expect(v2Doc.content![3].type).toBe('math_display');
    expect(v2Doc.content![4].type).toBe('pageBreak');

    const restored = v2DocToSemanticAST(v2Doc, ast.metadata, ast.profileId, ast.id);
    expect(restored.blocks).toHaveLength(5);
    expect(restored.blocks[0].type).toBe('heading');
    expect((restored.blocks[0] as any).level).toBe(2);
    expect(restored.blocks[1].type).toBe('list');
    expect(restored.blocks[2].type).toBe('quote');
    expect(restored.blocks[3].type).toBe('equation');
    expect((restored.blocks[3] as any).latex).toBe('E = mc^2');
    expect(restored.blocks[4].type).toBe('page_break');
  });

  it('3. Конвертирует разделители сцен (sceneBreak) и сущности (entityReference, crossReference)', () => {
    const ast: WordDocumentDTO = {
      id: 'doc-3',
      metadata: { title: 'Сущности и сцены' },
      blocks: [
        {
          type: 'scene_break',
          id: 'sb-1',
          variant: 'asterisms',
        },
        {
          type: 'paragraph',
          id: 'p-entities',
          content: [
            {
              type: 'entity_reference',
              id: 'char-42',
              entityType: 'character',
              name: 'Иван Грозный',
              url: 'character://42',
            },
            { type: 'text', text: ' упомянут в ' },
            {
              type: 'cross_reference',
              targetId: 'table-1',
              kind: 'table',
              displayMode: 'full',
            },
          ],
        },
      ],
    };

    const v2Doc = semanticASTToV2Doc(ast);
    expect(v2Doc.content![0].type).toBe('sceneBreak');
    expect(v2Doc.content![0].attrs?.variant).toBe('asterisms');

    const p = v2Doc.content![1];
    expect(p.content![0].type).toBe('entityReference');
    expect(p.content![0].attrs?.name).toBe('Иван Грозный');
    expect(p.content![2].type).toBe('crossReference');
    expect(p.content![2].attrs?.kind).toBe('table');

    const restored = v2DocToSemanticAST(v2Doc, ast.metadata, undefined, ast.id);
    expect(restored.blocks[0].type).toBe('scene_break');
    expect((restored.blocks[0] as any).variant).toBe('asterisms');

    const restoredP = restored.blocks[1] as any;
    expect(restoredP.content[0].type).toBe('entity_reference');
    expect(restoredP.content[0].name).toBe('Иван Грозный');
    expect(restoredP.content[2].type).toBe('cross_reference');
    expect(restoredP.content[2].kind).toBe('table');
  });

  it('4. Zero Data Loss Invariant: Неподдерживаемые узлы сохраняются и восстанавливаются 1-в-1', () => {
    const customAIBlock = {
      type: 'unsupported' as const,
      id: 'ai-prompt-block-99',
      originalType: 'ai_generation_block',
      originalAttrs: {
        model: 'gemini-pro',
        prompt: 'Сгенерируй описание замка',
        temperature: 0.7,
      },
      originalContent: [
        {
          type: 'paragraph' as const,
          id: 'p-in-ai',
          content: [{ type: 'text' as const, text: 'Черновик ответа нейросети' }],
        },
      ],
      reason: 'Специфичный блок интерактивной AI-генерации',
    };

    const ast: WordDocumentDTO = {
      id: 'doc-zero-loss',
      metadata: { title: 'Документ с AI блоком' },
      blocks: [
        {
          type: 'paragraph',
          id: 'p-1',
          content: [{ type: 'text', text: 'Текст перед блоком' }],
        },
        customAIBlock,
        {
          type: 'paragraph',
          id: 'p-2',
          content: [{ type: 'text', text: 'Текст после блока' }],
        },
      ],
    };

    // AST -> V2
    const v2Doc = semanticASTToV2Doc(ast);
    expect(v2Doc.content![1].type).toBe('unsupportedBlock');
    expect(v2Doc.content![1].attrs?.originalType).toBe('ai_generation_block');
    expect(v2Doc.content![1].attrs?.originalAttrs).toEqual(customAIBlock.originalAttrs);

    // V2 -> AST (Round-Trip Invariant)
    const restored = v2DocToSemanticAST(v2Doc, ast.metadata, undefined, ast.id);
    expect(restored.blocks).toHaveLength(3);
    expect(restored.blocks[1]).toEqual(customAIBlock);
  });
});
