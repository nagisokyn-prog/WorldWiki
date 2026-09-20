import { ref, computed, type ShallowRef } from 'vue';
import type { WordEditor } from '@raazkhnl/rk-editor-core';
import type { PageSize, Orientation, EditorInstance } from './RkWordEditor.model';
import { GOST_MARGINS_MM, type PaginationGeometry } from './geometryHelper';
import { updatePaginationLayout, updatePaginationText, readPageCount, type PaginationTextOptions } from './rkPaginationBridge';

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

export function toRkPageSize(size: PageSize) {
  return (size === 'B5' ? 'Custom' : size) as 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | 'Custom';
}

export interface UseWordLayoutStateOptions {
  initialOrientation?: Orientation;
  initialPageSize?: PageSize;
  chapterTitle?: string;
  wordEditor: ShallowRef<WordEditor | null>;
  tiptapEditor: ShallowRef<EditorInstance | null>;
}

export function useWordLayoutState(options: UseWordLayoutStateOptions) {
  const orientation = ref<Orientation>(options.initialOrientation || 'portrait');
  const pageSize = ref<PageSize>(options.initialPageSize || 'A4');
  const pageCount = ref(1);
  const wordCount = ref(0);
  const characterCount = ref(0);
  const zoom = ref(1);
  const currentMarginsMm = ref<MarginsMm>({ ...GOST_MARGINS_MM });

  const headerLeft = ref(options.chapterTitle || '');
  const headerRight = ref('');
  const footerLeft = ref('');
  const footerRight = ref('Стр. {page} из {total}');
  const isInsideTable = ref(false);

  const isLandscape = computed(() => orientation.value === 'landscape');

  const paginationGeometry = (): PaginationGeometry => ({
    pageSize: pageSize.value,
    orientation: orientation.value,
    marginsMm: { ...currentMarginsMm.value },
  });

  const paginationText = (): PaginationTextOptions => {
    const total = String(pageCount.value || 1);
    const replaceTotal = (s?: string) => (s ? s.replace(/\{total\}/gi, total) : '');
    return {
      headerLeft: replaceTotal(headerLeft.value),
      headerRight: replaceTotal(headerRight.value),
      footerLeft: replaceTotal(footerLeft.value),
      footerRight: replaceTotal(footerRight.value),
    };
  };

  let pageCountSyncTimer: ReturnType<typeof setTimeout> | null = null;
  const schedulePageCountSync = () => {
    if (pageCountSyncTimer) clearTimeout(pageCountSyncTimer);
    pageCountSyncTimer = setTimeout(() => {
      pageCountSyncTimer = null;
      try {
        const official = options.wordEditor.value?.getPageCount?.();
        const newCount = typeof official === 'number' && official > 0 ? official : readPageCount(options.tiptapEditor.value);
        if (newCount !== pageCount.value) {
          pageCount.value = newCount;
          if (options.tiptapEditor.value) {
            updatePaginationText(options.tiptapEditor.value, paginationText());
          }
        }
      } catch {
        pageCount.value = readPageCount(options.tiptapEditor.value);
      }
    }, 120);
  };

  const syncPaginationLayout = () => {
    if (options.tiptapEditor.value) {
      updatePaginationLayout(options.tiptapEditor.value, paginationGeometry());
      schedulePageCountSync();
    }
  };

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

  const applyMargins = (margins: MarginsMm) => {
    currentMarginsMm.value = { ...margins };
    if (options.wordEditor.value) {
      options.wordEditor.value.setPageLayout({
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

  const setMarginPreset = (preset: MarginPresetName) => {
    applyMargins({ ...MARGIN_PRESETS_MM[preset] });
  };

  const setCustomMargins = (top: number, bottom: number, left: number, right: number) => {
    applyMargins({ top, bottom, left, right });
  };

  const setOrientation = (newOrientation: Orientation) => {
    orientation.value = newOrientation;
    if (options.wordEditor.value) {
      options.wordEditor.value.setPageLayout({
        pageSize: toRkPageSize(pageSize.value),
        orientation: newOrientation,
        margins: {
          top: `${currentMarginsMm.value.top}mm`,
          bottom: `${currentMarginsMm.value.bottom}mm`,
          left: `${currentMarginsMm.value.left}mm`,
          right: `${currentMarginsMm.value.right}mm`,
        },
      });
      syncPaginationLayout();
    }
  };

  const toggleOrientation = () => {
    setOrientation(orientation.value === 'portrait' ? 'landscape' : 'portrait');
  };

  const setPageSize = (newSize: PageSize) => {
    pageSize.value = newSize;
    if (options.wordEditor.value) {
      options.wordEditor.value.setPageLayout({
        pageSize: toRkPageSize(newSize),
        orientation: orientation.value,
        margins: {
          top: `${currentMarginsMm.value.top}mm`,
          bottom: `${currentMarginsMm.value.bottom}mm`,
          left: `${currentMarginsMm.value.left}mm`,
          right: `${currentMarginsMm.value.right}mm`,
        },
      });
      syncPaginationLayout();
    }
  };

  return {
    orientation,
    pageSize,
    pageCount,
    wordCount,
    characterCount,
    zoom,
    currentMarginsMm,
    headerLeft,
    headerRight,
    footerLeft,
    footerRight,
    isInsideTable,
    isLandscape,
    pageWidthPx,
    paginationGeometry,
    paginationText,
    schedulePageCountSync,
    syncPaginationLayout,
    applyMargins,
    setMarginPreset,
    setCustomMargins,
    setOrientation,
    toggleOrientation,
    setPageSize,
  };
}
