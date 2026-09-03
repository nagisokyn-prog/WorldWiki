import type { Editor } from '@tiptap/core';
import type { Orientation } from '../../types/dto';

/**
 * Секционная смена ориентации отдельных страниц (www.md §3.2.2, §1.2.4).
 *
 * Ключевая ГОСТ-фича: лист с широкой таблицей/схемой делается альбомным,
 * следующий разрыв раздела возвращает книжную ориентацию.
 *
 * Архитектура:
 * - Базируется на встроенном `Section` extension из rk-editor-core
 *   (команда `insertSectionBreak`).
 * - Ориентация раздела маркируется атрибутом `data-orientation` на узле
 *   раздела (если узел присутствует в схеме) — по нему ExportEngine
 *   генерирует `<w:sectPr><w:pgSz w:orient="landscape"/></w:sectPr>` в DOCX.
 * - Геометрия PaginationPlus (tiptap-pagination-plus) не поддерживает
 *   страницы разных ориентаций в одном документе, поэтому одновременно
 *   переключается глобальная геометрия через `onOrientationChange`.
 */

interface EditorWithSectionCommands extends Editor {
  commands: Editor['commands'] & {
    insertSectionBreak?: () => boolean;
    pageBreak?: () => boolean;
  };
}

/**
 * Вставляет разрыв раздела и помечает новый раздел выбранной ориентацией.
 * @param onOrientationChange — колбэк переключения геометрии (глобальный layout)
 */
export function insertSectionWithOrientation(
  editor: Editor | null | undefined,
  orientation: Orientation,
  onOrientationChange?: (orientation: Orientation) => void
): boolean {
  if (!editor) return false;
  const ed = editor as EditorWithSectionCommands;

  try {
    // Разрыв раздела (Section extension из rk-editor-core)
    if (typeof ed.commands.insertSectionBreak === 'function') {
      ed.commands.insertSectionBreak();
    } else {
      console.warn('[SectionOrientation] insertSectionBreak command is unavailable — вставлен page break');
      ed.commands.pageBreak?.();
    }

    // Помечаем узел раздела атрибутом ориентации (для DOCX-экспорта)
    try {
      const { $from } = ed.state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name === 'section') {
          ed.chain().focus().updateAttributes('section', { 'data-orientation': orientation }).run();
          break;
        }
      }
    } catch {
      // Узел section отсутствует в схеме — ориентация остаётся только в layout
    }

    // Переключаем геометрию листа (глобально: PaginationPlus + rk pageLayout)
    onOrientationChange?.(orientation);
    return true;
  } catch (error) {
    console.warn('[SectionOrientation] insertSectionWithOrientation failed', error);
    return false;
  }
}

/** Разрыв раздела → следующий лист альбомный */
export function insertSectionLandscape(
  editor: Editor | null | undefined,
  onOrientationChange?: (o: Orientation) => void
): boolean {
  return insertSectionWithOrientation(editor, 'landscape', onOrientationChange);
}

/** Разрыв раздела → следующий лист книжный */
export function insertSectionPortrait(
  editor: Editor | null | undefined,
  onOrientationChange?: (o: Orientation) => void
): boolean {
  return insertSectionWithOrientation(editor, 'portrait', onOrientationChange);
}