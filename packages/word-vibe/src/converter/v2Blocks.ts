import type {
  WordBlockDTO,
  WordParagraphBlockDTO,
  WordHeadingBlockDTO,
  WordTableBlockDTO,
  WordTableRowDTO,
  WordTableCellDTO,
  WordEquationBlockDTO,
  WordQuoteBlockDTO,
  WordListBlockDTO,
  WordPageBreakBlockDTO,
  WordSceneBreakBlockDTO,
  WordUnsupportedBlockDTO,
  WordFigureBlockDTO,
  WordInlineDTO,
} from '../types/dto';
import type { V2NodeJson } from './ASTToV2Converter';
import { convertInlineFromV2, generateId } from './v2Inlines';

export function toHeadingLevel(val: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  const num = Number(val);
  if (num >= 1 && num <= 6) return num as 1 | 2 | 3 | 4 | 5 | 6;
  return 1;
}

export function toAlignment(val: unknown): 'left' | 'center' | 'right' | 'justify' | undefined {
  if (val === 'left' || val === 'center' || val === 'right' || val === 'justify') {
    return val;
  }
  return undefined;
}

export function toCellAlignment(val: unknown): 'left' | 'center' | 'right' | undefined {
  if (val === 'left' || val === 'center' || val === 'right') {
    return val;
  }
  return undefined;
}

export function toSceneBreakVariant(val: unknown): 'asterisms' | 'line' | 'space' {
  if (val === 'asterisms' || val === 'line' || val === 'space') {
    return val;
  }
  return 'asterisms';
}

export function toNumberingMode(val: unknown): 'auto' | 'none' | undefined {
  if (val === 'auto' || val === 'none') {
    return val;
  }
  return undefined;
}

export function parseIndentMm(rawIndent?: unknown): number | undefined {
  if (typeof rawIndent === 'number') return rawIndent;
  if (typeof rawIndent !== 'string') return undefined;

  const parsed = parseFloat(rawIndent);
  if (isNaN(parsed)) return undefined;

  if (rawIndent.endsWith('cm')) return parsed * 10;
  if (rawIndent.endsWith('mm')) return parsed;
  if (rawIndent.endsWith('pt')) return parsed * 0.352778;
  if (rawIndent.endsWith('px')) return parsed * 0.264583;
  return parsed;
}

export function convertBlockFromV2(node: V2NodeJson): WordBlockDTO {
  const id = String(node.attrs?.id || generateId());

  switch (node.type) {
    case 'paragraph': {
      const imageNode = node.content?.find((c) => c.type === 'image');
      if (imageNode) {
        const figure: WordFigureBlockDTO = {
          type: 'figure',
          id,
          mediaUrl: String(imageNode.attrs?.src || ''),
          alignment: toCellAlignment(imageNode.attrs?.alignment) || 'center',
          width: typeof imageNode.attrs?.width === 'string' || typeof imageNode.attrs?.width === 'number'
            ? imageNode.attrs.width
            : undefined,
          captionContent: [],
        };
        const captionNode = node.content?.find((c) => c.type === 'paragraph' && (c.attrs?.class === 'figure-caption' || c.attrs?.class === 'caption'));
        if (captionNode && captionNode.content) {
          figure.captionContent = captionNode.content.map(convertInlineFromV2);
        }
        return figure;
      }

      const styleOverride: WordParagraphBlockDTO['styleOverride'] = {};
      if (node.attrs?.textAlign) {
        styleOverride.alignment = toAlignment(node.attrs.textAlign);
      }
      if (node.attrs?.firstLineIndent) {
        styleOverride.firstLineIndentMm = parseIndentMm(node.attrs.firstLineIndent);
      }
      if (node.attrs?.lineHeight) {
        const lh = parseFloat(String(node.attrs.lineHeight));
        if (!isNaN(lh)) styleOverride.lineHeight = lh;
      }

      const res: WordParagraphBlockDTO = {
        type: 'paragraph',
        id,
        content: node.content ? node.content.map(convertInlineFromV2) : [],
      };
      if (Object.keys(styleOverride).length > 0) {
        res.styleOverride = styleOverride;
      }
      return res;
    }

    case 'heading': {
      const heading: WordHeadingBlockDTO = {
        type: 'heading',
        id,
        level: toHeadingLevel(node.attrs?.level),
        content: node.content ? node.content.map(convertInlineFromV2) : [],
        numberingMode: toNumberingMode(node.attrs?.numberingMode) || 'auto',
      };
      return heading;
    }

    case 'image': {
      const figure: WordFigureBlockDTO = {
        type: 'figure',
        id,
        mediaUrl: String(node.attrs?.src || ''),
        alignment: toCellAlignment(node.attrs?.alignment) || 'center',
        width: typeof node.attrs?.width === 'string' || typeof node.attrs?.width === 'number'
          ? node.attrs.width
          : undefined,
        captionContent: node.attrs?.alt ? [{ type: 'text', text: String(node.attrs.alt) }] : [],
      };
      return figure;
    }

    case 'table': {
      const rows: WordTableRowDTO[] = [];
      if (node.content && Array.isArray(node.content)) {
        for (const r of node.content) {
          if (r.type === 'tableRow') {
            const cells: WordTableCellDTO[] = [];
            let isRowHeader = Boolean(r.attrs?.isHeader);
            if (r.content && Array.isArray(r.content)) {
              for (const c of r.content) {
                if (c.type === 'tableHeader') isRowHeader = true;
                const cellBlocks = c.content ? c.content.map(convertBlockFromV2) : [];
                cells.push({
                  id: String(c.attrs?.id || generateId()),
                  isHeader: c.type === 'tableHeader',
                  colSpan: Number(c.attrs?.colspan) || 1,
                  rowSpan: Number(c.attrs?.rowspan) || 1,
                  alignment: toCellAlignment(c.attrs?.alignment),
                  content: cellBlocks,
                });
              }
            }
            rows.push({
              id: String(r.attrs?.id || generateId()),
              isHeader: isRowHeader,
              cells,
            });
          }
        }
      }

      const table: WordTableBlockDTO = {
        type: 'table',
        id,
        captionContent: [],
        rows,
      };
      return table;
    }

    case 'math_display':
    case 'mathBlock': {
      const equation: WordEquationBlockDTO = {
        type: 'equation',
        id,
        latex: String(node.attrs?.latex || ''),
      };
      return equation;
    }

    case 'blockquote': {
      const quote: WordQuoteBlockDTO = {
        type: 'quote',
        id,
        content: node.content ? node.content.map(convertBlockFromV2) : [],
        citationAuthor: node.attrs?.citationAuthor ? String(node.attrs.citationAuthor) : undefined,
      };
      return quote;
    }

    case 'orderedList':
    case 'bulletList': {
      const list: WordListBlockDTO = {
        type: 'list',
        id,
        variant: node.type === 'orderedList' ? 'ordered' : 'bullet',
        items: node.content
          ? node.content.map((item) => ({
              id: String(item.attrs?.id || generateId()),
              content: item.content ? item.content.map(convertBlockFromV2) : [],
            }))
          : [],
      };
      return list;
    }

    case 'pageBreak': {
      const pb: WordPageBreakBlockDTO = {
        type: 'page_break',
        id,
      };
      return pb;
    }

    case 'sceneBreak': {
      const sb: WordSceneBreakBlockDTO = {
        type: 'scene_break',
        id,
        variant: toSceneBreakVariant(node.attrs?.variant),
      };
      return sb;
    }

    case 'unsupportedBlock': {
      const unsupp: WordUnsupportedBlockDTO = {
        type: 'unsupported',
        id: String(node.attrs?.id || id),
        originalType: String(node.attrs?.originalType || 'unknown'),
        originalAttrs: (node.attrs?.originalAttrs as Record<string, unknown> | undefined),
        originalContent: (node.attrs?.originalContent as (WordBlockDTO | WordInlineDTO)[] | undefined),
        reason: node.attrs?.reason ? String(node.attrs.reason) : undefined,
      };
      return unsupp;
    }

    default: {
      const unsupp: WordUnsupportedBlockDTO = {
        type: 'unsupported',
        id,
        originalType: node.type,
        originalAttrs: node.attrs,
        originalContent: node.content ? node.content.map(convertBlockFromV2) : undefined,
      };
      return unsupp;
    }
  }
}
