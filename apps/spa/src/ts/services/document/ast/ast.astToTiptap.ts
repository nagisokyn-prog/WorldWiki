import { CrossReferenceResolver } from '../crossref/CrossReferenceResolver';
import type { NumberingContext, NumberingProfile } from '../numbering/types';
import type { TiptapDocJson, TiptapMarkJson, TiptapNodeJson } from './ast.tiptapToAST';
import type { BlockNode, InlineNode, SemanticDocument } from './types';

export function convertASTInlinesToTiptap(
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
        content: convertASTInlinesToTiptap(inline.content, doc, ctx, profile)
      });
    }
  }

  return result;
}

export function convertASTBlockToTiptap(
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
        content: convertASTInlinesToTiptap(block.content, doc, ctx, profile)
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
        content: convertASTInlinesToTiptap(block.content, doc, ctx, profile)
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
        content: convertASTInlinesToTiptap(block.captionContent, doc, ctx, profile)
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
            const res = convertASTBlockToTiptap(b, doc, ctx, profile);
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
        const res = convertASTBlockToTiptap(b, doc, ctx, profile);
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
          const res = convertASTBlockToTiptap(b, doc, ctx, profile);
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

export function semanticASTToTiptap(
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
    const node = convertASTBlockToTiptap(block, doc, effectiveCtx, effectiveProfile);
    if (node) {
      content.push(node);
    }
  }

  return {
    type: 'doc',
    content
  };
}
