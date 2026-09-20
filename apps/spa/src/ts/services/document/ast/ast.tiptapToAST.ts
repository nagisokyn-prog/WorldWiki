import { generateNodeId, normalizeSemanticDocument } from './ASTNormalizer';
import type {
  BlockNode,
  CrossReferenceNode,
  EquationNode,
  FigureNode,
  FootnoteReferenceNode,
  HeadingNode,
  InlineNode,
  ListItemNode,
  ListNode,
  MathInlineNode,
  ParagraphNode,
  QuoteNode,
  SemanticDocument,
  TableCellNode,
  TableNode,
  TableRowNode,
  TextMark,
  TextNode
} from './types';

export interface TiptapNodeJson {
  type: string;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  content?: TiptapNodeJson[];
  marks?: TiptapMarkJson[];
  text?: string;
}

export interface TiptapMarkJson {
  type: string;
  attrs?: Record<string, string | number | boolean | null | undefined>;
}

export interface TiptapDocJson {
  type: 'doc';
  content: TiptapNodeJson[];
}

export function convertMark(raw: TiptapMarkJson): TextMark | null {
  switch (raw.type) {
    case 'bold':
      return { type: 'bold' };
    case 'italic':
      return { type: 'italic' };
    case 'underline':
      return { type: 'underline' };
    case 'strike':
      return { type: 'strike' };
    case 'code':
      return { type: 'code' };
    case 'textStyle': {
      const color = raw.attrs?.color as string | undefined;
      const fontSize = raw.attrs?.fontSize as string | undefined;
      if (color) {
        return { type: 'color', color };
      }
      if (fontSize) {
        return { type: 'fontSize', sizePt: parseFloat(fontSize) || 12 };
      }
      return null;
    }
    case 'link':
      return {
        type: 'link',
        href: (raw.attrs?.href as string) || '',
        title: raw.attrs?.title as string | undefined
      };
    default:
      return null;
  }
}

export function convertTiptapInlinesToAST(inlines: TiptapNodeJson[]): InlineNode[] {
  const result: InlineNode[] = [];

  for (const raw of inlines) {
    if (raw.type === 'text') {
      const marks: TextMark[] = [];
      for (const m of raw.marks || []) {
        const mark = convertMark(m);
        if (mark) {
          marks.push(mark);
        }
      }
      result.push({
        type: 'text',
        text: raw.text || '',
        marks: marks.length > 0 ? marks : undefined
      } as TextNode);
    } else if (raw.type === 'math_inline') {
      result.push({
        type: 'math_inline',
        latex: (raw.attrs?.latex as string) || raw.text || ''
      } as MathInlineNode);
    } else if (raw.type === 'cross_reference') {
      result.push({
        type: 'cross_reference',
        targetId: (raw.attrs?.targetId as string) || '',
        kind: (raw.attrs?.kind as CrossReferenceNode['kind']) || 'figure',
        displayMode: (raw.attrs?.displayMode as CrossReferenceNode['displayMode']) || 'full'
      } as CrossReferenceNode);
    } else if (raw.type === 'footnote' || raw.type === 'footnote_reference') {
      result.push({
        type: 'footnote_reference',
        id: (raw.attrs?.id as string) || generateNodeId(),
        content: convertTiptapInlinesToAST(raw.content || [])
      } as FootnoteReferenceNode);
    }
  }

  return result;
}

export function convertTiptapBlockToAST(raw: TiptapNodeJson): BlockNode | null {
  const id = (raw.attrs?.id as string) || generateNodeId();

  switch (raw.type) {
    case 'heading': {
      const levelNum = Number(raw.attrs?.level) || 1;
      const level = Math.max(1, Math.min(6, levelNum)) as 1 | 2 | 3 | 4 | 5 | 6;
      const numberingMode = (raw.attrs?.numberingMode as 'auto' | 'none') || 'auto';
      return {
        type: 'heading',
        id,
        level,
        numberingMode,
        content: convertTiptapInlinesToAST(raw.content || [])
      } as HeadingNode;
    }

    case 'paragraph': {
      return {
        type: 'paragraph',
        id,
        content: convertTiptapInlinesToAST(raw.content || [])
      } as ParagraphNode;
    }

    case 'figure':
    case 'image': {
      const mediaUrl = (raw.attrs?.src as string) || (raw.attrs?.mediaUrl as string) || '';
      const captionText = (raw.attrs?.caption as string) || (raw.attrs?.alt as string) || '';
      const alignment = (raw.attrs?.alignment as 'center' | 'left' | 'right') || 'center';
      const numberingMode = (raw.attrs?.numberingMode as 'global' | 'by_chapter' | 'none') || 'global';

      let captionContent: InlineNode[] = [];
      if (raw.content && raw.content.length > 0) {
        captionContent = convertTiptapInlinesToAST(raw.content);
      } else if (captionText) {
        captionContent = [{ type: 'text', text: captionText }];
      }

      return {
        type: 'figure',
        id,
        mediaUrl,
        captionContent,
        numberingMode,
        alignment,
        width: raw.attrs?.width as string | number | undefined
      } as FigureNode;
    }

    case 'table': {
      const rows: TableRowNode[] = [];
      const tableChildren = raw.content || [];

      for (const r of tableChildren) {
        if (r.type === 'tableRow') {
          const cells: TableCellNode[] = [];
          const rowCells = r.content || [];

          for (const c of rowCells) {
            const cellBlocks: BlockNode[] = [];
            for (const inner of c.content || []) {
              const b = convertTiptapBlockToAST(inner);
              if (b) {
                cellBlocks.push(b);
              }
            }

            cells.push({
              id: (c.attrs?.id as string) || generateNodeId(),
              content: cellBlocks,
              colSpan: Number(c.attrs?.colspan) || 1,
              rowSpan: Number(c.attrs?.rowspan) || 1
            });
          }

          rows.push({
            id: (r.attrs?.id as string) || generateNodeId(),
            isHeader: r.content?.[0]?.type === 'tableHeader',
            cells
          });
        }
      }

      return {
        type: 'table',
        id,
        captionContent: [{ type: 'text', text: (raw.attrs?.caption as string) || '' }],
        numberingMode: (raw.attrs?.numberingMode as 'global' | 'by_chapter' | 'none') || 'global',
        repeatHeaderOnPageBreak: Boolean(raw.attrs?.repeatHeaderOnPageBreak ?? true),
        keepWithCaption: Boolean(raw.attrs?.keepWithCaption ?? true),
        rows
      } as TableNode;
    }

    case 'equation':
    case 'math_display': {
      return {
        type: 'equation',
        id,
        latex: (raw.attrs?.latex as string) || (raw.attrs?.content as string) || raw.text || '',
        numberingMode: (raw.attrs?.numberingMode as 'auto' | 'none') || 'auto'
      } as EquationNode;
    }

    case 'blockquote': {
      const quoteBlocks: BlockNode[] = [];
      for (const inner of raw.content || []) {
        const b = convertTiptapBlockToAST(inner);
        if (b) {
          quoteBlocks.push(b);
        }
      }
      return {
        type: 'quote',
        id,
        content: quoteBlocks
      } as QuoteNode;
    }

    case 'bulletList':
    case 'orderedList': {
      const items: ListItemNode[] = [];
      for (const li of raw.content || []) {
        const itemBlocks: BlockNode[] = [];
        for (const inner of li.content || []) {
          const b = convertTiptapBlockToAST(inner);
          if (b) {
            itemBlocks.push(b);
          }
        }
        items.push({
          id: (li.attrs?.id as string) || generateNodeId(),
          content: itemBlocks
        });
      }
      return {
        type: 'list',
        id,
        variant: raw.type === 'orderedList' ? 'ordered' : 'bullet',
        items
      } as ListNode;
    }

    default:
      return null;
  }
}

export function tiptapToSemanticAST(
  tiptapDoc: TiptapDocJson | TiptapNodeJson,
  existingDoc?: Partial<SemanticDocument>
): SemanticDocument {
  const rawBlocks = tiptapDoc.content || [];
  const blocks: BlockNode[] = [];

  for (const raw of rawBlocks) {
    const block = convertTiptapBlockToAST(raw);
    if (block) {
      blocks.push(block);
    }
  }

  return normalizeSemanticDocument({
    ...existingDoc,
    blocks
  });
}
