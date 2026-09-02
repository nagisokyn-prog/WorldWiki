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

  const orientation = ref<Orientation>(props.initialOrientation || 'portrait');
  const pageSize = ref<PageSize>(props.initialPageSize || 'A4');
  const pageCount = ref(1);
  const wordCount = ref(0);
  const characterCount = ref(0);
  const zoom = ref(1);

  const isLandscape = computed(() => orientation.value === 'landscape');

  /** Текущая геометрия страницы для PaginationPlus */
  const paginationGeometry = (): PaginationGeometry => ({
    pageSize: pageSize.value,
    orientation: orientation.value,
    marginsMm: { ...GOST_MARGINS_MM },
  });

  /** Синхронизация счётчика страниц из DOM PaginationPlus (измерение асинхронное) */
  let pageCountSyncTimer: ReturnType<typeof setTimeout> | null = null;
  const schedulePageCountSync = () => {
    if (pageCountSyncTimer) clearTimeout(pageCountSyncTimer);
    pageCountSyncTimer = setTimeout(() => {
      pageCountSyncTimer = null;
      pageCount.value = readPageCount(tiptapEditor.value);
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

  const setOrientation = (newOrientation: Orientation) => {
    orientation.value = newOrientation;
    if (wordEditor.value) {
      wordEditor.value.setPageLayout({
        pageSize: toRkPageSize(pageSize.value),
        orientation: newOrientation,
        margins: {
          top: '20mm',
          bottom: '20mm',
          left: '30mm',
          right: '15mm',
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
          top: '20mm',
          bottom: '20mm',
          left: '30mm',
          right: '15mm',
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
      insertImage: () => {
        const url = prompt('Введите URL изображения:', 'https://picsum.photos/600/400');
        if (url) {
          cmd?.insertImage(url);
          cmd?.insertCaption('Рисунок');
        }
      },
      insertTable: () => {
        cmd?.insertTable({ rows: 3, cols: 4, withHeaderRow: true });
        cmd?.insertCaption('Таблица');
      },
      insertLink: () => {
        const url = prompt('Введите URL ссылки:', 'https://');
        if (url) cmd?.insertLink(url);
      },
      insertFootnote: () => cmd?.footnote(),
      insertEquation: () => {
        const latex = prompt('Введите формулу LaTeX:', 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx');
        if (latex) cmd?.insertMathBlock(latex);
      },
      clearFormatting: () => cmd?.clearFormatting(),
      togglePageOrientation: () => toggleOrientation(),
      setPageSize: (size: string) => setPageSize(size as PageSize),
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
      onSelectionChange: () => {
        // Уведомление для реактивных проверок выделения
      },
    });

    wordEditor.value = editor;
    tiptapEditor.value = editor.instance;

    // Подключаем настоящий постраничный layout (tiptap-pagination-plus):
    // листы с зазорами, поля страницы, колонтитулы как в Word
    const paginationText = (): PaginationTextOptions => ({
      headerLeft: props.chapterTitle || '',
      headerRight: '',
      footerLeft: '',
      footerRight: 'Стр. {page} из {total}',
    });
    const paginated = attachPaginationPlus(editor, {
      geometry: paginationGeometry(),
      text: paginationText(),
      onUpdate: (updated: { getHTML(): string }) => {
        emit('update:content', updated.getHTML());
        emit('change');
        schedulePageCountSync();
      },
      onSelectionChange: () => {
        // Уведомление для реактивных проверок выделения
      },
    });
    if (paginated) {
      tiptapEditor.value = paginated as unknown as EditorInstance;
    }
    // Первичный замер количества страниц (PaginationPlus считает асинхронно)
    schedulePageCountSync();
    setTimeout(schedulePageCountSync, 400);
  };

  watch(() => props.content, (newContent) => {
    if (!wordEditor.value || newContent === undefined) return;
    const normalized = normalizeWordContent(newContent) || '<p></p>';
    if (wordEditor.value.getHTML() !== normalized) {
      wordEditor.value.setDocument(normalized);
    }
  });

  // Колонтитулы: верхний — название главы
  watch(() => props.chapterTitle, (title) => {
    updatePaginationText(tiptapEditor.value, { headerLeft: title || '' });
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
    pageWidthPx,
    initEditor,
    setOrientation,
    toggleOrientation,
    setPageSize,
    exportDocx,
    printPdf,
    ribbonCommands,
  };
}
