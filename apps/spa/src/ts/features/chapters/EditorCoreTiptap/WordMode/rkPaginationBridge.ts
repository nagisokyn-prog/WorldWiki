import { PaginationPlus } from 'tiptap-pagination-plus';
import { getPageGeometry, type PaginationGeometry } from './geometryHelper';

export type { PaginationGeometry };

/**
 * Мост между @raazkhnl/rk-editor-core и tiptap-pagination-plus.
 *
 * Встроенный extension `pagination` в rk-editor-core не умеет ни листов,
 * ни полей, ни колонтитулов. tiptap-pagination-plus рисует настоящие листы
 * бумаги (зазор + рамка между страницами), поля страницы и настраиваемые
 * колонтитулы (headerLeft/Right, footerLeft/Right с подстановкой {page}/{total}).
 *
 * Механика: пересобираем внутренний tiptap-редактор rk (tiptap v2!) с тем же
 * набором расширений + PaginationPlus, отключаем встроенную rk-пагинацию и
 * подменяем editor внутри обёртки WordEditor, чтобы команды/экспорт работали.
 *
 * ВАЖНО: rk-editor-core построен на @tiptap/core@2.27 (v2), а приложение —
 * на v3. Класс редактора берётся из живых объектов rk; импорты самого
 * PaginationPlus перенаправляются на v2-копии vite-плагином
 * `pagination-plus-tiptap-v2` (см. vite.config.ts).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Конфиг колонтитулов (значения — HTML; поддерживаются {page} и {total}) */
export interface PaginationTextOptions {
  headerLeft?: string;
  headerRight?: string;
  footerLeft?: string;
  footerRight?: string;
}

/** Отключает встроенную rk-пагинацию и сбрасывает её widget-спейсеры */
export function disableRkBuiltinPagination(editor: any): void {
  try {
    const ext = (editor.extensionManager?.extensions || []).find((e: { name: string }) => e.name === 'pagination');
    if (ext) {
      ext.options.enabled = false;
    }
    // Q.key встроенного rk-плагина: 'rkPagination' + '$'
    editor.view?.dispatch(editor.state.tr.setMeta('rkPagination$', true));
  } catch (error) {
    console.warn('[rkPaginationBridge] failed to disable builtin pagination', error);
  }
}

/**
 * Пересоздаёт внутренний tiptap-редактор WordEditor с подключённым
 * tiptap-pagination-plus и подменяет его внутри обёртки.
 * Возвращает новый редактор или null (если инъекция невозможна — например,
 * в юнит-тестах с мок-обёрткой).
 */
export function attachPaginationPlus(
  wordEditor: unknown,
  options: {
    geometry: PaginationGeometry;
    text?: PaginationTextOptions;
    onHeaderClick?: (pageNumber: number) => void;
    onFooterClick?: (pageNumber: number) => void;
    onUpdate: (editor: any) => void;
    onSelectionChange?: (editor: any) => void;
  }
): any | null {
  try {
    const wrapper = wordEditor as {
      instance?: any;
      editor?: any;
      applyPageLayoutToDOM?: (element: HTMLElement) => void;
    };
    const original = wrapper.instance;
    const host = original?.options?.element;
    const extensions = original?.options?.extensions;

    if (!original || !host || !Array.isArray(extensions) || extensions.length === 0) {
      // Мок/неожиданная структура — работаем на встроенной пагинации
      return null;
    }

    // Класс редактора — из того же ядра tiptap v2, что и rk
    const V2Editor = original.constructor;
    const html = original.getHTML();
    const editable = original.isEditable;
    const geo = getPageGeometry(options.geometry);
    const text = options.text || {};

    const next = new V2Editor({
      element: host,
      extensions: [
        ...extensions,
        PaginationPlus.configure({
          enabled: true,
          pageWidth: geo.pageWidth,
          pageHeight: geo.pageHeight,
          marginTop: geo.marginTop,
          marginBottom: geo.marginBottom,
          marginLeft: geo.marginLeft,
          marginRight: geo.marginRight,
          pageGap: 24,
          pageGapBorderSize: 1,
          pageGapBorderColor: '#e5e5e5',
          pageBreakBackground: '#ffffff',
          headerLeft: text.headerLeft ?? '',
          headerRight: text.headerRight ?? '',
          footerLeft: text.footerLeft ?? '',
          footerRight: text.footerRight ?? '',
          onHeaderClick: ({ pageNumber }: { pageNumber: number }) => options.onHeaderClick?.(pageNumber),
          onFooterClick: ({ pageNumber }: { pageNumber: number }) => options.onFooterClick?.(pageNumber),
        }),
      ],
      content: html,
      editable,
      onUpdate: ({ editor: updated }: { editor: any }) => options.onUpdate(updated),
      onSelectionUpdate: ({ editor: updated }: { editor: any }) => options.onSelectionChange?.(updated),
    });

    // Отключаем встроенную rk-пагинацию в новом редакторе
    disableRkBuiltinPagination(next);

    // Уничтожаем исходный редактор и подменяем его внутри обёртки,
    // чтобы команды / экспорт / печать WordEditor работали как раньше
    original.destroy();
    wrapper.editor = next;
    wrapper.applyPageLayoutToDOM?.(host);

    return next;
  } catch (error) {
    console.warn('[rkPaginationBridge] pagination injection failed', error);
    return null;
  }
}

/** Обновляет геометрию страниц (формат / ориентация / поля) */
export function updatePaginationLayout(editor: any | null | undefined, geometry: PaginationGeometry): void {
  if (!editor) return;
  const geo = getPageGeometry(geometry);
  try {
    editor
      .chain()
      .focus()
      .updatePageWidth(geo.pageWidth)
      .updatePageHeight(geo.pageHeight)
      .updateMargins({
        top: geo.marginTop,
        bottom: geo.marginBottom,
        left: geo.marginLeft,
        right: geo.marginRight,
      })
      .run();
  } catch (error) {
    console.warn('[rkPaginationBridge] updatePaginationLayout failed', error);
  }
}

/** Обновляет текст колонтитулов (HTML; {page}/{total} подставляются автоматически) */
export function updatePaginationText(editor: any | null | undefined, text: PaginationTextOptions): void {
  if (!editor) return;
  try {
    const chain = editor.chain().focus();
    if (text.headerLeft !== undefined || text.headerRight !== undefined) {
      chain.updateHeaderContent(text.headerLeft ?? '', text.headerRight ?? '');
    }
    if (text.footerLeft !== undefined || text.footerRight !== undefined) {
      chain.updateFooterContent(text.footerLeft ?? '', text.footerRight ?? '');
    }
    chain.run();
  } catch (error) {
    console.warn('[rkPaginationBridge] updatePaginationText failed', error);
  }
}

/** Читает измеренное количество страниц (листы создаются в DOM асинхронно) */
export function readPageCount(editor: any | null | undefined): number {
  try {
    const el: HTMLElement | undefined = editor?.options?.element;
    if (el) {
      const pages = el.querySelectorAll('.rm-page-break').length;
      if (pages > 0) return pages;
    }
  } catch {
    // ignore
  }
  return 1;
}