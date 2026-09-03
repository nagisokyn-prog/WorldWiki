import type {
  WordDocumentDTO,
  WordBlockDTO,
  WordInlineDTO,
  WordTextMarkDTO,
} from '../types/dto';

export interface V2NodeJson {
  type: string;
  attrs?: Record<string, unknown>;
  content?: V2NodeJson[];
  marks?: V2MarkJson[];
  text?: string;
  [key: string]: unknown;
}

export interface V2MarkJson {
  type: string;
  attrs?: Record<string, unknown>;
}

export function convertMarksToV2(marks?: WordTextMarkDTO[]): V2MarkJson[] | undefined {
  if (!marks || marks.length === 0) return undefined;

  const result: V2MarkJson[] = [];
  for (const m of marks) {
    switch (m.type) {
      case 'bold':
        result.push({ type: 'bold' });
        break;
      case 'italic':
        result.push({ type: 'italic' });
        break;
      case 'underline':
        result.push({ type: 'underline' });
        break;
      case 'strike':
        result.push({ type: 'strike' });
        break;
      case 'code':
        result.push({ type: 'code' });
        break;
      case 'subscript':
        result.push({ type: 'subscript' });
        break;
      case 'superscript':
        result.push({ type: 'superscript' });
        break;
      case 'color':
        result.push({ type: 'textStyle', attrs: { color: m.color } });
        break;
      case 'highlight':
        result.push({ type: 'highlight', attrs: { color: m.color } });
        break;
      case 'fontFamily':
        result.push({ type: 'textStyle', attrs: { fontFamily: m.font } });
        break;
      case 'fontSize':
        result.push({ type: 'textStyle', attrs: { fontSize: `${m.sizePt}pt` } });
        break;
      case 'link':
        result.push({ type: 'link', attrs: { href: m.href, title: m.title } });
        break;
    }
  }
  return result.length ? result : undefined;
}

export function convertInlineToV2(inline: WordInlineDTO): V2NodeJson {
  switch (inline.type) {
    case 'text':
      return {
        type: 'text',
        text: inline.text,
        marks: convertMarksToV2(inline.marks),
      };

    case 'math_inline':
      return {
        type: 'math_inline',
        attrs: { latex: inline.latex },
      };

    case 'footnote_reference':
      return {
        type: 'footnote',
        attrs: { id: inline.id },
        content: inline.content?.map(convertInlineToV2),
      };

    case 'cross_reference':
      return {
        type: 'crossReference',
        attrs: {
          targetId: inline.targetId,
          kind: inline.kind,
          displayMode: inline.displayMode,
        },
      };

    case 'entity_reference':
      return {
        type: 'entityReference',
        attrs: {
          id: inline.id,
          entityType: inline.entityType,
          name: inline.name,
          url: inline.url,
        },
      };

    default:
      return {
        type: 'text',
        text: '',
      };
  }
}

export function convertBlockToV2(block: WordBlockDTO): V2NodeJson {
  switch (block.type) {
    case 'paragraph': {
      const attrs: Record<string, unknown> = {};
      if (block.styleOverride?.alignment) {
        attrs.textAlign = block.styleOverride.alignment;
      }
      if (block.styleOverride?.firstLineIndentMm !== undefined) {
        attrs.firstLineIndent = `${(block.styleOverride.firstLineIndentMm / 10).toFixed(3)}cm`;
      }
      if (block.styleOverride?.lineHeight !== undefined) {
        attrs.lineHeight = String(block.styleOverride.lineHeight);
      }

      return {
        type: 'paragraph',
        attrs: Object.keys(attrs).length ? attrs : undefined,
        content: block.content?.length ? block.content.map(convertInlineToV2) : undefined,
      };
    }

    case 'heading':
      return {
        type: 'heading',
        attrs: {
          level: block.level,
          id: block.id,
          numberingMode: block.numberingMode,
        },
        content: block.content?.length ? block.content.map(convertInlineToV2) : undefined,
      };

    case 'figure': {
      const nodes: V2NodeJson[] = [
        {
          type: 'image',
          attrs: {
            src: block.mediaUrl,
            alignment: block.alignment || 'center',
            width: block.width,
          },
        },
      ];
      if (block.captionContent?.length) {
        nodes.push({
          type: 'paragraph',
          attrs: { textAlign: 'center', class: 'figure-caption' },
          content: block.captionContent.map(convertInlineToV2),
        });
      }
      return {
        type: 'paragraph',
        content: nodes,
      };
    }

    case 'table':
      return {
        type: 'table',
        attrs: { id: block.id },
        content: block.rows?.map((row) => ({
          type: 'tableRow',
          attrs: { id: row.id, isHeader: row.isHeader },
          content: row.cells?.map((cell) => ({
            type: row.isHeader || cell.isHeader ? 'tableHeader' : 'tableCell',
            attrs: {
              colspan: cell.colSpan || 1,
              rowspan: cell.rowSpan || 1,
              alignment: cell.alignment,
            },
            content: cell.content?.length
              ? cell.content.map(convertBlockToV2)
              : [{ type: 'paragraph', content: [] }],
          })),
        })),
      };

    case 'equation':
      return {
        type: 'math_display',
        attrs: {
          latex: block.latex,
          id: block.id,
        },
      };

    case 'quote':
      return {
        type: 'blockquote',
        attrs: { id: block.id, citationAuthor: block.citationAuthor },
        content: block.content?.length
          ? block.content.map(convertBlockToV2)
          : [{ type: 'paragraph', content: [] }],
      };

    case 'list':
      return {
        type: block.variant === 'ordered' ? 'orderedList' : 'bulletList',
        attrs: { id: block.id },
        content: block.items?.map((item) => ({
          type: 'listItem',
          attrs: { id: item.id },
          content: item.content?.length
            ? item.content.map(convertBlockToV2)
            : [{ type: 'paragraph', content: [] }],
        })),
      };

    case 'page_break':
      return {
        type: 'pageBreak',
      };

    case 'scene_break':
      return {
        type: 'sceneBreak',
        attrs: {
          id: block.id,
          variant: block.variant || 'asterisms',
        },
      };

    case 'unsupported':
      return {
        type: 'unsupportedBlock',
        attrs: {
          id: block.id,
          originalType: block.originalType,
          originalAttrs: block.originalAttrs,
          originalContent: block.originalContent,
          reason: block.reason,
        },
      };

    default: {
      const unk = block as Record<string, unknown>;
      return {
        type: 'unsupportedBlock',
        attrs: {
          id: String(unk.id || ''),
          originalType: String(unk.type || 'unknown'),
          originalAttrs: unk,
          originalContent: Array.isArray(unk.content) ? unk.content : [],
        },
      };
    }
  }
}

/**
 * Преобразует Semantic AST в Tiptap v2 Document JSON.
 */
export function semanticASTToV2Doc(doc: WordDocumentDTO): V2NodeJson {
  const content: V2NodeJson[] = [];

  if (doc.blocks && Array.isArray(doc.blocks)) {
    for (const b of doc.blocks) {
      content.push(convertBlockToV2(b));
    }
  }

  if (content.length === 0) {
    content.push({ type: 'paragraph', content: [] });
  }

  return {
    type: 'doc',
    content,
  };
}
