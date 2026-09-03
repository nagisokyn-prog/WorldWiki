import { ref, watch, onMounted, onBeforeUnmount, computed, type Ref } from 'vue';
import type { PageSize, Orientation, MarginsMm, WordLayoutDTO, WordSelectionDTO, WordStatsDTO } from '../types/dto';
import type { RibbonCommands } from '../ribbon/commands';
import type { ParagraphFormatData } from './modals/ParagraphFormatModal/ParagraphFormatModal.vue';
import { createWordVibeAdapter } from '../adapter/createWordVibeAdapter';
import { GOST_MARGINS_MM } from '../editor/geometryHelper';
import type { WordVibeEditorProps, WordVibeEditorEmits } from './WordVibeEditor.model';

export function useWordVibeEditor(
  editorHostRef: Ref<HTMLElement | null>,
  props: WordVibeEditorProps,
  emit: WordVibeEditorEmits,
) {
  // Состояние диалогов
  const isParagraphModalOpen = ref(false);
  const isPageSetupOpen = ref(false);
  const isHeaderFooterOpen = ref(false);
  const headerFooterTab = ref<'header' | 'footer'>('header');
  const isImageDialogOpen = ref(false);
  const isTablePickerOpen = ref(false);
  const isLinkDialogOpen = ref(false);
  const isEquationDialogOpen = ref(false);

  // Адаптер
  const adapter = createWordVibeAdapter();

  const currentLayout = ref<WordLayoutDTO>({
    pageSize: props.pageSize || 'A4',
    orientation: props.orientation || 'portrait',
    marginsMm: props.margins || { ...GOST_MARGINS_MM },
  });

  const currentStats = ref<WordStatsDTO>({
    pageCount: 1,
    wordCount: 0,
    characterCount: 0,
  });

  const selection = ref<WordSelectionDTO>({
    empty: true,
    isInsideTable: false,
    firstLineIndentCm: 1.25,
    leftIndentCm: 0,
    rightIndentCm: 17,
  });

  const dialogHeader = ref<{ left: string; center: string; right: string }>({
    left: props.chapterTitle || '',
    center: '',
    right: '',
  });
  const dialogFooter = ref<{ left: string; center: string; right: string }>({
    left: '',
    center: '',
    right: 'Стр. {page} из {total}',
  });

  const openHeaderFooterDialog = (tab?: 'header' | 'footer') => {
    headerFooterTab.value = tab || 'header';
    isHeaderFooterOpen.value = true;
  };

  // Формируем команды для Ribbon
  const ribbonCommands = computed<RibbonCommands>(() => ({
    toggleBold: () => adapter.execCommand('toggleBold'),
    toggleItalic: () => adapter.execCommand('toggleItalic'),
    toggleUnderline: () => adapter.execCommand('toggleUnderline'),
    toggleStrike: () => adapter.execCommand('toggleStrike'),
    toggleSubscript: () => adapter.execCommand('toggleSubscript'),
    toggleSuperscript: () => adapter.execCommand('toggleSuperscript'),
    toggleHighlight: (color?: string) => adapter.execCommand('toggleHighlight', color),
    setHeading: (level: number) => adapter.execCommand('setHeading', level),
    toggleBlockquote: () => adapter.execCommand('toggleBlockquote'),
    toggleBulletList: () => adapter.execCommand('toggleBulletList'),
    toggleOrderedList: () => adapter.execCommand('toggleOrderedList'),
    setTextAlign: (align: 'left' | 'center' | 'right' | 'justify') => adapter.execCommand('setTextAlign', align),
    setFontFamily: (font: string) => adapter.execCommand('setFontFamily', font),
    setFontSize: (size: string) => adapter.execCommand('setFontSize', size),
    setLineHeight: (height: string) => adapter.execCommand('setLineHeight', height),
    decreaseIndent: () => adapter.execCommand('decreaseIndent'),
    increaseIndent: () => adapter.execCommand('increaseIndent'),
    insertPageBreak: () => adapter.execCommand('insertPageBreak'),
    insertImage: () => adapter.execCommand('insertImage'),
    insertImageWithCaption: (src: string, caption?: string) => adapter.execCommand('insertImageWithCaption', src, caption),
    insertTable: () => adapter.execCommand('insertTable'),
    insertTableWithCaption: (rows: number, cols: number, title?: string) => adapter.execCommand('insertTableWithCaption', rows, cols, title),
    insertLink: () => adapter.execCommand('insertLink'),
    insertLinkUrl: (url: string) => adapter.execCommand('insertLinkUrl', url),
    insertFootnote: () => adapter.execCommand('insertFootnote'),
    insertEquation: () => adapter.execCommand('insertEquation'),
    insertEquationLatex: (latex: string) => adapter.execCommand('insertEquationLatex', latex),
    insertTableOfContents: () => adapter.execCommand('insertTableOfContents'),
    insertTextBox: () => adapter.execCommand('insertTextBox'),
    insertSectionBreak: () => adapter.execCommand('insertSectionBreak'),
    insertSectionLandscape: () => adapter.execCommand('insertSectionLandscape'),
    insertSectionPortrait: () => adapter.execCommand('insertSectionPortrait'),
    clearFormatting: () => adapter.execCommand('clearFormatting'),
    togglePageOrientation: () => adapter.execCommand('togglePageOrientation'),
    setPageSize: (size: string) => adapter.execCommand('setPageSize', size),
    setGostMargins: () => adapter.execCommand('setMarginPreset', 'gost'),
    setMarginPreset: (preset: string) => adapter.execCommand('setMarginPreset', preset),
    setCustomMargins: (top: number, bottom: number, left: number, right: number) => adapter.execCommand('setCustomMargins', top, bottom, left, right),
    setParagraphSpacing: (beforePt: number, afterPt: number) => adapter.execCommand('setParagraphSpacing', beforePt, afterPt),
    setLeftIndentCm: (cm: number) => adapter.execCommand('setLeftIndent', cm),
    setRightIndentCm: () => { /* no-op */ },
    updateHeaderText: (left: string, right: string) => {
      dialogHeader.value.left = left;
      dialogHeader.value.right = right;
      adapter.setHeaderFooter({ headerLeft: left, headerRight: right });
    },
    updateFooterText: (left: string, right: string) => {
      dialogFooter.value.left = left;
      dialogFooter.value.right = right;
      adapter.setHeaderFooter({ footerLeft: left, footerRight: right });
    },
    openHeaderFooterDialog: (tab?: 'header' | 'footer') => openHeaderFooterDialog(tab),
    openPageSetup: () => { isPageSetupOpen.value = true; },
    // Табличные
    addRowBefore: () => adapter.execCommand('addRowBefore'),
    addRowAfter: () => adapter.execCommand('addRowAfter'),
    addColumnBefore: () => adapter.execCommand('addColumnBefore'),
    addColumnAfter: () => adapter.execCommand('addColumnAfter'),
    deleteRow: () => adapter.execCommand('deleteRow'),
    deleteColumn: () => adapter.execCommand('deleteColumn'),
    deleteTable: () => adapter.execCommand('deleteTable'),
    mergeCells: () => adapter.execCommand('mergeCells'),
    splitCell: () => adapter.execCommand('splitCell'),
    setTableStyle: (style: string) => adapter.execCommand('setTableStyle', style),
  }));

  const handleScrollAreaClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      adapter.focus();
    }
  };

  const handleFirstLineIndent = (cm: number) => adapter.execCommand('setFirstLineIndent', cm);
  const handleLeftIndent = (cm: number) => adapter.execCommand('setLeftIndent', cm);
  const handleRightIndent = (_cm: number) => { /* no-op */ };

  const handleParagraphFormatApply = (data: ParagraphFormatData) => {
    adapter.execCommand('setTextAlign', data.alignment);
    adapter.execCommand('setLineHeight', data.lineHeight);
    if (data.firstLineType === 'indent') {
      adapter.execCommand('setFirstLineIndent', data.firstLineCm);
    } else {
      adapter.execCommand('setFirstLineIndent', 0);
    }
    if (data.leftIndentCm > 0) {
      adapter.execCommand('setLeftIndent', data.leftIndentCm);
    }
    adapter.execCommand('setParagraphSpacing', data.spaceBeforePt, data.spaceAfterPt);
    isParagraphModalOpen.value = false;
  };

  const handleHeaderFooterApply = (payload: {
    header: { left: string; center: string; right: string };
    footer: { left: string; center: string; right: string };
  }) => {
    adapter.setHeaderFooter({
      headerLeft: payload.header.left,
      headerCenter: payload.header.center,
      headerRight: payload.header.right,
      footerLeft: payload.footer.left,
      footerCenter: payload.footer.center,
      footerRight: payload.footer.right,
    });
    dialogHeader.value = { ...payload.header };
    dialogFooter.value = { ...payload.footer };
  };

  const handlePageSetupApply = (payload: { margins: MarginsMm; pageSize: PageSize; orientation: Orientation }) => {
    adapter.setLayout(payload);
  };

  const handleImageInsert = (payload: { src: string; caption: string; align: 'block' | 'left' | 'right' }) => {
    adapter.execCommand('insertImageWithCaption', payload.src, payload.caption);
  };

  const handleTableInsert = (payload: { rows: number; cols: number }) => {
    adapter.execCommand('insertTableWithCaption', payload.rows, payload.cols);
  };

  const handleLinkInsert = (payload: { url: string; text: string }) => {
    adapter.execCommand('insertLinkUrl', payload.url);
  };

  const handleEquationInsert = (payload: { latex: string }) => {
    adapter.execCommand('insertEquationLatex', payload.latex);
  };

  onMounted(() => {
    if (!editorHostRef.value) return;

    adapter.mount({
      host: editorHostRef.value,
      editable: !props.isReadOnly,
      initialContent: props.content,
      initialLayout: {
        pageSize: props.pageSize || 'A4',
        orientation: props.orientation || 'portrait',
        marginsMm: props.margins || { ...GOST_MARGINS_MM },
      },
      initialHeaderFooter: {
        headerLeft: props.chapterTitle || '',
        footerRight: 'Стр. {page} из {total}',
      },
      chapterTitle: props.chapterTitle,
    });

    adapter.on('change', (e) => {
      emit('update:content', e.html);
      emit('change');
    });

    adapter.on('selection-change', (dto) => {
      selection.value = dto;
    });

    adapter.on('stats-change', (stats) => {
      currentStats.value = stats;
    });

    adapter.on('layout-change', (layout) => {
      currentLayout.value = layout;
    });

    adapter.on('open-image-dialog', () => { isImageDialogOpen.value = true; });
    adapter.on('open-table-picker', () => { isTablePickerOpen.value = true; });
    adapter.on('open-link-dialog', () => { isLinkDialogOpen.value = true; });
    adapter.on('open-equation-dialog', () => { isEquationDialogOpen.value = true; });
    adapter.on('open-paragraph-dialog', () => { isParagraphModalOpen.value = true; });
    adapter.on('open-page-setup', () => { isPageSetupOpen.value = true; });
    adapter.on('open-header-footer-dialog', (p) => { openHeaderFooterDialog(p?.tab); });
    adapter.on('open-entity', (p) => { emit('open-entity', p); });
  });

  watch(() => props.content, (newVal) => {
    if (newVal !== undefined && adapter.getContent() !== newVal) {
      adapter.setContent(newVal);
    }
  });

  watch(() => props.chapterTitle, (newTitle) => {
    if (dialogHeader.value.left === props.chapterTitle || !dialogHeader.value.left) {
      dialogHeader.value.left = newTitle || '';
      adapter.setHeaderFooter({ headerLeft: newTitle || '' });
    }
  });

  onBeforeUnmount(() => {
    adapter.unmount();
  });

  return {
    adapter,
    currentLayout,
    currentStats,
    selection,
    dialogHeader,
    dialogFooter,
    isParagraphModalOpen,
    isPageSetupOpen,
    isHeaderFooterOpen,
    headerFooterTab,
    isImageDialogOpen,
    isTablePickerOpen,
    isLinkDialogOpen,
    isEquationDialogOpen,
    ribbonCommands,
    openHeaderFooterDialog,
    handleScrollAreaClick,
    handleFirstLineIndent,
    handleLeftIndent,
    handleRightIndent,
    handleParagraphFormatApply,
    handleHeaderFooterApply,
    handlePageSetupApply,
    handleImageInsert,
    handleTableInsert,
    handleLinkInsert,
    handleEquationInsert,
  };
}
