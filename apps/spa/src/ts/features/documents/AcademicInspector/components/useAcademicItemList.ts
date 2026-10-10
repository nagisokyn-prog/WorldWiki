import { computed } from 'vue';
import type { InspectorItem } from '../AcademicInspector.model';

export interface AcademicItemListProps {
  sectionTitle: string;
  emptyMessage: string;
  items: InspectorItem[];
  formatNumber?: (num?: string | number) => string;
}

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
