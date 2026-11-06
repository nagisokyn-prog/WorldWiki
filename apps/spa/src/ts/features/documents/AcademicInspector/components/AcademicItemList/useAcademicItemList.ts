import { computed } from 'vue';
import type { AcademicItemListProps } from './AcademicItemList.model';

export type { AcademicItemListProps };

export function useAcademicItemList(props: AcademicItemListProps) {
  const displayItems = computed(() => {
    const fn = props.formatNumber;
    return props.items.map((item) => ({
      ...item,
      displayNumber: fn ? fn(item.number) : item.number,
    }));
  });

  return {
    displayItems,
  };
}
