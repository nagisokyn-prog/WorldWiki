/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ГОСТ-автоподписи таблиц («Таблица {N} — {название}» над таблицей).
 *
 * Архитектура (согласно www.md §1.2.3 Numbering Engine):
 * - Номер НЕ хранится в документе — он считается как чистая функция от DOM:
 *   сканируем документ, считаем существующие подписи и берём следующий номер.
 * - Подпись — обычный абзац с классом `gost-table-caption`, поэтому она
 *   переживает сохранение/загрузку HTML, undo/redo и экспорт в DOCX.
 *
 * Используется после `insertTable` (см. useRkWordEditor.insertTableWithCaption).
 */

/** Маркер подписи таблицы по ГОСТ 7.32 */
export const TABLE_CAPTION_RE = /^Таблица (\d+) — /;

/** Подсчитывает количество ГОСТ-подписей таблиц в документе */
export function countTableCaptions(doc: any): number {
  let count = 0;
  doc.descendants((node: any) => {
    if (node.type.name === 'paragraph' && TABLE_CAPTION_RE.test((node.textContent || '').trim())) {
      count += 1;
    }
  });
  return count;
}

/** Следующий номер подписи таблицы (нумерация сквозная по документу) */
export function nextTableCaptionNumber(doc: any): number {
  return countTableCaptions(doc) + 1;
}

/** Строит текст подписи по ГОСТ: «Таблица {N} — {название}» */
export function buildTableCaptionText(number: number, title?: string): string {
  return `Таблица ${number} — ${title && title.trim() ? title.trim() : '(название таблицы)'}`;
}

/**
 * Находит позицию начала внешней таблицы относительно текущей каретки.
 * Возвращает позицию до таблицы или null, если каретка вне таблицы.
 */
export function findTableStartBefore(editor: any): number | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === 'table') {
      return $from.before(depth);
    }
  }
  return null;
}

/**
 * Вставляет ГОСТ-подпись над таблицей у каретки.
 * Если пользователь передал название — используется оно, иначе плейсхолдер,
 * который можно отредактировать кликом.
 */
export function insertGostTableCaption(editor: any, title?: string): boolean {
  if (!editor) return false;
  const tableStart = findTableStartBefore(editor);
  if (tableStart === null) return false;

  const number = nextTableCaptionNumber(editor.state.doc);
  const text = buildTableCaptionText(number, title);

  return editor
    .chain()
    .insertContentAt(tableStart, {
      type: 'paragraph',
      attrs: { class: 'gost-table-caption' },
      content: [{ type: 'text', text }],
    })
    .run();
}