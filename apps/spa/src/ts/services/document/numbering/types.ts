/**
 * Numbering Engine Contracts for WorldWiki Document Engine.
 * Strict typing for dynamic counters.
 */

export interface NumberingContext {
  headings: Map<string, string>;   // headingId -> "1", "1.1", "1.1.1"
  figures: Map<string, string>;    // figureId -> "1", "2.1"
  tables: Map<string, string>;     // tableId -> "1", "3.2"
  equations: Map<string, string>;  // equationId -> "1", "2"
  footnotes: Map<string, number>;  // footnoteId -> 1, 2, 3...
}

export interface NumberingProfile {
  figureMode: 'global' | 'by_chapter';
  tableMode: 'global' | 'by_chapter';
  equationMode: 'global' | 'by_chapter';
  footnoteRestartPerPage: boolean;
  headingNumberingEnabled: boolean;
  figurePrefix: string;  // e.g. "Рисунок"
  tablePrefix: string;   // e.g. "Таблица"
  equationFormat: 'parens' | 'plain'; // e.g. "(1)" or "1"
}
