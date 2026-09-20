import { shallowRef, watch, onMounted, onBeforeUnmount, type Ref } from 'vue';
import { WordEditor } from '@raazkhnl/rk-editor-core';
import type {
  RkWordEditorProps, 
  RkWordEditorEmits, 
  EditorInstance 
} from './RkWordEditor.model';
import {
  attachPaginationPlus,
  updatePaginationText,
} from './rkPaginationBridge';
import {
  useWordLayoutState,
  toRkPageSize,
  MARGIN_PRESETS_MM,
  type MarginPresetName,
  type MarginsMm,
} from './useWordLayoutState';
import { useWordRibbonCommands } from './useWordRibbonCommands';

export { MARGIN_PRESETS_MM, type MarginPresetName, type MarginsMm };

/**
 * Нормализует HTML-контент под требования ГОСТ 7.32 перед загрузкой в RK Word Editor.
 * Убирает inline-стили межабзацного интервала и лишние отступы, накопившиеся в WYSIWYG-режиме.
 */
export function normalizeWordContent(html: string): string {
  if (!html || typeof document === 'undefined') return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const REMOVE_BLOCK_PROPS = [
    'marginTop', 'margin-top',
    'marginBottom', 'margin-bottom',
    'paddingTop', 'padding-top',
    'paddingBottom', 'padding-bottom',
    'lineHeight', 'line-height',
    'fontSize', 'font-size',
    'fontFamily', 'font-family',
  ];

  const blockSelector = 'p, h1, h2, h3, h4, h5, h6, blockquote, li';
  doc.querySelectorAll<HTMLElement>(blockSelector).forEach((el) => {
    REMOVE_BLOCK_PROPS.forEach((prop) => {
      el.style.removeProperty(prop);
    });
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

  const layout = useWordLayoutState({
    initialOrientation: props.initialOrientation,
    initialPageSize: props.initialPageSize,
    chapterTitle: props.chapterTitle,
    wordEditor,
    tiptapEditor,
  });

  const commandsHelper = useWordRibbonCommands({
    wordEditor,
    tiptapEditor,
    emit,
    setOrientation: layout.setOrientation,
    toggleOrientation: layout.toggleOrientation,
    setPageSize: layout.setPageSize,
    setMarginPreset: layout.setMarginPreset,
    setCustomMargins: layout.setCustomMargins,
  });

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

  const initEditor = () => {
    if (!editorHostRef.value || wordEditor.value) return;

    const editor = new WordEditor({
      element: editorHostRef.value,
      initialContent: normalizeWordContent(props.content || '') || '<p></p>',
      editable: props.editable !== false,
      pageLayout: {
        pageSize: toRkPageSize(layout.pageSize.value),
        orientation: layout.orientation.value,
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
        layout.wordCount.value = stats.words;
        layout.characterCount.value = stats.characters;
        layout.pageCount.value = stats.pages || 1;
      },
      onSelectionChange: (rawEditor?: EditorInstance) => {
        layout.isInsideTable.value = Boolean((rawEditor as unknown as { isActive?: (n: string) => boolean })?.isActive?.('table'));
      },
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

    const paginated = attachPaginationPlus(editor, {
      geometry: layout.paginationGeometry(),
      text: layout.paginationText(),
      onUpdate: (updated: { getHTML(): string }) => {
        emit('update:content', updated.getHTML());
        emit('change');
        layout.schedulePageCountSync();
      },
      onSelectionChange: (updated: { isActive?: (name: string) => boolean }) => {
        layout.isInsideTable.value = Boolean(updated?.isActive?.('table'));
      },
      onHeaderClick: () => emit('open-header-footer-dialog', 'header'),
      onFooterClick: () => emit('open-header-footer-dialog', 'footer'),
    });
    if (paginated) {
      tiptapEditor.value = paginated as unknown as EditorInstance;
    }
    layout.schedulePageCountSync();
  };

  watch(() => props.content, (newContent) => {
    if (!wordEditor.value || newContent === undefined) return;
    const normalized = normalizeWordContent(newContent) || '<p></p>';
    if (wordEditor.value.getHTML() !== normalized) {
      wordEditor.value.setDocument(normalized);
    }
  });

  watch(() => props.chapterTitle, (title) => {
    if (layout.headerLeft.value === props.chapterTitle || !layout.headerLeft.value) {
      layout.headerLeft.value = title || '';
    }
    updatePaginationText(tiptapEditor.value, { headerLeft: layout.headerLeft.value });
  });

  onMounted(initEditor);

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
    orientation: layout.orientation,
    pageSize: layout.pageSize,
    pageCount: layout.pageCount,
    wordCount: layout.wordCount,
    characterCount: layout.characterCount,
    zoom: layout.zoom,
    isLandscape: layout.isLandscape,
    isInsideTable: layout.isInsideTable,
    currentMarginsMm: layout.currentMarginsMm,
    headerLeft: layout.headerLeft,
    headerRight: layout.headerRight,
    footerLeft: layout.footerLeft,
    footerRight: layout.footerRight,
    pageWidthPx: layout.pageWidthPx,
    initEditor,
    setOrientation: layout.setOrientation,
    toggleOrientation: layout.toggleOrientation,
    setPageSize: layout.setPageSize,
    setMarginPreset: layout.setMarginPreset,
    setCustomMargins: layout.setCustomMargins,
    exportDocx,
    printPdf,
    ribbonCommands: commandsHelper.ribbonCommands,
  };
}
