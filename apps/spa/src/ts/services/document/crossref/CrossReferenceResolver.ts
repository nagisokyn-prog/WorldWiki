import type { BlockNode, CrossReferenceNode, InlineNode, SemanticDocument } from '../ast/types';
import type { NumberingContext, NumberingProfile } from '../numbering/types';
import type { ResolvedCrossReference } from './types';

/**
 * Resolves CrossReferenceNode references against the document AST and computed NumberingContext.
 * Gracefully handles broken/deleted targets and formatting modes.
 */
export class CrossReferenceResolver {
  /**
   * Resolves a single cross-reference.
   */
  public static resolve(
    ref: CrossReferenceNode,
    doc: SemanticDocument,
    ctx: NumberingContext,
    profile: NumberingProfile
  ): ResolvedCrossReference {
    const targetNode = this.findNodeById(doc, ref.targetId);

    if (!targetNode) {
      return {
        targetId: ref.targetId,
        kind: ref.kind,
        displayMode: ref.displayMode,
        label: '[ошибка: объект удален]',
        isBroken: true
      };
    }

    let num = '';
    let targetTitle: string | undefined;

    switch (ref.kind) {
      case 'heading': {
        num = ctx.headings.get(ref.targetId) || '';
        if (targetNode.type === 'heading' && targetNode.content) {
          targetTitle = this.extractPlainText(targetNode.content);
        }
        break;
      }
      case 'figure': {
        num = ctx.figures.get(ref.targetId) || '';
        if (targetNode.type === 'figure' && targetNode.captionContent) {
          targetTitle = this.extractPlainText(targetNode.captionContent);
        }
        break;
      }
      case 'table': {
        num = ctx.tables.get(ref.targetId) || '';
        if (targetNode.type === 'table' && targetNode.captionContent) {
          targetTitle = this.extractPlainText(targetNode.captionContent);
        }
        break;
      }
      case 'equation': {
        num = ctx.equations.get(ref.targetId) || '';
        break;
      }
      default:
        break;
    }

    if (!num) {
      return {
        targetId: ref.targetId,
        kind: ref.kind,
        displayMode: ref.displayMode,
        label: '[не пронумеровано]',
        isBroken: false,
        targetTitle
      };
    }

    const label = this.formatLabel(ref.kind, num, ref.displayMode, profile);

    return {
      targetId: ref.targetId,
      kind: ref.kind,
      displayMode: ref.displayMode,
      label,
      isBroken: false,
      targetTitle
    };
  }

  /**
   * Scans document and resolves all cross references into a lookup Map.
   */
  public static resolveAll(
    doc: SemanticDocument,
    ctx: NumberingContext,
    profile: NumberingProfile
  ): Map<string, ResolvedCrossReference> {
    const result = new Map<string, ResolvedCrossReference>();

    const traverseInline = (inlines: InlineNode[]): void => {
      for (const inline of inlines) {
        if (inline.type === 'cross_reference') {
          const resolved = this.resolve(inline, doc, ctx, profile);
          result.set(inline.targetId, resolved);
        } else if (inline.type === 'footnote_reference' && inline.content) {
          traverseInline(inline.content);
        }
      }
    };

    const traverseBlock = (block: BlockNode): void => {
      if ('content' in block && Array.isArray(block.content)) {
        // Block contains inlines or blocks
        for (const item of block.content) {
          if ('type' in item && typeof item.type === 'string') {
            if (this.isInlineNode(item as InlineNode)) {
              traverseInline([item as InlineNode]);
            } else {
              traverseBlock(item as BlockNode);
            }
          }
        }
      }

      if ('captionContent' in block && Array.isArray(block.captionContent)) {
        traverseInline(block.captionContent);
      }

      if (block.type === 'table' && block.rows) {
        for (const row of block.rows) {
          for (const cell of row.cells) {
            if (cell.content) {
              for (const nested of cell.content) {
                traverseBlock(nested);
              }
            }
          }
        }
      }
    };

    for (const block of doc.blocks) {
      traverseBlock(block);
    }

    return result;
  }

  private static formatLabel(
    kind: CrossReferenceNode['kind'],
    num: string,
    mode: CrossReferenceNode['displayMode'],
    profile: NumberingProfile
  ): string {
    if (mode === 'number_only') {
      return num;
    }

    switch (kind) {
      case 'figure':
        return mode === 'short' ? `рис. ${num}` : `${profile.figurePrefix} ${num}`;
      case 'table':
        return mode === 'short' ? `табл. ${num}` : `${profile.tablePrefix} ${num}`;
      case 'heading':
        return mode === 'short' ? `разд. ${num}` : `раздел ${num}`;
      case 'equation':
        return profile.equationFormat === 'parens' ? `(${num})` : `формула ${num}`;
      default:
        return num;
    }
  }

  private static findNodeById(doc: SemanticDocument, targetId: string): BlockNode | undefined {
    for (const block of doc.blocks) {
      if (block.id === targetId) {
        return block;
      }
      if (block.type === 'table' && block.rows) {
        for (const row of block.rows) {
          for (const cell of row.cells) {
            if (cell.content) {
              for (const nested of cell.content) {
                if (nested.id === targetId) {
                  return nested;
                }
              }
            }
          }
        }
      }
    }
    return undefined;
  }

  private static extractPlainText(inlines: InlineNode[]): string {
    return inlines
      .map((i) => {
        if (i.type === 'text') {
          return i.text;
        }
        if (i.type === 'math_inline') {
          return `$${i.latex}$`;
        }
        return '';
      })
      .join('')
      .trim();
  }

  private static isInlineNode(node: InlineNode | BlockNode): boolean {
    return (
      node.type === 'text' ||
      node.type === 'math_inline' ||
      node.type === 'cross_reference' ||
      node.type === 'footnote_reference'
    );
  }
}
