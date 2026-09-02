import { ref, computed, watch, onMounted, onBeforeUnmount, shallowRef, type Ref } from 'vue';
import { WordEditor } from '@raazkhnl/rk-editor-core';
import type {
  RkWordEditorProps, 
  RkWordEditorEmits, 
  PageSize, 
  Orientation,
  EditorInstance 
} from './RkWordEditor.model';
import type { RibbonCommands } from '../WordRibbonBar/WordRibbonBar.vue';
import {
  attachPaginationPlus,
  updatePaginationLayout,
  updatePaginationText,
  readPageCount,
  type PaginationTextOptions,
} from './rkPaginationBridge';
import { GOST_MARGINS_MM, type PaginationGeometry } from './geometryHelper';
import { insertGostTableCaption } from './extensions/GostTableCaption';
import { insertGostFigureCaption } from './extensions/GostFigureCaption';
import { insertSectionLandscape, insertSectionPortrait } from './extensions/SectionOrientation';

/** Пресеты полей страницы (мм) */
export const MARGIN_PRESETS_MM = {
  gost: { top: 20, bottom: 20, left: 30, right: 15 },
  normal: { top: 20, bottom: 20, left: 20, right: 20 },
  narrow: { top: 12, bottom: 12, left: 12, right: 12 },
  wide: { top: 20, bottom: 20, left: 50, right: 50 },
} as const;

export type MarginPresetName = keyof typeof MARGIN_PRESETS_MM;

export interface MarginsMm {
  top: number;
  bottom: number;
  left: number;
  right: number;
}


/**
 * Нормализует HTML-контент под требования ГОСТ 7.32 перед загрузкой в RK Word Editor.
 * Убирает inline-стили межабзацного интервала и лишние отступы, накопившиеся в WYSIWYG-режиме.
 */
export function normalizeWordContent(html: string): string {
  if (!html || typeof document === 'undefined') return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Стили, которые нужно удалить с блочных элементов (ГОСТ: 0 до/после абзаца)
  const REMOVE_BLOCK_PROPS = [
    'marginTop', 'margin-top',
    'marginBottom', 'margin-bottom',
    'paddingTop', 'padding-top',
    'paddingBottom', 'padding-bottom',
    'lineHeight', 'line-height',  // будет задан через CSS (1.5)
    'fontSize', 'font-size',       // будет задан через CSS (14pt)
    'fontFamily', 'font-family',   // будет задан через CSS (Times New Roman)
    // text-indent НЕ стрипаем: `paragraphSystem` extension читает его как `firstLineIndent` attr
    // Это позволяет корректно загружать старый контент с красной строкой из WYSIWYG-режима
  ];

  const blockSelector = 'p, h1, h2, h3, h4, h5, h6, blockquote, li';
  doc.querySelectorAll<HTMLElement>(blockSelector).forEach((el) => {
    REMOVE_BLOCK_PROPS.forEach((prop) => {
      el.style.removeProperty(prop);
    });
    // Если после чистки style пустой — удаляем атрибут полностью
    if (el.getAttribute('style') === '' || el.getAttribute('style') === null) {
      el.removeAttribute('style');
    }
  });

  return doc.body.innerHTML;
}

export function useRkWordEditor(
  editorHostRef: Ref<HTMLElement | null>,
  props: RkWordEditorProps,
  emit: RkWordEditorEmits
) {
  const wordEditor = shallowRef<WordEditor | null>(null);
  const tiptapEditor = shallowRef<EditorInstance | null>(null);

  /** px на 1 см при 96 DPI (для пересчёта отступов абзаца) */
  const PX_PER_CM = 37.82;
  /** Шаг левого отступа rk-editor-core: margin-left = indent * 40px */
  const INDENT_STEP_PX = 40;

  const orientation = ref<Orientation>(props.initialOrientation || 'portrait');
  const pageSize = ref<PageSize>(props.initialPageSize || 'A4');
  const pageCount = ref(1);
  const wordCount = ref(0);
  const characterCount = ref(0);
  const zoom = ref(1);

  /** Текущие поля страницы (мм) — реактивные, синхронизируются с PaginationPlus */
  const currentMarginsMm = ref<MarginsMm>({ ...GOST_MARGINS_MM });

  /** Колонтитулы (текст; {page}/{total} подставляются PaginationPlus) */
  const headerLeft = ref(props.chapterTitle || '');
  const headerRight = ref('');
  const footerLeft = ref('');
  const footerRight = ref('Стр. {page} из {total}');

  /** Курсор находится внутри таблицы (для контекстной вкладки «Конструктор») */
  const isInsideTable = ref(false);

  const isLandscape = computed(() => orientation.value === 'landscape');

  /** Текущая геометрия страницы для PaginationPlus */
  const paginationGeometry = (): PaginationGeometry => ({
    pageSize: pageSize.value,
    orientation: orientation.value,
    marginsMm: { ...currentMarginsMm.value },
  });

  /** Синхронизация счётчика страниц через официальный API WordEditor */
  let pageCountSyncTimer: ReturnType<typeof setTimeout> | null = null;
  const schedulePageCountSync = () => {
    if (pageCountSyncTimer) clearTimeout(pageCountSyncTimer);
    pageCountSyncTimer = setTimeout(() => {
      pageCountSyncTimer = null;
      try {
        const official = wordEditor.value?.getPageCount?.();
        pageCount.value = typeof official === 'number' && official > 0 ? official : readPageCount(tiptapEditor.value);
      } catch {
        pageCount.value = readPageCount(tiptapEditor.value);
      }
    }, 120);
  };

  /** Синхронизирует геометрию страниц PaginationPlus с текущими настройками */
  const syncPaginationLayout = () => {
    if (tiptapEditor.value) {
      updatePaginationLayout(tiptapEditor.value, paginationGeometry());
      schedulePageCountSync();
    }
  };

  
  // Ширина страницы в пикселях при 96 DPI:
  const pageWidthPx = computed(() => {
    if (pageSize.value === 'A5') {
      return isLandscape.value ? 794 : 559;
    }
    if (pageSize.value === 'A3') {
      return isLandscape.value ? 1587 : 1123;
    }
    if (pageSize.value === 'B5') {
      return isLandscape.value ? 945 : 665;
    }
    if (pageSize.value === 'Letter') {
      return isLandscape.value ? 1056 : 816;
    }
    return isLandscape.value ? 1123 : 794;
  });

  const toRkPageSize = (size: PageSize) => {
    return (size === 'B5' ? 'Custom' : size) as 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | 'Custom';
  };

  /** Применяет поля страницы (мм) к движку и PaginationPlus */
  const applyMargins = (margins: MarginsMm) => {
    currentMarginsMm.value = { ...margins };
    if (wordEditor.value) {
      wordEditor.value.setPageLayout({
        pageSize: toRkPageSize(pageSize.value),
        orientation: orientation.value,
        margins: {
          top: `${margins.top}mm`,
          bottom: `${margins.bottom}mm`,
          left: `${margins.left}mm`,
          right: `${margins.right}mm`,
        },
      });
      syncPaginationLayout();
    }
  };

  /** Пресет полей: ГОСТ 7.32 / Нормальные / Узкие / Широкие */
  const setMarginPreset = (preset: MarginPresetName) => {
    applyMargins({ ...MARGIN_PRESETS_MM[preset] });
  };

  /** Произвольные поля (мм) — из диалога «Параметры страницы» */
  const setCustomMargins = (top: number, bottom: number, left: number, right: number) => {
    applyMargins({ top, bottom, left, right });
  };

  const setOrientation = (newOrientation: Orientation) => {
    orientation.value = newOrientation;
    if (wordEditor.value) {
      wordEditor.value.setPageLayout({
        pageSize: toRkPageSize(pageSize.value),
        orientation: newOrientation,
        margins: {
          top: `${currentMarginsMm.value.top}mm`,
          bottom: `${currentMarginsMm.value.bottom}mm`,
          left: `${currentMarginsMm.value.left}mm`,
          right: `${currentMarginsMm.value.right}mm`,
        },
      });
      // Синхронизируем геометрию и измеренное количество страниц
      syncPaginationLayout();
    }
  };

  const toggleOrientation = () => {
    setOrientation(orientation.value === 'portrait' ? 'landscape' : 'portrait');
  };

  const setPageSize = (newSize: PageSize) => {
    pageSize.value = newSize;
    if (wordEditor.value) {
      wordEditor.value.setPageLayout({
        pageSize: toRkPageSize(newSize),
        orientation: orientation.value,
        margins: {
          top: `${currentMarginsMm.value.top}mm`,
          bottom: `${currentMarginsMm.value.bottom}mm`,
          left: `${currentMarginsMm.value.left}mm`,
          right: `${currentMarginsMm.value.right}mm`,
        },
      });
      // B5 отправляется в rk как 'Custom', но PaginationPlus получает точную
      // пиксельную геометрию (PAGE_DIMS_PX), поэтому B5 работает корректно.
      syncPaginationLayout();
    }
  };

  const exportDocx = async (filename?: string) => {
    if (wordEditor.value) {
      const name = filename || props.chapterTitle || 'Документ';
      await wordEditor.value.exportDocx(`${name}.docx`);
    }
  };

  const printPdf = () => {
    if (wordEditor.value) {
      wordEditor.value.printPdf({
        title: props.chapterTitle || 'Документ WorldWiki',
      });
    }
  };

  // Команды для нашей кастомной ленты WordRibbonBar
  const ribbonCommands = computed<RibbonCommands>(() => {
    const cmd = wordEditor.value?.commands;
    return {
      toggleBold: () => cmd?.bold(),
      toggleItalic: () => cmd?.italic(),
      toggleUnderline: () => cmd?.underline(),
      toggleStrike: () => cmd?.strike(),
      toggleSubscript: () => cmd?.subscript(),
      toggleSuperscript: () => cmd?.superscript(),
      toggleHighlight: () => cmd?.setHighlight('#ffff00'),
      setHeading: (lvl: number) => cmd?.heading(lvl as 1 | 2 | 3 | 4 | 5 | 6),
      toggleBlockquote: () => cmd?.blockquote(),
      toggleBulletList: () => cmd?.bulletList(),
      toggleOrderedList: () => cmd?.orderedList(),
      setTextAlign: (align: 'left' | 'center' | 'right' | 'justify') => cmd?.align(align),
      setFontFamily: (font: string) => cmd?.fontFamily(font),
      setFontSize: (size: string) => cmd?.fontSize(size),
      setLineHeight: (height: string) => cmd?.lineHeight(height),
      decreaseIndent: () => cmd?.outdent(),
      increaseIndent: () => cmd?.indent(),
      insertPageBreak: () => cmd?.pageBreak(),
      /** Рисунок: открывает диалог загрузки (вместо prompt) */
      insertImage: () => emit('open-image-dialog'),
      /** Вставка изображения с ГОСТ-автоподписью (вызывается из диалога) */
      insertImageWithCaption: (src: string, caption?: string) => {
        cmd?.insertImage(src);
        insertGostFigureCaption(tiptapEditor.value, caption);
      },
      /** Таблица: открывает hover-grid пикер (вместо prompt) */
      insertTable: () => emit('open-table-picker'),
      /** Вставка таблицы с ГОСТ-автоподписью (вызывается из пикера) */
      insertTableWithCaption: (rows: number, cols: number, title?: string) => {
        cmd?.insertTable({ rows, cols, withHeaderRow: true });
        insertGostTableCaption(tiptapEditor.value, title);
      },
      /** Ссылка: открывает диалог (вместо prompt) */
      insertLink: () => emit('open-link-dialog'),
      insertLinkUrl: (url: string) => cmd?.insertLink(url),
      insertFootnote: () => cmd?.footnote(),
      /** Уравнение: открывает диалог (вместо prompt) */
      insertEquation: () => emit('open-equation-dialog'),
      insertEquationLatex: (latex: string) => cmd?.insertMathBlock(latex),
      /** Оглавление (TableOfContents extension из rk-editor-core) */
      insertTableOfContents: () => cmd?.insertTableOfContents({ minLevel: 1, maxLevel: 3, title: 'Содержание', showPageNumbers: true }),
      /** Текстовый блок (TextBox extension из rk-editor-core) */
      insertTextBox: () => cmd?.insertTextBox(),
      /** Разрыв раздела (Section extension из rk-editor-core) */
      insertSectionBreak: () => cmd?.sectionBreak?.(),
      /** Разрыв раздела → альбомный лист (ключевая ГОСТ-фича) */
      insertSectionLandscape: () => {
        insertSectionLandscape(tiptapEditor.value, (o) => setOrientation(o));
      },
      /** Разрыв раздела → книжный лист */
      insertSectionPortrait: () => {
        insertSectionPortrait(tiptapEditor.value, (o) => setOrientation(o));
      },
      clearFormatting: () => cmd?.clearFormatting(),
      togglePageOrientation: () => toggleOrientation(),
      setPageSize: (size: string) => setPageSize(size as PageSize),
      // ── Макет: поля ──
      setGostMargins: () => setMarginPreset('gost'),
      setMarginPreset: (preset: string) => setMarginPreset(preset as MarginPresetName),
      setCustomMargins: (top: number, bottom: number, left: number, right: number) =>
        setCustomMargins(top, bottom, left, right),
      // ── Макет: абзац ──
      setParagraphSpacing: (beforePt: number, afterPt: number) =>
        cmd?.spacing(`${beforePt}pt`, `${afterPt}pt`),
      setLeftIndentCm: (cm: number) => {
        const level = Math.max(0, Math.min(8, Math.round((cm * PX_PER_CM) / INDENT_STEP_PX)));
        tiptapEditor.value?.chain().focus().updateAttributes('paragraph', { indent: level }).run();
      },
      setRightIndentCm: (_cm: number) => {
        // Схема rk-editor-core не поддерживает правый отступ абзаца — no-op
      },
      // ── Колонтитулы ──
      updateHeaderText: (left: string, right: string) => {
        headerLeft.value = left;
        headerRight.value = right;
        updatePaginationText(tiptapEditor.value, { headerLeft: left, headerRight: right });
      },
      updateFooterText: (left: string, right: string) => {
        footerLeft.value = left;
        footerRight.value = right;
        updatePaginationText(tiptapEditor.value, { footerLeft: left, footerRight: right });
      },
      openHeaderFooterDialog: (tab?: 'header' | 'footer') => emit('open-header-footer-dialog', tab),
      openPageSetup: () => emit('open-page-setup'),
    };
  });

  const initEditor = () => {
    if (!editorHostRef.value || wordEditor.value) return;

    // Инициализация полнофункционального ядра RK Word Editor
    const editor = new WordEditor({
      element: editorHostRef.value,
      initialContent: normalizeWordContent(props.content) || '<p></p>',
      editable: props.isReadOnly !== true,
      pageLayout: {
        pageSize: toRkPageSize(pageSize.value),
        orientation: orientation.value,
        margins: {
          top: '20mm',
          bottom: '20mm',
          left: '30mm',
          right: '15mm',
        },
      },
      onUpdate: (_json, rawEditor) => {
        const html = rawEditor.getHTML();
        emit('update:content', html);
        emit('change');
      },
      onWordCount: (stats) => {
        wordCount.value = stats.words;
        characterCount.value = stats.characters;
        pageCount.value = stats.pages || 1;
      },
      onSelectionChange: (rawEditor?: EditorInstance) => {
        // Реактивная проверка: курсор внутри таблицы → контекстная вкладка «Конструктор»
        isInsideTable.value = Boolean((rawEditor as unknown as { isActive?: (n: string) => boolean })?.isActive?.('table'));
      },
      /** Загрузка изображений: File → base64 data URL (offline/Tauri-совместимо) */
      imageUploadHandler: (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
    });

    wordEditor.value = editor;
    tiptapEditor.value = editor.instance;

    // Подключаем настоящий постраничный layout (tiptap-pagination-plus):
    // листы с зазорами, поля страницы, колонтитулы как в Word
    const paginationText = (): PaginationTextOptions => ({
      headerLeft: headerLeft.value,
      headerRight: headerRight.value,
      footerLeft: footerLeft.value,
      footerRight: footerRight.value,
    });
    const paginated = attachPaginationPlus(editor, {
      geometry: paginationGeometry(),
      text: paginationText(),
      onUpdate: (updated: { getHTML(): string }) => {
        emit('update:content', updated.getHTML());
        emit('change');
        schedulePageCountSync();
      },
      onSelectionChange: (updated: { isActive?: (name: string) => boolean }) => {
        isInsideTable.value = Boolean(updated?.isActive?.('table'));
      },
      onHeaderClick: () => emit('open-header-footer-dialog', 'header'),
      onFooterClick: () => emit('open-header-footer-dialog', 'footer'),
    });
    if (paginated) {
      tiptapEditor.value = paginated as unknown as EditorInstance;
    }
    // Первичный замер количества страниц (PaginationPlus считает асинхронно)
    schedulePageCountSync();
  };

  watch(() => props.content, (newContent) => {
    if (!wordEditor.value || newContent === undefined) return;
    const normalized = normalizeWordContent(newContent) || '<p></p>';
    if (wordEditor.value.getHTML() !== normalized) {
      wordEditor.value.setDocument(normalized);
    }
  });

  // Колонтитулы: верхний — название главы (если пользователь его не менял вручную)
  watch(() => props.chapterTitle, (title) => {
    if (headerLeft.value === props.chapterTitle || !headerLeft.value) {
      headerLeft.value = title || '';
    }
    updatePaginationText(tiptapEditor.value, { headerLeft: headerLeft.value });
  });

  onMounted(initEditor);

  // Если хост-элемент уже передан при инициализации (например, в юнит-тестах)
  if (editorHostRef.value) {
    initEditor();
  }

  onBeforeUnmount(() => {
    if (pageCountSyncTimer) clearTimeout(pageCountSyncTimer);
    if (wordEditor.value) {
      wordEditor.value.destroy();
      wordEditor.value = null;
      tiptapEditor.value = null;
    }
  });

  return {
    wordEditor,
    tiptapEditor,
    orientation,
    pageSize,
    pageCount,
    wordCount,
    characterCount,
    zoom,
    isLandscape,
    isInsideTable,
    currentMarginsMm,
    headerLeft,
    headerRight,
    footerLeft,
    footerRight,
    pageWidthPx,
    initEditor,
    setOrientation,
    toggleOrientation,
    setPageSize,
    setMarginPreset,
    setCustomMargins,
    exportDocx,
    printPdf,
    ribbonCommands,
  };
}
