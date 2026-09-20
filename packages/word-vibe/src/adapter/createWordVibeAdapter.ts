import { WordEditor } from '@raazkhnl/rk-editor-core';
import type { Editor } from '@tiptap/core';
import type {
  WordDocumentDTO,
  WordHeaderFooterDTO,
  WordLayoutDTO,
  WordSelectionDTO,
  WordStatsDTO,
  PageSize,
} from '../types/dto';
import type { WordVibeAdapter, WordVibeOptions } from './WordVibeAdapter';
import type { WordVibeEventMap } from './events';
import {
  attachPaginationPlus,
  updatePaginationLayout,
  updatePaginationText,
  readPageCount,
  syncDocumentPageCount,
  type PaginationTextOptions,
} from '../editor/rkPaginationBridge';
import { GOST_MARGINS_MM, type PaginationGeometry } from '../editor/geometryHelper';
import { normalizeWordContent } from '../editor/useRkWordEditor';
import { SceneBreakExtension } from '../editor/extensions/SceneBreakExtension';
import { EntityReferenceExtension } from '../editor/extensions/EntityReferenceExtension';
import { CrossReferenceExtension } from '../editor/extensions/CrossReferenceExtension';
import { UnsupportedBlockExtension } from '../editor/extensions/UnsupportedBlockExtension';
import { semanticASTToV2Doc, type V2NodeJson } from '../converter/ASTToV2Converter';
import { v2DocToSemanticAST } from '../converter/V2ToASTConverter';
import { buildSelectionDTO, type WordEditorHost } from './createWordVibeSelection';
import { executeWordVibeCommand } from './createWordVibeCommands';

export function createWordVibeAdapter(): WordVibeAdapter {
  type AnyListener = (payload?: unknown) => void;
  const listeners: { [K in keyof WordVibeEventMap]?: Set<AnyListener> } = {};

  function emit<K extends keyof WordVibeEventMap>(
    event: K,
    ...args: WordVibeEventMap[K] extends void ? [] : [WordVibeEventMap[K]]
  ): void {
    const set = listeners[event];
    if (set) {
      for (const cb of Array.from(set)) {
        try {
          cb(args[0]);
        } catch (err) {
          console.error(`[WordVibeAdapter] Error in event listener for '${String(event)}':`, err);
        }
      }
    }
  }

  let wordEditor: WordEditor | null = null;
  let activeTiptapEditor: Editor | null = null;
  let pageObserver: MutationObserver | null = null;
  let ready = false;
  let currentDocumentMeta: WordDocumentDTO['metadata'] | undefined;
  let currentProfileId: string | undefined = 'gost';
  let currentDocId: string | undefined;

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

  const toRkPageSize = (size: PageSize) => {
    return (size === 'B5' ? 'Custom' : size) as 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | 'Custom';
  };

  const getPaginationGeometry = (): PaginationGeometry => ({
    pageSize: currentLayout.pageSize,
    orientation: currentLayout.orientation,
    marginsMm: { ...currentLayout.marginsMm },
  });

  const getHeaderFooterHtml = (): PaginationTextOptions => {
    const total = String(currentStats.pageCount || 1);
    const replaceTotal = (s?: string) => (s ? s.replace(/\{total\}/gi, total) : '');

    const cell = (text: string, align: string) => `<td align='${align}'>${replaceTotal(text)}</td>`;
    const wrap = (left = '', center = '', right = '') =>
      `<table style='width:100%'><tr>${cell(left, 'left')}${cell(center, 'center')}${cell(right, 'right')}</tr></table>`;

    return {
      headerLeft: wrap(currentHeaderFooter.headerLeft, currentHeaderFooter.headerCenter, currentHeaderFooter.headerRight),
      footerLeft: wrap(currentHeaderFooter.footerLeft, currentHeaderFooter.footerCenter, currentHeaderFooter.footerRight),
    };
  };

  const buildCurrentDocumentAST = (): WordDocumentDTO => {
    const ed = activeTiptapEditor || ((wordEditor as unknown as WordEditorHost)?.instance);
    const json: V2NodeJson = ed?.getJSON ? (ed.getJSON() as V2NodeJson) : { type: 'doc', content: [] };
    return v2DocToSemanticAST(json, currentDocumentMeta, currentProfileId, currentDocId);
  };

  const getSelectionDTO = (): WordSelectionDTO => {
    return buildSelectionDTO(activeTiptapEditor, wordEditor);
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

      let initialDocOrHtml: string | Record<string, unknown> = '<p></p>';
      if (options.initialDocument) {
        currentDocumentMeta = options.initialDocument.metadata;
        currentProfileId = options.initialDocument.profileId;
        currentDocId = options.initialDocument.id;
        initialDocOrHtml = semanticASTToV2Doc(options.initialDocument);
      } else if (options.initialContent) {
        initialDocOrHtml = normalizeWordContent(options.initialContent) || '<p></p>';
      }

      wordEditor = new WordEditor({
        element: options.host,
        initialContent: initialDocOrHtml as string,
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
          const document = buildCurrentDocumentAST();
          emit('change', { html, document });
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
          emit('selection-change', getSelectionDTO());
        },
        imageUploadHandler: options.imageUploadHandler || ((file: File) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })),
      });

      activeTiptapEditor = (wordEditor as unknown as WordEditorHost).instance ?? null;

      const paginated = attachPaginationPlus(wordEditor, {
        geometry: getPaginationGeometry(),
        text: getHeaderFooterHtml(),
        extraExtensions: [
          SceneBreakExtension,
          EntityReferenceExtension,
          CrossReferenceExtension,
          UnsupportedBlockExtension,
        ],
        onUpdate: (updated) => {
          const html = updated.getHTML();
          const document = buildCurrentDocumentAST();
          emit('change', { html, document });
          const newPages = readPageCount(updated);
          if (newPages !== currentStats.pageCount) {
            currentStats.pageCount = newPages;
            updatePaginationText(updated, getHeaderFooterHtml());
          }
          emit('stats-change', { ...currentStats });
        },
        onSelectionChange: () => {
          emit('selection-change', getSelectionDTO());
        },
        onHeaderClick: () => emit('open-header-footer-dialog', { tab: 'header' }),
        onFooterClick: () => emit('open-header-footer-dialog', { tab: 'footer' }),
      });

      if (paginated) {
        activeTiptapEditor = paginated;
      }

      let syncScheduled = false;
      const syncNow = () => {
        syncScheduled = false;
        const total = syncDocumentPageCount(activeTiptapEditor);
        if (total !== currentStats.pageCount) {
          currentStats.pageCount = total;
          emit('stats-change', { ...currentStats });
        }
      };

      if (typeof MutationObserver !== 'undefined' && options.host) {
        pageObserver = new MutationObserver(() => {
          if (!syncScheduled) {
            syncScheduled = true;
            requestAnimationFrame(syncNow);
          }
        });
        pageObserver.observe(options.host, { childList: true, subtree: true });
      }

      setTimeout(syncNow, 50);
      setTimeout(syncNow, 200);
      setTimeout(syncNow, 500);
      setTimeout(syncNow, 1200);

      ready = true;
      emit('mounted');
      emit('ready');
      emit('layout-change', { ...currentLayout });
      emit('stats-change', { ...currentStats });
      emit('selection-change', getSelectionDTO());
    },

    isReady(): boolean {
      return ready;
    },

    unmount(): void {
      if (pageObserver) {
        pageObserver.disconnect();
        pageObserver = null;
      }
      if (wordEditor) {
        wordEditor.destroy();
        wordEditor = null;
        activeTiptapEditor = null;
        ready = false;
        emit('destroyed');
      }
    },

    loadDocument(doc: WordDocumentDTO): void {
      if (!wordEditor) return;
      currentDocumentMeta = doc.metadata;
      currentProfileId = doc.profileId;
      currentDocId = doc.id;

      const v2Doc = semanticASTToV2Doc(doc);
      if (activeTiptapEditor?.commands?.setContent) {
        activeTiptapEditor.commands.setContent(v2Doc);
      } else if (typeof (wordEditor as unknown as WordEditorHost).setDocument === 'function') {
        (wordEditor as unknown as WordEditorHost).setDocument?.(v2Doc);
      }
    },

    getDocument(): WordDocumentDTO {
      return buildCurrentDocumentAST();
    },

    setContent(content: string): void {
      if (!wordEditor) return;
      const normalized = normalizeWordContent(content) || '<p></p>';
      if (activeTiptapEditor?.commands?.setContent) {
        activeTiptapEditor.commands.setContent(normalized);
      } else if (typeof wordEditor.setDocument === 'function') {
        wordEditor.setDocument(normalized);
      }
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
        'insertPageBreak', 'insertImage', 'insertTable', 'insertLink',
        'insertFootnote', 'insertEquation', 'insertTableOfContents', 'insertTextBox',
        'insertSectionBreak', 'clearFormatting', 'setParagraphSpacing',
        'addRowBefore', 'addRowAfter', 'addColumnBefore', 'addColumnAfter',
        'deleteRow', 'deleteColumn', 'deleteTable',
        'mergeCells', 'splitCell', 'insertSceneBreak', 'insertEntityReference', 'insertCrossReference',
      ];
    },

    execCommand(name: string, ...args: unknown[]): boolean {
      return executeWordVibeCommand(name, args, {
        activeTiptapEditor,
        wordEditor,
        currentLayout,
        setLayout: (layout) => this.setLayout(layout),
        emit,
        buildSelectionDTO: getSelectionDTO,
      });
    },

    getSelection(): WordSelectionDTO | null {
      return getSelectionDTO();
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
      const handler = cb as AnyListener;
      listeners[event]!.add(handler);
      return () => {
        listeners[event]?.delete(handler);
      };
    },
  };

  return adapter;
}
