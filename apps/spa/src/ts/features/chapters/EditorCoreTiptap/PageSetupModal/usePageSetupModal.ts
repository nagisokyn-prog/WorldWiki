import { ref, watch } from 'vue';
import type { PageSize, Orientation } from '@worldwiki/word-vibe';
import type { MarginsMm } from '@worldwiki/word-vibe';

export interface PageSetupModalProps {
  isOpen: boolean;
  margins?: MarginsMm;
  pageSize?: PageSize;
  orientation?: Orientation;
}

export interface PageSetupPayload {
  margins: MarginsMm;
  pageSize: PageSize;
  orientation: Orientation;
}

export const SIZES: Array<{ value: PageSize; label: string }> = [
  { value: 'A4', label: 'A4 (210 × 297 мм)' },
  { value: 'A5', label: 'A5 (148 × 210 мм)' },
  { value: 'A3', label: 'A3 (297 × 420 мм)' },
  { value: 'Letter', label: 'Letter (216 × 279 мм)' },
  { value: 'B5', label: 'B5 (176 × 250 мм)' },
];

export interface PageSetupEmit {
  (e: 'close'): void;
  (e: 'apply', payload: PageSetupPayload): void;
}

export function usePageSetupModal(
  props: PageSetupModalProps,
  emit: PageSetupEmit,
) {
  const activeTab = ref<'margins' | 'paper' | 'layout'>('margins');
  const topMm = ref(20);
  const bottomMm = ref(20);
  const leftMm = ref(30);
  const rightMm = ref(15);
  const size = ref<PageSize>('A4');
  const orient = ref<Orientation>('portrait');

  watch(
    () => props.isOpen,
    (open) => {
      try {
        if (open) {
          topMm.value = props.margins?.top ?? 20;
          bottomMm.value = props.margins?.bottom ?? 20;
          leftMm.value = props.margins?.left ?? 30;
          rightMm.value = props.margins?.right ?? 15;
          size.value = props.pageSize || 'A4';
          orient.value = props.orientation || 'portrait';
          activeTab.value = 'margins';
        }
      } catch (error) {
        console.error('[PageSetupModal] watch failed:', error);
        throw error;
      }
    },
  );

  const applyGost = () => {
    try {
      topMm.value = 20;
      bottomMm.value = 20;
      leftMm.value = 30;
      rightMm.value = 15;
    } catch (error) {
      console.error('[PageSetupModal] applyGost failed:', error);
      throw error;
    }
  };

  const handleApply = () => {
    try {
      emit('apply', {
        margins: { top: topMm.value, bottom: bottomMm.value, left: leftMm.value, right: rightMm.value },
        pageSize: size.value,
        orientation: orient.value,
      });
      emit('close');
    } catch (error) {
      console.error('[PageSetupModal] handleApply failed:', error);
      throw error;
    }
  };

  return { activeTab, topMm, bottomMm, leftMm, rightMm, size, orient, applyGost, handleApply, SIZES };
}
