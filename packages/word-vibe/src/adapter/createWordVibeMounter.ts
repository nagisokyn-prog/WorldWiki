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
import type { WordVibeOptions } from './WordVibeAdapter';
import type { WordVibeEventMap } from './events';
import {
  attachPaginationPlus,
  updatePaginationText,
  readPageCount,
  syncDocumentPageCount,
  type PaginationTextOptions,
} from '../editor/rkPaginationBridge';
import type { PaginationGeometry } from '../editor/geometryHelper';
import { normalizeWordContent } from '../editor/useRkWordEditor';
import { SceneBreakExtension } from '../editor/extensions/SceneBreakExtension';
import { EntityReferenceExtension } from '../editor/extensions/EntityReferenceExtension';
import { CrossReferenceExtension } from '../editor/extensions/CrossReferenceExtension';
import { UnsupportedBlockExtension } from '../editor/extensions/UnsupportedBlockExtension';
import { semanticASTToV2Doc } from '../converter/ASTToV2Converter';
import type { WordEditorHost } from './createWordVibeSelection';

export interface MounterContext {
  wordEditor: WordEditor | null;
  activeTiptapEditor: Editor | null;
  pageObserver: MutationObserver | null;
  ready: boolean;
  currentDocumentMeta: WordDocumentDTO['metadata'] | undefined;
  currentProfileId: string | undefined;
  currentDocId: string | undefined;
  currentLayout: WordLayoutDTO;
  currentHeaderFooter: WordHeaderFooterDTO;
  currentStats: WordStatsDTO;
  toRkPageSize: (size: PageSize) => 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | 'Custom';
  getPaginationGeometry: () => PaginationGeometry;
  getHeaderFooterHtml: () => PaginationTextOptions;
  buildCurrentDocumentAST: () => WordDocumentDTO;
  getSelectionDTO: () => WordSelectionDTO;
  emit: <K extends keyof WordVibeEventMap>(
    event: K,
    ...args: WordVibeEventMap[K] extends void ? [] : [WordVibeEventMap[K]]
  ) => void;
}

export function mountWordVibeEditor(
  options: WordVibeOptions,
  ctx: MounterContext,
  unmount: () => void
): {
  wordEditor: WordEditor;
  activeTiptapEditor: Editor | null;
  pageObserver: MutationObserver | null;
} {
  if (ctx.wordEditor) {
    unmount();
  }

  if (options.initialLayout) {
    ctx.currentLayout = {
      pageSize: options.initialLayout.pageSize || ctx.currentLayout.pageSize,
      orientation: options.initialLayout.orientation || ctx.currentLayout.orientation,
      marginsMm: options.initialLayout.marginsMm || ctx.currentLayout.marginsMm,
    };
  }

  if (options.initialHeaderFooter) {
    ctx.currentHeaderFooter = {
      ...ctx.currentHeaderFooter,
      ...options.initialHeaderFooter,
    };
  }

  let initialDocOrHtml: string | Record<string, unknown> = '<p></p>';
  if (options.initialDocument) {
    ctx.currentDocumentMeta = options.initialDocument.metadata;
    ctx.currentProfileId = options.initialDocument.profileId;
    ctx.currentDocId = options.initialDocument.id;
    initialDocOrHtml = semanticASTToV2Doc(options.initialDocument);
  } else if (options.initialContent) {
    initialDocOrHtml = normalizeWordContent(options.initialContent) || '<p></p>';
  }

  const editorInstance = new WordEditor({
    element: options.host,
    initialContent: initialDocOrHtml as string,
    editable: options.editable !== false,
    pageLayout: {
      pageSize: ctx.toRkPageSize(ctx.currentLayout.pageSize),
      orientation: ctx.currentLayout.orientation,
      margins: {
        top: `${ctx.currentLayout.marginsMm.top}mm`,
        bottom: `${ctx.currentLayout.marginsMm.bottom}mm`,
        left: `${ctx.currentLayout.marginsMm.left}mm`,
        right: `${ctx.currentLayout.marginsMm.right}mm`,
      },
    },
    onUpdate: (_json, rawEditor) => {
      const html = rawEditor.getHTML();
      const document = ctx.buildCurrentDocumentAST();
      ctx.emit('change', { html, document });
    },
    onWordCount: (stats) => {
      ctx.currentStats = {
        pageCount: stats.pages || 1,
        wordCount: stats.words || 0,
        characterCount: stats.characters || 0,
      };
      ctx.emit('stats-change', { ...ctx.currentStats });
    },
    onSelectionChange: () => {
      ctx.emit('selection-change', ctx.getSelectionDTO());
    },
    imageUploadHandler: options.imageUploadHandler || ((file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      })),
  });

  let activeTiptap: Editor | null = (editorInstance as unknown as WordEditorHost).instance ?? null;

  const paginated = attachPaginationPlus(editorInstance, {
    geometry: ctx.getPaginationGeometry(),
    text: ctx.getHeaderFooterHtml(),
    extraExtensions: [
      SceneBreakExtension,
      EntityReferenceExtension,
      CrossReferenceExtension,
      UnsupportedBlockExtension,
    ],
    onUpdate: (updated) => {
      const html = updated.getHTML();
      const document = ctx.buildCurrentDocumentAST();
      ctx.emit('change', { html, document });
      const newPages = readPageCount(updated);
      if (newPages !== ctx.currentStats.pageCount) {
        ctx.currentStats.pageCount = newPages;
        updatePaginationText(updated, ctx.getHeaderFooterHtml());
      }
      ctx.emit('stats-change', { ...ctx.currentStats });
    },
    onSelectionChange: () => {
      ctx.emit('selection-change', ctx.getSelectionDTO());
    },
    onHeaderClick: () => ctx.emit('open-header-footer-dialog', { tab: 'header' }),
    onFooterClick: () => ctx.emit('open-header-footer-dialog', { tab: 'footer' }),
  });

  if (paginated) {
    activeTiptap = paginated;
  }

  let observer: MutationObserver | null = null;
  let syncScheduled = false;
  const syncNow = () => {
    syncScheduled = false;
    const total = syncDocumentPageCount(activeTiptap);
    if (total !== ctx.currentStats.pageCount) {
      ctx.currentStats.pageCount = total;
      ctx.emit('stats-change', { ...ctx.currentStats });
    }
  };

  if (typeof MutationObserver !== 'undefined' && options.host) {
    observer = new MutationObserver(() => {
      if (!syncScheduled) {
        syncScheduled = true;
        requestAnimationFrame(syncNow);
      }
    });
    observer.observe(options.host, { childList: true, subtree: true });
  }

  setTimeout(syncNow, 50);
  setTimeout(syncNow, 200);
  setTimeout(syncNow, 500);
  setTimeout(syncNow, 1200);

  ctx.ready = true;
  ctx.emit('mounted');
  ctx.emit('ready');
  ctx.emit('layout-change', { ...ctx.currentLayout });
  ctx.emit('stats-change', { ...ctx.currentStats });
  ctx.emit('selection-change', ctx.getSelectionDTO());

  return {
    wordEditor: editorInstance,
    activeTiptapEditor: activeTiptap,
    pageObserver: observer,
  };
}
