import type { BlockNode, InlineNode, SemanticDocument } from '../ast/types';
import type { NumberingContext, NumberingProfile } from './types';

/**
 * Pure, deterministic Numbering Engine for WorldWiki documents.
 * Calculates dynamic numbers for headings, figures, tables, equations, and footnotes
 * based on the active NumberingProfile rules.
 */
export class NumberingEngine {
  public static compute(doc: SemanticDocument, profile: NumberingProfile): NumberingContext {
    const headings = new Map<string, string>();
    const figures = new Map<string, string>();
    const tables = new Map<string, string>();
    const equations = new Map<string, string>();
    const footnotes = new Map<string, number>();

    // Heading hierarchy levels: 1..6
    const headingCounters = [0, 0, 0, 0, 0, 0];
    let currentChapterNumber = 0;

    // Global counters
    let globalFigureCount = 0;
    let globalTableCount = 0;
    let globalEquationCount = 0;
    let globalFootnoteCount = 0;

    // Per-chapter counters
    let chapterFigureCount = 0;
    let chapterTableCount = 0;
    let chapterEquationCount = 0;

    const traverseInline = (inlines: InlineNode[]): void => {
      for (const inline of inlines) {
        if (inline.type === 'footnote_reference') {
          globalFootnoteCount++;
          footnotes.set(inline.id, globalFootnoteCount);
          if (inline.content && inline.content.length > 0) {
            traverseInline(inline.content);
          }
        }
      }
    };

    const traverseBlock = (block: BlockNode): void => {
      switch (block.type) {
        case 'heading': {
          if (profile.headingNumberingEnabled && block.numberingMode !== 'none') {
            const levelIdx = Math.max(0, Math.min(5, block.level - 1));

            // Ensure parent heading levels are initialized to at least 1 if heading started at deep level
            for (let i = 0; i < levelIdx; i++) {
              if (headingCounters[i] === 0) {
                headingCounters[i] = 1;
                if (i === 0) {
                  currentChapterNumber = 1;
                }
              }
            }

            headingCounters[levelIdx]++;

            // Reset lower levels
            for (let i = levelIdx + 1; i < headingCounters.length; i++) {
              headingCounters[i] = 0;
            }

            if (block.level === 1) {
              currentChapterNumber = headingCounters[0];
              // Reset per-chapter object counts
              chapterFigureCount = 0;
              chapterTableCount = 0;
              chapterEquationCount = 0;
            }

            const headingNum = headingCounters.slice(0, levelIdx + 1).join('.');
            headings.set(block.id, headingNum);
          }

          if (block.content) {
            traverseInline(block.content);
          }
          break;
        }

        case 'figure': {
          if (block.numberingMode !== 'none') {
            globalFigureCount++;
            chapterFigureCount++;

            const isByChapter =
              block.numberingMode === 'by_chapter' ||
              (block.numberingMode === 'global' && profile.figureMode === 'by_chapter');

            const numStr =
              isByChapter && currentChapterNumber > 0
                ? `${currentChapterNumber}.${chapterFigureCount}`
                : `${globalFigureCount}`;

            figures.set(block.id, numStr);
          }

          if (block.captionContent) {
            traverseInline(block.captionContent);
          }
          break;
        }

        case 'table': {
          if (block.numberingMode !== 'none') {
            globalTableCount++;
            chapterTableCount++;

            const isByChapter =
              block.numberingMode === 'by_chapter' ||
              (block.numberingMode === 'global' && profile.tableMode === 'by_chapter');

            const numStr =
              isByChapter && currentChapterNumber > 0
                ? `${currentChapterNumber}.${chapterTableCount}`
                : `${globalTableCount}`;

            tables.set(block.id, numStr);
          }

          if (block.captionContent) {
            traverseInline(block.captionContent);
          }

          if (block.rows) {
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
          break;
        }

        case 'equation': {
          if (block.numberingMode !== 'none') {
            globalEquationCount++;
            chapterEquationCount++;

            const isByChapter = profile.equationMode === 'by_chapter';
            const numStr =
              isByChapter && currentChapterNumber > 0
                ? `${currentChapterNumber}.${chapterEquationCount}`
                : `${globalEquationCount}`;

            equations.set(block.id, numStr);
          }
          break;
        }

        case 'paragraph': {
          if (block.content) {
            traverseInline(block.content);
          }
          break;
        }

        case 'quote': {
          if (block.content) {
            for (const nested of block.content) {
              traverseBlock(nested);
            }
          }
          break;
        }

        case 'list': {
          if (block.items) {
            for (const item of block.items) {
              if (item.content) {
                for (const nested of item.content) {
                  traverseBlock(nested);
                }
              }
            }
          }
          break;
        }

        default:
          break;
      }
    };

    for (const block of doc.blocks) {
      traverseBlock(block);
    }

    return {
      headings,
      figures,
      tables,
      equations,
      footnotes
    };
  }
}
