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
    extraExtensions?: any[];
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

    console.info('[rkPaginationBridge] attach: start', {
      hasInstance: Boolean(original),
      hasHost: Boolean(host),
      extensionCount: Array.isArray(extensions) ? extensions.length : 0,
    });

    if (!original || !host || !Array.isArray(extensions) || extensions.length === 0) {
      // Мок/неожиданная структура — работаем на встроенной пагинации
      console.warn('[rkPaginationBridge] attach: aborted — wrapper structure is not a live V2 editor');
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
      onUpdate: ({ editor: updated }: { editor: any }) => options.onUpdate(updated),
      onSelectionUpdate: ({ editor: updated }: { editor: any }) => options.onSelectionChange?.(updated),
    });

    console.info('[rkPaginationBridge] attach: V2Editor with PaginationPlus created');

    // Capability-check ДО уничтожения оригинала: PaginationPlus обязан
    // зарегистрировать свои команды в новом редакторе. Если нет — откат.
    if (typeof next.commands?.updatePageWidth !== 'function') {
      console.error(
        '[rkPaginationBridge] PaginationPlus commands are NOT registered in the new editor ' +
        '(вероятно, двойная копия @tiptap/prosemirror в pnpm). Откат без подмены редактора.'
      );
      next.destroy();
      return null; // оригинал жив, rk-пагинация продолжает работать
    }

    // Отключаем встроенную rk-пагинацию в новом редакторе
    disableRkBuiltinPagination(next);

    // Уничтожаем исходный редактор и подменяем его внутри обёртки,
    // чтобы команды / экспорт / печать WordEditor работали как раньше.
    // ВАЖНО: поля `editor`/`instance` в v4.6.0 могут быть getter-only —
    // обычное присваивание бросает TypeError, поэтому сначала пробуем его,
    // а затем объявляем собственное свойство, затеняющее геттер прототипа.
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
    // `instance` — getter-only (return this.editor): после подмены `editor`
    // геттер сам начнёт возвращать новый редактор, отдельная подмена не нужна.
    const swappedInstance = setSlot(wrapper as Record<string, unknown>, 'instance', next);

    // Внутренние сервисы обёртки (CommandManager, ExportEngine и др.) захватили
    // ссылку на исходный редактор в конструкторе — подменяем и у них,
    // иначе команды/экспорт будут вызывать уничтоженный редактор.
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

    // КРИТИЧНО: CommandManager обязан указывать на живой редактор, иначе все
    // кнопки ленты молча командуют уничтоженным экземпляром (result: false).
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