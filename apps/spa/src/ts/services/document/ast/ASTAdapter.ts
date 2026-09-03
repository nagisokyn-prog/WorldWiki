import { CrossReferenceResolver } from '../crossref/CrossReferenceResolver';
import type { NumberingContext, NumberingProfile } from '../numbering/types';
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

/**
 * Raw ProseMirror / Tiptap JSON contract (strictly typed without any).
 */
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

/**
 * Bidirectional bridge between Tiptap JSON and WorldWiki Semantic AST.
 * Preserves node IDs, resolves computed labels, and handles marks.
 */
export class ASTAdapter {
  /* =========================================================================
     TIPTAP JSON ➔ SEMANTIC AST
     ========================================================================= */

  public static tiptapToSemanticAST(
    tiptapDoc: TiptapDocJson | TiptapNodeJson,
    existingDoc?: Partial<SemanticDocument>
  ): SemanticDocument {
    const rawBlocks = tiptapDoc.content || [];
    const blocks: BlockNode[] = [];

    for (const raw of rawBlocks) {
      const block = this.convertTiptapBlockToAST(raw);
      if (block) {
        blocks.push(block);
      }
    }

    return normalizeSemanticDocument({
      ...existingDoc,
      blocks
    });
  }

  private static convertTiptapBlockToAST(raw: TiptapNodeJson): BlockNode | null {
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
          content: this.convertTiptapInlinesToAST(raw.content || [])
        } as HeadingNode;
      }

      case 'paragraph': {
        return {
          type: 'paragraph',
          id,
          content: this.convertTiptapInlinesToAST(raw.content || [])
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
          captionContent = this.convertTiptapInlinesToAST(raw.content);
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
                const b = this.convertTiptapBlockToAST(inner);
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
          const b = this.convertTiptapBlockToAST(inner);
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
            const b = this.convertTiptapBlockToAST(inner);
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

  private static convertTiptapInlinesToAST(inlines: TiptapNodeJson[]): InlineNode[] {
    const result: InlineNode[] = [];

    for (const raw of inlines) {
      if (raw.type === 'text') {
        const marks: TextMark[] = [];
        for (const m of raw.marks || []) {
          const mark = this.convertMark(m);
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
          content: this.convertTiptapInlinesToAST(raw.content || [])
        } as FootnoteReferenceNode);
      }
    }

    return result;
  }

  private static convertMark(raw: TiptapMarkJson): TextMark | null {
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

  /* =========================================================================
     SEMANTIC AST ➔ TIPTAP JSON
     ========================================================================= */

  public static semanticASTToTiptap(
    doc: SemanticDocument,
    ctx?: NumberingContext,
    profile?: NumberingProfile
  ): TiptapDocJson {
    const effectiveCtx: NumberingContext = ctx || {
      headings: new Map<string, string>(),
      figures: new Map<string, string>(),
      tables: new Map<string, string>(),
      equations: new Map<string, string>(),
      footnotes: new Map<string, number>()
    };
    const effectiveProfile: NumberingProfile = profile || {
      figureMode: 'by_chapter',
      tableMode: 'by_chapter',
      equationMode: 'by_chapter',
      footnoteRestartPerPage: false,
      headingNumberingEnabled: true,
      figurePrefix: 'Рисунок',
      tablePrefix: 'Таблица',
      equationFormat: 'parens'
    };

    const content: TiptapNodeJson[] = [];

    for (const block of doc.blocks) {
      const node = this.convertASTBlockToTiptap(block, doc, effectiveCtx, effectiveProfile);
      if (node) {
        content.push(node);
      }
    }

    return {
      type: 'doc',
      content
    };
  }

  private static convertASTBlockToTiptap(
    block: BlockNode,
    doc: SemanticDocument,
    ctx: NumberingContext,
    profile: NumberingProfile
  ): TiptapNodeJson | null {
    switch (block.type) {
      case 'heading': {
        const headingNum = ctx.headings.get(block.id);
        return {
          type: 'heading',
          attrs: {
            id: block.id,
            level: block.level,
            numberingMode: block.numberingMode,
            computedNumber: headingNum || null
          },
          content: this.convertASTInlinesToTiptap(block.content, doc, ctx, profile)
        };
      }

      case 'paragraph': {
        return {
          type: 'paragraph',
          attrs: {
            id: block.id,
            alignment: block.styleOverride?.alignment,
            lineHeight: block.styleOverride?.lineHeight
          },
          content: this.convertASTInlinesToTiptap(block.content, doc, ctx, profile)
        };
      }

      case 'figure': {
        const figNum = ctx.figures.get(block.id) || '';
        return {
          type: 'figure',
          attrs: {
            id: block.id,
            src: block.mediaUrl,
            caption: block.captionContent.map((c) => (c.type === 'text' ? c.text : '')).join(''),
            computedNumber: figNum,
            numberingMode: block.numberingMode,
            alignment: block.alignment,
            width: block.width
          },
          content: this.convertASTInlinesToTiptap(block.captionContent, doc, ctx, profile)
        };
      }

      case 'table': {
        const tableNum = ctx.tables.get(block.id) || '';
        const rowNodes: TiptapNodeJson[] = [];

        for (const row of block.rows) {
          const cellNodes: TiptapNodeJson[] = [];
          for (const cell of row.cells) {
            const cellBlockNodes: TiptapNodeJson[] = [];
            for (const b of cell.content) {
              const res = this.convertASTBlockToTiptap(b, doc, ctx, profile);
              if (res) {
                cellBlockNodes.push(res);
              }
            }

            cellNodes.push({
              type: row.isHeader ? 'tableHeader' : 'tableCell',
              attrs: {
                id: cell.id,
                colspan: cell.colSpan || 1,
                rowspan: cell.rowSpan || 1
              },
              content: cellBlockNodes.length > 0 ? cellBlockNodes : [{ type: 'paragraph', content: [] }]
            });
          }

          rowNodes.push({
            type: 'tableRow',
            attrs: { id: row.id },
            content: cellNodes
          });
        }

        return {
          type: 'table',
          attrs: {
            id: block.id,
            computedNumber: tableNum,
            repeatHeaderOnPageBreak: block.repeatHeaderOnPageBreak,
            keepWithCaption: block.keepWithCaption
          },
          content: rowNodes
        };
      }

      case 'equation': {
        const eqNum = ctx.equations.get(block.id) || '';
        return {
          type: 'equation',
          attrs: {
            id: block.id,
            latex: block.latex,
            computedNumber: eqNum,
            numberingMode: block.numberingMode
          }
        };
      }

      case 'quote': {
        const quoteContent: TiptapNodeJson[] = [];
        for (const b of block.content) {
          const res = this.convertASTBlockToTiptap(b, doc, ctx, profile);
          if (res) {
            quoteContent.push(res);
          }
        }
        return {
          type: 'blockquote',
          attrs: { id: block.id },
          content: quoteContent
        };
      }

      case 'list': {
        const listItems: TiptapNodeJson[] = [];
        for (const item of block.items) {
          const itemContent: TiptapNodeJson[] = [];
          for (const b of item.content) {
            const res = this.convertASTBlockToTiptap(b, doc, ctx, profile);
            if (res) {
              itemContent.push(res);
            }
          }
          listItems.push({
            type: 'listItem',
            attrs: { id: item.id },
            content: itemContent.length > 0 ? itemContent : [{ type: 'paragraph', content: [] }]
          });
        }
        return {
          type: block.variant === 'ordered' ? 'orderedList' : 'bulletList',
          attrs: { id: block.id },
          content: listItems
        };
      }

      default:
        return null;
    }
  }

  private static convertASTInlinesToTiptap(
    inlines: InlineNode[],
    doc: SemanticDocument,
    ctx: NumberingContext,
    profile: NumberingProfile
  ): TiptapNodeJson[] {
    const result: TiptapNodeJson[] = [];

    for (const inline of inlines) {
      if (inline.type === 'text') {
        const marks: TiptapMarkJson[] = [];
        for (const m of inline.marks || []) {
          switch (m.type) {
            case 'bold':
            case 'italic':
            case 'underline':
            case 'strike':
            case 'code':
            case 'subscript':
            case 'superscript':
              marks.push({ type: m.type });
              break;
            case 'fontFamily':
              marks.push({ type: 'fontFamily', attrs: { fontFamily: m.font } });
              break;
            case 'fontSize':
              marks.push({ type: 'fontSize', attrs: { fontSize: typeof m.sizePt === 'number' ? `${m.sizePt}pt` : m.sizePt } });
              break;
            case 'color':
              marks.push({ type: 'highlight', attrs: { color: m.color } });
              break;
            case 'link':
              marks.push({ type: 'link', attrs: { href: m.href, title: m.title } });
              break;
          }
        }
        result.push({
          type: 'text',
          text: inline.text,
          marks: marks.length > 0 ? marks : undefined
        });
      } else if (inline.type === 'math_inline') {
        result.push({
          type: 'math_inline',
          attrs: { latex: inline.latex }
        });
      } else if (inline.type === 'cross_reference') {
        const resolved = CrossReferenceResolver.resolve(inline, doc, ctx, profile);
        result.push({
          type: 'cross_reference',
          attrs: {
            targetId: inline.targetId,
            kind: inline.kind,
            displayMode: inline.displayMode,
            resolvedLabel: resolved.label,
            isBroken: resolved.isBroken
          }
        });
      } else if (inline.type === 'footnote_reference') {
        const fnNum = ctx.footnotes.get(inline.id) || 1;
        result.push({
          type: 'footnote_reference',
          attrs: {
            id: inline.id,
            computedNumber: fnNum
          },
          content: this.convertASTInlinesToTiptap(inline.content, doc, ctx, profile)
        });
      }
    }

    return result;
  }
}
