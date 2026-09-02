/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ГОСТ-автоподписи рисунков («Рисунок {N} — {название}» под рисунком).
 *
 * Архитектура (согласно www.md §1.2.3 Numbering Engine):
 * - Номер считается динамически при вставке (чистая функция от документа),
 *   не хранится в базе.
 * - Подпись — абзац с классом `gost-figure-caption` сразу ПОСЛЕ изображения.
 *
 * Используется после `insertImage` (см. useRkWordEditor.insertImageWithCaption).
 */

/** Маркер подписи рисунка по ГОСТ 7.32 */
export const FIGURE_CAPTION_RE = /^Рисунок (\d+) — /;

/** Подсчитывает количество ГОСТ-подписей рисунков в документе */
export function countFigureCaptions(doc: any): number {
  let count = 0;
  doc.descendants((node: any) => {
    if (node.type.name === 'paragraph' && FIGURE_CAPTION_RE.test((node.textContent || '').trim())) {
      count += 1;
    }
  });
  return count;
}

/** Следующий номер подписи рисунка */
export function nextFigureCaptionNumber(doc: any): number {
  return countFigureCaptions(doc) + 1;
}

/** Строит текст подписи по ГОСТ: «Рисунок {N} — {название}» */
export function buildFigureCaptionText(number: number, title?: string): string {
  return `Рисунок ${number} — ${title && title.trim() ? title.trim() : '(описание рисунка)'}`;
}

/**
 * Находит узел изображения у каретки и возвращает { pos, size } или null.
 */
export function findImageAtSelection(editor: any): { pos: number; size: number } | null {
  const { from } = editor.state.selection;
  const resolved = editor.state.doc.resolve(from);
  for (let depth = resolved.depth; depth >= 0; depth -= 1) {
    const node = resolved.node(depth);
    if (node.type.name === 'image') {
      return { pos: resolved.before(depth), size: node.nodeSize };
    }
  }
  return null;
}

/**
 * Вставляет ГОСТ-подпись под изображением у каретки.
 * Если пользователь ввёл подпись в диалоге — используется она.
 */
export function insertGostFigureCaption(editor: any, title?: string): boolean {
  if (!editor) return false;
  const image = findImageAtSelection(editor);
  if (!image) return false;

  const number = nextFigureCaptionNumber(editor.state.doc);
  const text = buildFigureCaptionText(number, title);
  const insertAt = image.pos + image.size;

  return editor
    .chain()
    .insertContentAt(insertAt, {
      type: 'paragraph',
      attrs: { class: 'gost-figure-caption' },
      content: [{ type: 'text', text }],
    })
    .run();
}