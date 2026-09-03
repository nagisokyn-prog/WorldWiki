/* eslint-disable @typescript-eslint/no-explicit-any */
import { WordEditor } from '@raazkhnl/rk-editor-core';
import type { WordHeaderFooterDTO, WordLayoutDTO, WordSelectionDTO, WordStatsDTO, PageSize } from '../types/dto';
import type { WordVibeAdapter, WordVibeOptions } from './WordVibeAdapter';
import type { WordVibeEventMap } from './events';
import { attachPaginationPlus, updatePaginationLayout, updatePaginationText, readPageCount, type PaginationTextOptions } from '../editor/rkPaginationBridge';
import { GOST_MARGINS_MM, type PaginationGeometry } from '../editor/geometryHelper';
import { normalizeWordContent, MARGIN_PRESETS_MM } from '../editor/useRkWordEditor';
import { insertGostFigureCaption } from '../editor/extensions/GostFigureCaption';
import { insertGostTableCaption } from '../editor/extensions/GostTableCaption';
import { insertSectionLandscape, insertSectionPortrait } from '../editor/extensions/SectionOrientation';

export function createWordVibeAdapter(): WordVibeAdapter {
  type Listener<T> = (payload: T) => void;
  const listeners: { [K in keyof WordVibeEventMap]?: Set<Listener<any>> } = {};

  function emit<K extends keyof WordVibeEventMap>(event: K, payload?: WordVibeEventMap[K]): void {
    const set = listeners[event];
    if (set) {
      for (const cb of Array.from(set)) {
        try {
          cb(payload as any);
        } catch (err) {
          console.error(`[WordVibeAdapter] Error in event listener for '${String(event)}':`, err);
        }
      }
    }
  }

  let wordEditor: WordEditor | null = null;
  let activeTiptapEditor: any = null;
  let ready = false;

  let currentLayout: WordLayoutDTO = {
    pageSize: 'A4',
    orientation: 'portrait',
    marginsMm: { ...GOST_MARGINS_MM },
  };

  let currentHeaderFooter: WordHeaderFooterDTO = {
    headerLeft: '',
    headerCenter: '',
    headerRight: '',
    footerLeft: '',
    footerCenter: '',
    footerRight: 'Стр. {page} из {total}',
  };

  let currentStats: WordStatsDTO = {
    pageCount: 1,
    wordCount: 0,
    characterCount: 0,
  };

  const PX_PER_CM = 37.82;
  const INDENT_STEP_PX = 40;

  const toRkPageSize = (size: PageSize) => {
    return (size === 'B5' ? 'Custom' : size) as 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | 'Custom';
  };

  const getPaginationGeometry = (): PaginationGeometry => ({
    pageSize: currentLayout.pageSize,
    orientation: currentLayout.orientation,
    marginsMm: { ...currentLayout.marginsMm },
  });

  const getHeaderFooterHtml = (): PaginationTextOptions => {
    const cell = (text: string, align: string) => `<td align='${align}'>${text}</td>`;
    const wrap = (left = '', center = '', right = '') =>
      `<table style='width:100%'><tr>${cell(left, 'left')}${cell(center, 'center')}${cell(right, 'right')}</tr></table>`;

    return {
      headerLeft: wrap(currentHeaderFooter.headerLeft, currentHeaderFooter.headerCenter, currentHeaderFooter.headerRight),
      footerLeft: wrap(currentHeaderFooter.footerLeft, currentHeaderFooter.footerCenter, currentHeaderFooter.footerRight),
    };
  };

  const buildSelectionDTO = (): WordSelectionDTO => {
    const ed = activeTiptapEditor || (wordEditor as any)?.instance;
    if (!ed || !ed.state) {
      return {
        empty: true,
        isInsideTable: false,
        firstLineIndentCm: 1.25,
        leftIndentCm: 0,
        rightIndentCm: 17,
      };
    }

    const { selection } = ed.state;
    const empty = selection ? selection.empty : true;
    const isInsideTable = Boolean(ed.isActive?.('table'));

    let firstLineIndentCm = 1.25;
    let leftIndentCm = 0;
    const rightIndentCm = 17;

    let alignment: 'left' | 'center' | 'right' | 'justify' | undefined;
    if (ed.isActive?.({ textAlign: 'center' })) alignment = 'center';
    else if (ed.isActive?.({ textAlign: 'right' })) alignment = 'right';
    else if (ed.isActive?.({ textAlign: 'justify' })) alignment = 'justify';
    else if (ed.isActive?.({ textAlign: 'left' })) alignment = 'left';

    try {
      const { $from } = selection;
      for (let d = $from.depth; d >= 0; d--) {
        const node = $from.node(d);
        if (node.type.name === 'paragraph') {
          const indentLevel = typeof node.attrs.indent === 'number' ? node.attrs.indent : 0;
          leftIndentCm = (indentLevel * INDENT_STEP_PX) / PX_PER_CM;

          const rawFirstLine = node.attrs.firstLineIndent;
          if (rawFirstLine && typeof rawFirstLine === 'string') {
            const parsed = parseFloat(rawFirstLine);
            if (!isNaN(parsed)) {
              if (rawFirstLine.endsWith('mm')) firstLineIndentCm = parsed / 10;
              else if (rawFirstLine.endsWith('pt')) firstLineIndentCm = parsed * 0.0352778;
              else firstLineIndentCm = parsed;
            }
          }
          break;
        }
      }
    } catch {
      // ignore
    }

    return {
      empty,
      isInsideTable,
      firstLineIndentCm,
      leftIndentCm,
      rightIndentCm,
      alignment,
      isBold: Boolean(ed.isActive?.('bold')),
      isItalic: Boolean(ed.isActive?.('italic')),
      isUnderline: Boolean(ed.isActive?.('underline')),
      isStrike: Boolean(ed.isActive?.('strike')),
      isSubscript: Boolean(ed.isActive?.('subscript')),
      isSuperscript: Boolean(ed.isActive?.('superscript')),
      isHighlight: Boolean(ed.isActive?.('highlight')),
      isBlockquote: Boolean(ed.isActive?.('blockquote')),
      isBulletList: Boolean(ed.isActive?.('bulletList')),
      isOrderedList: Boolean(ed.isActive?.('orderedList')),
      headingLevel: ed.isActive?.('heading', { level: 1 }) ? 1 : ed.isActive?.('heading', { level: 2 }) ? 2 : ed.isActive?.('heading', { level: 3 }) ? 3 : undefined,
    };
  };

  const adapter: WordVibeAdapter = {
    mount(options: WordVibeOptions): void {
      if (wordEditor) {
        this.unmount();
      }

      if (options.initialLayout) {
        currentLayout = {
          pageSize: options.initialLayout.pageSize || currentLayout.pageSize,
          orientation: options.initialLayout.orientation || currentLayout.orientation,
          marginsMm: options.initialLayout.marginsMm || currentLayout.marginsMm,
        };
      }

      if (options.initialHeaderFooter) {
        currentHeaderFooter = {
          ...currentHeaderFooter,
          ...options.initialHeaderFooter,
        };
      }

      const initialHtml = normalizeWordContent(options.initialContent || '') || '<p></p>';

      wordEditor = new WordEditor({
        element: options.host,
        initialContent: initialHtml,
        editable: options.editable !== false,
        pageLayout: {
          pageSize: toRkPageSize(currentLayout.pageSize),
          orientation: currentLayout.orientation,
          margins: {
            top: `${currentLayout.marginsMm.top}mm`,
            bottom: `${currentLayout.marginsMm.bottom}mm`,
            left: `${currentLayout.marginsMm.left}mm`,
            right: `${currentLayout.marginsMm.right}mm`,
          },
        },
        onUpdate: (_json, rawEditor) => {
          const html = rawEditor.getHTML();
          emit('change', { html });
        },
        onWordCount: (stats) => {
          currentStats = {
            pageCount: stats.pages || 1,
            wordCount: stats.words || 0,
            characterCount: stats.characters || 0,
          };
          emit('stats-change', { ...currentStats });
        },
        onSelectionChange: () => {
          emit('selection-change', buildSelectionDTO());
        },
        imageUploadHandler: options.imageUploadHandler || ((file: File) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })),
      });

      activeTiptapEditor = (wordEditor as any).instance;

      const paginated = attachPaginationPlus(wordEditor, {
        geometry: getPaginationGeometry(),
        text: getHeaderFooterHtml(),
        onUpdate: (updated) => {
          emit('change', { html: updated.getHTML() });
          currentStats.pageCount = readPageCount(updated);
          emit('stats-change', { ...currentStats });
        },
        onSelectionChange: () => {
          emit('selection-change', buildSelectionDTO());
        },
        onHeaderClick: () => emit('open-header-footer-dialog', { tab: 'header' }),
        onFooterClick: () => emit('open-header-footer-dialog', { tab: 'footer' }),
      });

      if (paginated) {
        activeTiptapEditor = paginated;
      }

      ready = true;
      emit('mounted');
      emit('ready');
      emit('layout-change', { ...currentLayout });
      emit('stats-change', { ...currentStats });
      emit('selection-change', buildSelectionDTO());
    },

    isReady(): boolean {
      return ready;
    },

    unmount(): void {
      if (wordEditor) {
        wordEditor.destroy();
        wordEditor = null;
        activeTiptapEditor = null;
        ready = false;
        emit('destroyed');
      }
    },

    setContent(content: string): void {
      if (!wordEditor) return;
      const normalized = normalizeWordContent(content) || '<p></p>';
      wordEditor.setDocument(normalized);
    },

    getContent(): string {
      if (activeTiptapEditor && typeof activeTiptapEditor.getHTML === 'function') {
        return activeTiptapEditor.getHTML();
      }
      return wordEditor?.getHTML() || '';
    },

    focus(): void {
      if (activeTiptapEditor?.commands?.focus) {
        activeTiptapEditor.commands.focus();
      } else {
        wordEditor?.focus();
      }
    },

    blur(): void {
      activeTiptapEditor?.commands?.blur?.();
    },

    getCommandNames(): readonly string[] {
      return [
        'toggleBold', 'toggleItalic', 'toggleUnderline', 'toggleStrike',
        'toggleSubscript', 'toggleSuperscript', 'toggleHighlight',
        'setHeading', 'toggleBlockquote', 'toggleBulletList', 'toggleOrderedList',
        'setTextAlign', 'setFontFamily', 'setFontSize', 'setLineHeight',
        'decreaseIndent', 'increaseIndent', 'setFirstLineIndent', 'setLeftIndent',
        'insertPageBreak', 'insertImage', 'insertImageWithCaption',
        'insertTable', 'insertTableWithCaption', 'insertLink', 'insertLinkUrl',
        'insertFootnote', 'insertEquation', 'insertEquationLatex',
        'insertTableOfContents', 'insertTextBox', 'insertSectionBreak',
        'insertSectionLandscape', 'insertSectionPortrait', 'clearFormatting',
        'togglePageOrientation', 'setPageSize', 'setMarginPreset', 'setCustomMargins',
        'setParagraphSpacing', 'setTableStyle', 'addRowBefore', 'addRowAfter',
        'addColumnBefore', 'addColumnAfter', 'deleteRow', 'deleteColumn', 'deleteTable',
        'mergeCells', 'splitCell',
      ];
    },

    execCommand(name: string, ...args: unknown[]): boolean {
      const ed = activeTiptapEditor || (wordEditor as any)?.instance;
      const commands = (wordEditor as any)?.commands || ed?.commands;

      if (!ed && !commands) return false;

      // Восстанавливаем фокус перед командой, если есть выделение
      try {
        if (ed && !ed.isFocused && !ed.state?.selection?.empty) {
          ed.commands?.focus?.();
        }
      } catch {
        // ignore
      }

      switch (name) {
        case 'toggleBold': commands?.bold?.(); return true;
        case 'toggleItalic': commands?.italic?.(); return true;
        case 'toggleUnderline': commands?.underline?.(); return true;
        case 'toggleStrike': commands?.strike?.(); return true;
        case 'toggleSubscript': commands?.subscript?.(); return true;
        case 'toggleSuperscript': commands?.superscript?.(); return true;
        case 'toggleHighlight': commands?.setHighlight?.(String(args[0] || '#ffff00')); return true;
        case 'setHeading': commands?.heading?.(Number(args[0]) as any); return true;
        case 'toggleBlockquote': commands?.blockquote?.(); return true;
        case 'toggleBulletList': commands?.bulletList?.(); return true;
        case 'toggleOrderedList': commands?.orderedList?.(); return true;
        case 'setTextAlign': commands?.align?.(args[0] as any); return true;
        case 'setFontFamily': commands?.fontFamily?.(String(args[0])); return true;
        case 'setFontSize': commands?.fontSize?.(String(args[0])); return true;
        case 'setLineHeight': commands?.lineHeight?.(String(args[0])); return true;
        case 'decreaseIndent': commands?.outdent?.(); return true;
        case 'increaseIndent': commands?.indent?.(); return true;
        case 'setFirstLineIndent': {
          const cm = Number(args[0]) || 0;
          const val = cm <= 0 ? '0' : `${cm.toFixed(3)}cm`;
          ed?.chain()?.focus()?.updateAttributes('paragraph', { firstLineIndent: val })?.run();
          emit('selection-change', buildSelectionDTO());
          return true;
        }
        case 'setLeftIndent': {
          const cm = Number(args[0]) || 0;
          const level = Math.max(0, Math.min(8, Math.round((cm * PX_PER_CM) / INDENT_STEP_PX)));
          ed?.chain()?.focus()?.updateAttributes('paragraph', { indent: level })?.run();
          emit('selection-change', buildSelectionDTO());
          return true;
        }
        case 'insertPageBreak': commands?.pageBreak?.(); return true;
        case 'insertImage': emit('open-image-dialog'); return true;
        case 'insertImageWithCaption': {
          const src = String(args[0]);
          const caption = args[1] ? String(args[1]) : undefined;
          commands?.insertImage?.(src);
          insertGostFigureCaption(ed, caption);
          return true;
        }
        case 'insertTable': emit('open-table-picker'); return true;
        case 'insertTableWithCaption': {
          const rows = Number(args[0]) || 2;
          const cols = Number(args[1]) || 2;
          const title = args[2] ? String(args[2]) : undefined;
          commands?.insertTable?.({ rows, cols, withHeaderRow: true });
          insertGostTableCaption(ed, title);
          return true;
        }
        case 'insertLink': emit('open-link-dialog'); return true;
        case 'insertLinkUrl': commands?.insertLink?.(String(args[0])); return true;
        case 'insertFootnote': commands?.footnote?.(); return true;
        case 'insertEquation': emit('open-equation-dialog'); return true;
        case 'insertEquationLatex': commands?.insertMathBlock?.(String(args[0])); return true;
        case 'insertTableOfContents': commands?.insertTableOfContents?.({ minLevel: 1, maxLevel: 3, title: 'Содержание', showPageNumbers: true }); return true;
        case 'insertTextBox': commands?.insertTextBox?.(); return true;
        case 'insertSectionBreak': commands?.sectionBreak?.(); return true;
        case 'insertSectionLandscape':
          insertSectionLandscape(ed, (o) => adapter.setLayout({ orientation: o }));
          return true;
        case 'insertSectionPortrait':
          insertSectionPortrait(ed, (o) => adapter.setLayout({ orientation: o }));
          return true;
        case 'clearFormatting': commands?.clearFormatting?.(); return true;
        case 'togglePageOrientation':
          adapter.setLayout({ orientation: currentLayout.orientation === 'portrait' ? 'landscape' : 'portrait' });
          return true;
        case 'setPageSize':
          adapter.setLayout({ pageSize: args[0] as PageSize });
          return true;
        case 'setMarginPreset': {
          const presetName = args[0] as keyof typeof MARGIN_PRESETS_MM;
          if (MARGIN_PRESETS_MM[presetName]) {
            adapter.setLayout({ marginsMm: { ...MARGIN_PRESETS_MM[presetName] } });
          }
          return true;
        }
        case 'setCustomMargins':
          adapter.setLayout({
            marginsMm: {
              top: Number(args[0]),
              bottom: Number(args[1]),
              left: Number(args[2]),
              right: Number(args[3]),
            },
          });
          return true;
        case 'setParagraphSpacing':
          commands?.spacing?.(`${args[0]}pt`, `${args[1]}pt`);
          return true;
        // Табличные команды
        case 'addRowBefore': ed?.chain()?.focus()?.addRowBefore?.()?.run(); return true;
        case 'addRowAfter': ed?.chain()?.focus()?.addRowAfter?.()?.run(); return true;
        case 'addColumnBefore': ed?.chain()?.focus()?.addColumnBefore?.()?.run(); return true;
        case 'addColumnAfter': ed?.chain()?.focus()?.addColumnAfter?.()?.run(); return true;
        case 'deleteRow': ed?.chain()?.focus()?.deleteRow?.()?.run(); return true;
        case 'deleteColumn': ed?.chain()?.focus()?.deleteColumn?.()?.run(); return true;
        case 'deleteTable': ed?.chain()?.focus()?.deleteTable?.()?.run(); return true;
        case 'mergeCells': ed?.chain()?.focus()?.mergeCells?.()?.run(); return true;
        case 'splitCell': ed?.chain()?.focus()?.splitCell?.()?.run(); return true;
        case 'setTableStyle':
          commands?.setTableStyle?.(String(args[0]));
          return true;
        default:
          console.warn(`[WordVibeAdapter] Unknown command: "${name}"`);
          return false;
      }
    },

    getSelection(): WordSelectionDTO | null {
      return buildSelectionDTO();
    },

    setLayout(layout: Partial<WordLayoutDTO>): void {
      currentLayout = {
        pageSize: layout.pageSize || currentLayout.pageSize,
        orientation: layout.orientation || currentLayout.orientation,
        marginsMm: layout.marginsMm || currentLayout.marginsMm,
      };

      if (wordEditor) {
        wordEditor.setPageLayout({
          pageSize: toRkPageSize(currentLayout.pageSize),
          orientation: currentLayout.orientation,
          margins: {
            top: `${currentLayout.marginsMm.top}mm`,
            bottom: `${currentLayout.marginsMm.bottom}mm`,
            left: `${currentLayout.marginsMm.left}mm`,
            right: `${currentLayout.marginsMm.right}mm`,
          },
        });
      }

      if (activeTiptapEditor) {
        updatePaginationLayout(activeTiptapEditor, getPaginationGeometry());
        currentStats.pageCount = readPageCount(activeTiptapEditor);
      }

      emit('layout-change', { ...currentLayout });
      emit('stats-change', { ...currentStats });
    },

    getLayout(): WordLayoutDTO {
      return { ...currentLayout };
    },

    setHeaderFooter(hf: WordHeaderFooterDTO): void {
      currentHeaderFooter = { ...currentHeaderFooter, ...hf };
      if (activeTiptapEditor) {
        updatePaginationText(activeTiptapEditor, getHeaderFooterHtml());
      }
    },

    getStats(): WordStatsDTO {
      return { ...currentStats };
    },

    async exportDocx(filename = 'Документ'): Promise<void> {
      if (wordEditor) {
        await wordEditor.exportDocx(`${filename}.docx`);
      }
    },

    printPdf(title = 'Документ WorldWiki'): void {
      if (wordEditor) {
        wordEditor.printPdf({ title });
      }
    },

    on<K extends keyof WordVibeEventMap>(event: K, cb: (payload: WordVibeEventMap[K]) => void): () => void {
      if (!listeners[event]) {
        listeners[event] = new Set();
      }
      listeners[event]!.add(cb);
      return () => {
        listeners[event]?.delete(cb);
      };
    },
  };

  return adapter;
}
