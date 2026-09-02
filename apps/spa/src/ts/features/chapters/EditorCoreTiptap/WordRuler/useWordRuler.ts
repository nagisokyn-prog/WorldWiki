import { ref, computed, watch, onUnmounted } from 'vue';
import type { PageSize, EditorInstance } from '@worldwiki/word-vibe';

export interface WordRulerProps {
  pageSize?: PageSize;
  isLandscape?: boolean;
  editor?: EditorInstance | null;
}

export type WordRulerEmit = <T extends 'update:firstLineIndent' | 'update:leftIndent' | 'update:rightIndent'>(
  e: T,
  cm: number
) => void;

export function useWordRuler(props: WordRulerProps, emit: WordRulerEmit) {

const rulerRef = ref<HTMLElement | null>(null);

// Коэффициент пересчета: ~37.82 px на 1 см
const pxPerCm = 37.82;

const dimensions = computed(() => {
  if (props.isLandscape) {
    switch (props.pageSize) {
      case 'A5':
        return { sheetWidth: 794, marginLeft: 75, marginRight: 38, printableCm: 18.0 };
      case 'A3':
        return { sheetWidth: 1587, marginLeft: 113, marginRight: 57, printableCm: 37.5 };
      case 'Letter':
        return { sheetWidth: 1056, marginLeft: 96, marginRight: 96, printableCm: 22.8 };
      case 'B5':
        return { sheetWidth: 945, marginLeft: 94, marginRight: 57, printableCm: 21.0 };
      case 'A4':
      default:
        return { sheetWidth: 1123, marginLeft: 113, marginRight: 57, printableCm: 25.2 };
    }
  }

  switch (props.pageSize) {
    case 'A5':
      return { sheetWidth: 559, marginLeft: 75, marginRight: 38, printableCm: 11.8 };
    case 'A3':
      return { sheetWidth: 1123, marginLeft: 113, marginRight: 38, printableCm: 25.7 };
    case 'Letter':
      return { sheetWidth: 816, marginLeft: 96, marginRight: 96, printableCm: 16.5 };
    case 'B5':
      return { sheetWidth: 665, marginLeft: 94, marginRight: 57, printableCm: 13.6 };
    case 'A4':
    default:
      return { sheetWidth: 794, marginLeft: 113, marginRight: 38, printableCm: 17.0 };
  }
});

const sheetWidthPx = computed(() => dimensions.value.sheetWidth);
const marginLeftPx = computed(() => dimensions.value.marginLeft);
const marginRightPx = computed(() => dimensions.value.marginRight);
const printableCmMax = computed(() => dimensions.value.printableCm);

const firstLineCm = ref(1.25); // ГОСТ 1.25 см по умолчанию
const leftIndentCm = ref(0.0);
const rightIndentCm = ref(17.0);

const firstLinePx = computed(() => firstLineCm.value * pxPerCm);
const leftIndentPx = computed(() => leftIndentCm.value * pxPerCm);
const rightIndentPx = computed(() => rightIndentCm.value * pxPerCm);

const activeDrag = ref<'firstLine' | 'leftIndent' | 'rightIndent' | null>(null);
const guidelineX = ref<number | null>(null);

const startDrag = (type: 'firstLine' | 'leftIndent' | 'rightIndent', e: MouseEvent) => {
  e.preventDefault();
  activeDrag.value = type;
  guidelineX.value = e.clientX;

  const onMouseMove = (moveEvt: MouseEvent) => {
    moveEvt.preventDefault();
    if (!rulerRef.value || !activeDrag.value) return;
    const rect = rulerRef.value.getBoundingClientRect();
    const printableLeft = rect.left + marginLeftPx.value;
    const printableWidth = sheetWidthPx.value - marginLeftPx.value - marginRightPx.value;
    const relX = Math.max(0, Math.min(printableWidth, moveEvt.clientX - printableLeft));
    let cm = relX / pxPerCm;

    // Магнитное притяжение к ГОСТ 1.25 см
    if (activeDrag.value === 'firstLine' && !moveEvt.altKey) {
      if (Math.abs(cm - 1.25) < 0.12) {
        cm = 1.25;
      } else if (Math.abs(cm - 1.0) < 0.08) {
        cm = 1.0;
      } else if (Math.abs(cm) < 0.08) {
        cm = 0.0;
      }
    }

    if (activeDrag.value === 'firstLine') {
      firstLineCm.value = cm;
      guidelineX.value = printableLeft + cm * pxPerCm;
      emit('update:firstLineIndent', cm);
    } else if (activeDrag.value === 'leftIndent') {
      leftIndentCm.value = cm;
      guidelineX.value = printableLeft + cm * pxPerCm;
      emit('update:leftIndent', cm);
    } else if (activeDrag.value === 'rightIndent') {
      rightIndentCm.value = cm;
      guidelineX.value = printableLeft + cm * pxPerCm;
      emit('update:rightIndent', 17 - cm);
    }
  };

  const onMouseUp = () => {
    activeDrag.value = null;
    guidelineX.value = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const resetToGost = () => {
  firstLineCm.value = 1.25;
  emit('update:firstLineIndent', 1.25);
};

  let detachSelectionListener: (() => void) | null = null;

  const stopEditorWatch = watch(() => props.editor, (ed) => {
    if (detachSelectionListener) {
      detachSelectionListener();
      detachSelectionListener = null;
    }
    if (!ed) return;

    // pxPerCm = 37.82, rk-editor-core indent step = 40px, so 1 indent = 40/37.82 ≈ 1.058 cm
    const INDENT_STEP_PX = 40;

    const updateFromSelection = () => {
      if (activeDrag.value) return;
      try {
        const { $from } = ed.state.selection;

        for (let d = $from.depth; d >= 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'paragraph') {
            // Left indent: rk-editor-core `indent` attr (integer), 40px steps
            const indentLevel = typeof node.attrs.indent === 'number' ? node.attrs.indent : 0;
            leftIndentCm.value = (indentLevel * INDENT_STEP_PX) / pxPerCm;

            // First-line indent: `paragraphSystem` extension attr `firstLineIndent`
            // parseHTML читает t.style.textIndent, renderHTML: `text-indent: ${val}`
            const rawFirstLine = node.attrs.firstLineIndent;
            if (rawFirstLine && typeof rawFirstLine === 'string') {
              // '1.25cm' → 1.25, '12.5mm' → convert, '0' → 0
              const parsed = parseFloat(rawFirstLine);
              if (!isNaN(parsed)) {
                // Handle 'cm' vs 'mm' vs 'pt'
                if (rawFirstLine.endsWith('mm')) {
                  firstLineCm.value = parsed / 10;
                } else if (rawFirstLine.endsWith('pt')) {
                  firstLineCm.value = parsed * 0.0352778;
                } else {
                  firstLineCm.value = parsed; // already cm
                }
              }
            } else {
              // Null attr → CSS default 1.25cm
              firstLineCm.value = 1.25;
            }

            // Right indent: no schema support in rk-editor-core → show at printable end
            rightIndentCm.value = printableCmMax.value;
            break;
          }
        }
      } catch {
        // Игнорируем исключения при пустой выборке
      }
    };

    ed.on('selectionUpdate', updateFromSelection);
    updateFromSelection();

    detachSelectionListener = () => {
      ed.off('selectionUpdate', updateFromSelection);
    };
  }, { immediate: true });

  onUnmounted(() => {
    stopEditorWatch();
  });

  return {
    rulerRef, pxPerCm,
    sheetWidthPx, marginLeftPx, marginRightPx, printableCmMax,
    firstLineCm, leftIndentCm, rightIndentCm,
    firstLinePx, leftIndentPx, rightIndentPx,
    activeDrag, guidelineX, startDrag, resetToGost,
  };
}
