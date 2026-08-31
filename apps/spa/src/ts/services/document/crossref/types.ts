/**
 * Cross-Reference Types for WorldWiki Document Engine.
 */

export interface ResolvedCrossReference {
  targetId: string;
  kind: 'heading' | 'figure' | 'table' | 'equation' | 'page';
  displayMode: 'full' | 'short' | 'number_only';
  label: string;      // e.g. "Рисунок 2", "рис. 2", "2"
  isBroken: boolean;  // True if target node was deleted
  targetTitle?: string;
}
