import { ref, computed, watch } from 'vue';
import type { PageSize } from '../../types/dto';

export interface WordRulerProps {
  pageSize?: PageSize;
  isLandscape?: boolean;
  firstLineIndentCm?: number;
  leftIndentCm?: number;
  rightIndentCm?: number;
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

  const firstLineCm = ref(props.firstLineIndentCm ?? 1.25);
  const leftIndentCm = ref(props.leftIndentCm ?? 0.0);
  const rightIndentCm = ref(props.rightIndentCm ?? 17.0);

  watch(() => props.firstLineIndentCm, (v) => {
    if (v !== undefined && !activeDrag.value) firstLineCm.value = v;
  });
  watch(() => props.leftIndentCm, (v) => {
    if (v !== undefined && !activeDrag.value) leftIndentCm.value = v;
  });
  watch(() => props.rightIndentCm, (v) => {
    if (v !== undefined && !activeDrag.value) rightIndentCm.value = v;
  });

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

  return {
    rulerRef, pxPerCm,
    sheetWidthPx, marginLeftPx, marginRightPx, printableCmMax,
    firstLineCm, leftIndentCm, rightIndentCm,
    firstLinePx, leftIndentPx, rightIndentPx,
    activeDrag, guidelineX, startDrag, resetToGost,
  };
}
