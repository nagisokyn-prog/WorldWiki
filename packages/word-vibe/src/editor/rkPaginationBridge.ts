import { PaginationPlus } from 'tiptap-pagination-plus';
import type { Editor, AnyExtension } from '@tiptap/core';
import { getPageGeometry, type PaginationGeometry } from './geometryHelper';

export type { PaginationGeometry };

/**
 * Мост между @raazkhnl/rk-editor-core и tiptap-pagination-plus.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paginationPlus: {
      updatePageWidth: (width: number) => ReturnType;
      updatePageHeight: (height: number) => ReturnType;
      updateMargins: (margins: { top: number; bottom: number; left: number; right: number }) => ReturnType;
      updateHeaderContent: (left: string, right: string) => ReturnType;
      updateFooterContent: (left: string, right: string) => ReturnType;
    };
  }
}

/** Конфиг колонтитулов (значения — HTML; поддерживаются {page} и {total}) */
export interface PaginationTextOptions {
  headerLeft?: string;
  headerRight?: string;
  footerLeft?: string;
  footerRight?: string;
}

interface WordEditorWrapper {
  instance?: Editor;
  editor?: Editor;
  applyPageLayoutToDOM?: (element: HTMLElement) => void;
  [key: string]: unknown;
}

/** Отключает встроенную rk-пагинацию и сбрасывает её widget-спейсеры */
export function disableRkBuiltinPagination(editor: Editor): void {
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
 */
export function attachPaginationPlus(
  wordEditor: unknown,
  options: {
    geometry: PaginationGeometry;
    text?: PaginationTextOptions;
    extraExtensions?: AnyExtension[];
    onHeaderClick?: (pageNumber: number) => void;
    onFooterClick?: (pageNumber: number) => void;
    onUpdate: (editor: Editor) => void;
    onSelectionChange?: (editor: Editor) => void;
  }
): Editor | null {
  try {
    const wrapper = wordEditor as WordEditorWrapper;
    const original = wrapper?.instance;
    const host = (original?.options?.element as HTMLElement | undefined) ?? null;
    const extensions = original?.options?.extensions;

    console.info('[rkPaginationBridge] attach: start', {
      hasInstance: Boolean(original),
      hasHost: Boolean(host),
      extensionCount: Array.isArray(extensions) ? extensions.length : 0,
    });

    if (!original || !host || !Array.isArray(extensions) || extensions.length === 0) {
      console.warn('[rkPaginationBridge] attach: aborted — wrapper structure is not a live V2 editor');
      return null;
    }

    const V2Editor = original.constructor as new (opts: Record<string, unknown>) => Editor;
    const html = original.getHTML();
    const editable = original.isEditable;
    const geo = getPageGeometry(options.geometry);
    const text = options.text || {};

    const next = new V2Editor({
      element: host,
      extensions: [
        ...extensions,
        ...(options.extraExtensions || []),
        PaginationPlus.configure({
          enabled: true,
          pageWidth: geo.pageWidth,
          pageHeight: geo.pageHeight,
          marginTop: geo.marginTop,
          marginBottom: geo.marginBottom,
          marginLeft: geo.marginLeft,
          marginRight: geo.marginRight,
          pageGap: 40,
          pageBreakBackground: '#c0c0c0',
          pageGapBorderColor: '#c0c0c0',
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
      onUpdate: ({ editor: updated }: { editor: Editor }) => options.onUpdate(updated),
      onSelectionUpdate: ({ editor: updated }: { editor: Editor }) => options.onSelectionChange?.(updated),
    });

    console.info('[rkPaginationBridge] attach: V2Editor with PaginationPlus created');

    if (typeof (next.commands as Record<string, unknown>)?.updatePageWidth !== 'function') {
      console.error(
        '[rkPaginationBridge] PaginationPlus commands are NOT registered in the new editor ' +
        '(вероятно, двойная копия @tiptap/prosemirror в pnpm). Откат без подмены редактора.'
      );
      next.destroy();
      return null;
    }

    disableRkBuiltinPagination(next);

    const setSlot = (obj: Record<string, unknown>, key: string, value: unknown): boolean => {
      try {
        obj[key] = value;
        return true;
      } catch {
        try {
          Object.defineProperty(obj, key, { value, writable: true, configurable: true, enumerable: true });
          return true;
        } catch (defineError) {
          console.error(`[rkPaginationBridge] cannot swap slot "${key}"`, defineError);
          return false;
        }
      }
    };

    const swappedEditor = setSlot(wrapper as Record<string, unknown>, 'editor', next);
    const swappedInstance = setSlot(wrapper as Record<string, unknown>, 'instance', next);

    const swappedServiceNames: string[] = [];
    const missedServiceNames: string[] = [];
    for (const serviceName of ['commands', 'exporter', 'importer', 'printer', '_styleManager']) {
      const service = (wrapper as Record<string, unknown>)[serviceName] as Record<string, unknown> | undefined;
      if (service && typeof service === 'object' && 'editor' in service) {
        if (setSlot(service, 'editor', next)) {
          swappedServiceNames.push(serviceName);
        } else {
          missedServiceNames.push(serviceName);
        }
      }
    }

    const commandsService = (wrapper as Record<string, unknown>)['commands'] as Record<string, unknown> | undefined;
    const commandsOk = Boolean(commandsService && commandsService.editor === next);
    if (!commandsOk) {
      console.error(
        '[rkPaginationBridge] commands service does NOT point to the new editor! ' +
        'Ribbon commands will operate on a destroyed editor (silent no-op).'
      );
    }

    if (!swappedEditor && !swappedInstance) {
      console.error('[rkPaginationBridge] neither "editor" nor "instance" slot is writable — откат невозможен, редактор уже пересоздан');
    } else {
      console.info('[rkPaginationBridge] attach: original destroyed, editor reference swapped', {
        swappedEditor,
        swappedInstance,
        swappedServices: swappedServiceNames.length,
        swappedServiceNames,
        missedServiceNames,
        commandsOk,
      });
    }
    wrapper.applyPageLayoutToDOM?.(host);

    return next;
  } catch (error) {
    console.error('[rkPaginationBridge] pagination injection failed', error);
    return null;
  }
}

/** Обновляет геометрию страниц (формат / ориентация / поля) */
export function updatePaginationLayout(editor: Editor | null | undefined, geometry: PaginationGeometry): void {
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
export function updatePaginationText(editor: Editor | null | undefined, text: PaginationTextOptions): void {
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
export function readPageCount(editor: Editor | null | undefined): number {
  try {
    const el = (editor?.options?.element as HTMLElement | undefined) ?? undefined;
    if (el) {
      const pages = el.querySelectorAll('.rm-page-break').length;
      if (pages > 0) return pages;
    }
  } catch {
    // ignore
  }
  return 1;
}