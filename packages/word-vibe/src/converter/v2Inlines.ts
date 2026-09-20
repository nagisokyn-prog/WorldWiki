import type { WordInlineDTO } from '../types/dto';
import type { V2NodeJson } from './ASTToV2Converter';
import { convertMarksFromV2 } from './v2Marks';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function toCrossReferenceKind(val: unknown): 'heading' | 'figure' | 'table' | 'equation' | 'page' {
  if (val === 'heading' || val === 'figure' || val === 'table' || val === 'equation' || val === 'page') {
    return val;
  }
  return 'heading';
}

export function toDisplayMode(val: unknown): 'full' | 'short' | 'number_only' {
  if (val === 'full' || val === 'short' || val === 'number_only') {
    return val;
  }
  return 'full';
}

export function convertInlineFromV2(node: V2NodeJson): WordInlineDTO {
  switch (node.type) {
    case 'text':
      return {
        type: 'text',
        text: node.text || '',
        marks: convertMarksFromV2(node.marks),
      };

    case 'math_inline':
      return {
        type: 'math_inline',
        latex: String(node.attrs?.latex || ''),
      };

    case 'footnote':
      return {
        type: 'footnote_reference',
        id: String(node.attrs?.id || generateId()),
        content: node.content ? node.content.map(convertInlineFromV2) : [],
      };

    case 'crossReference':
      return {
        type: 'cross_reference',
        targetId: String(node.attrs?.targetId || ''),
        kind: toCrossReferenceKind(node.attrs?.kind),
        displayMode: toDisplayMode(node.attrs?.displayMode),
      };

    case 'entityReference':
      return {
        type: 'entity_reference',
        id: String(node.attrs?.id || generateId()),
        entityType: String(node.attrs?.entityType || 'character'),
        name: String(node.attrs?.name || ''),
        url: node.attrs?.url ? String(node.attrs.url) : undefined,
      };

    default:
      return {
        type: 'text',
        text: node.text || '',
        marks: convertMarksFromV2(node.marks),
      };
  }
}
