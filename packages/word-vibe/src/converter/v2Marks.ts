import type { WordTextMarkDTO } from '../types/dto';
import type { V2MarkJson } from './ASTToV2Converter';
import { EDITOR_DEFAULT_COLORS } from '../tokens/editor.tokens';

export function convertMarksFromV2(marks?: V2MarkJson[]): WordTextMarkDTO[] | undefined {
  if (!marks || marks.length === 0) return undefined;

  const result: WordTextMarkDTO[] = [];
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
      case 'highlight':
        result.push({ type: 'highlight', color: String(m.attrs?.color || EDITOR_DEFAULT_COLORS.highlight) });
        break;
      case 'link':
        result.push({ type: 'link', href: String(m.attrs?.href || ''), title: m.attrs?.title ? String(m.attrs.title) : undefined });
        break;
      case 'textStyle': {
        if (m.attrs?.color) {
          result.push({ type: 'color', color: String(m.attrs.color) });
        }
        if (m.attrs?.fontFamily) {
          result.push({ type: 'fontFamily', font: String(m.attrs.fontFamily) });
        }
        if (m.attrs?.fontSize) {
          const rawSize = String(m.attrs.fontSize);
          const parsed = parseFloat(rawSize);
          if (!isNaN(parsed)) {
            result.push({ type: 'fontSize', sizePt: parsed });
          }
        }
        break;
      }
    }
  }

  return result.length ? result : undefined;
}
