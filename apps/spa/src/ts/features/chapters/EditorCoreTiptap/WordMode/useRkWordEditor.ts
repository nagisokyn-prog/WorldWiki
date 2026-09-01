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
      // Синхронизируем измеренное количество страниц
      setTimeout(() => {
        if (wordEditor.value) {
          pageCount.value = wordEditor.value.getPageCount() || 1;
        }
      }, 50);
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
      initialContent: props.content || '<p></p>',
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
  };

  watch(() => props.content, (newContent) => {
    if (!wordEditor.value || newContent === undefined) return;
    if (wordEditor.value.getHTML() !== newContent) {
      wordEditor.value.setDocument(newContent || '<p></p>');
    }
  });

  onMounted(initEditor);

  // Если хост-элемент уже передан при инициализации (например, в юнит-тестах)
  if (editorHostRef.value) {
    initEditor();
  }

  onBeforeUnmount(() => {
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
