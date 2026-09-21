/**
 * WordVibe Editor Design Tokens & Default Colors
 */

export const EDITOR_DEFAULT_COLORS = {
  highlight: '#ffff00',
  pageBreak: '#c0c0c0',
  pageGapBorder: '#c0c0c0'
} as const;

export type EditorDefaultColors = typeof EDITOR_DEFAULT_COLORS;
